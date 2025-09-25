use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env};
use tokio::{sync::mpsc, time::{sleep, Duration}};
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha20Rng;
use lettre::{
    AsyncSmtpTransport, Tokio1Executor, AsyncTransport, Message,
    transport::smtp::authentication::Credentials,
    message::{MultiPart, SinglePart, header::ContentType},
};
use std::fs;
use anyhow;

#[derive(Deserialize, Clone)]
pub struct MailRequest {
    pub to: String,
    pub subject: String,
    pub template: Option<String>,
    pub variables: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct MailResponse {
    pub success: bool,
    pub message: String,
}

static mut TX: Option<mpsc::Sender<MailRequest>> = None;

pub async fn send_mail(Json(req): Json<MailRequest>) -> Result<Json<MailResponse>, StatusCode> {
    unsafe {
        if let Some(tx) = &TX {
            if tx.send(req).await.is_ok() {
                return Ok(Json(MailResponse {
                    success: true,
                    message: "Email enfileirado".to_string(),
                }));
            }
        }
    }
    Ok(Json(MailResponse {
        success: false,
        message: "Erro ao enfileirar email".to_string(),
    }))
}

pub fn init_mailer() {
    let (tx, rx) = mpsc::channel::<MailRequest>(100);
    unsafe { TX = Some(tx); }
    tokio::spawn(mail_worker(rx));
}

async fn mail_worker(mut rx: mpsc::Receiver<MailRequest>) {
    // Criar RNG thread-safe
    let mut rng = ChaCha20Rng::from_entropy();

    while let Some(req) = rx.recv().await {
        if let Err(err) = process_mail(req).await {
            eprintln!("Erro ao enviar: {err:?}");
        }

        // Gerar delay aleatório entre 1.2s e 2s
        let delay_ms = rng.gen_range(1200..=2000);
        sleep(Duration::from_millis(delay_ms)).await;
    }
}

async fn process_mail(req: MailRequest) -> anyhow::Result<()> {
    let smtp_host = env::var("SMTP_HOST")?;
    let smtp_port: u16 = env::var("SMTP_PORT")?.parse()?;
    let smtp_user = env::var("SMTP_USERNAME")?;
    let smtp_pass = env::var("SMTP_PASSWORD")?;
    let mail_from = env::var("MAIL_FROM")?;

    let template_name = req.template.unwrap_or_else(|| "default.txt".to_string());
    let template_path = format!("/app/templates/{}", template_name);

    let mut body = fs::read_to_string(&template_path)?;

    if let Some(vars) = req.variables {
        for (k, v) in vars {
            body = body.replace(&format!("{{{{{}}}}}", k), &v);
        }
    }

    let creds = Credentials::new(smtp_user.clone(), smtp_pass);

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
        .port(smtp_port)
        .credentials(creds)
        .build();

    let is_html = template_name.ends_with(".html");
    let email = if is_html {
        Message::builder()
            .from(mail_from.parse()?)
            .to(req.to.parse()?)
            .subject(req.subject)
            .multipart(
                MultiPart::alternative().singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(body),
                ),
            )?
    } else {
        Message::builder()
            .from(mail_from.parse()?)
            .to(req.to.parse()?)
            .subject(req.subject)
            .body(body)?
    };

    mailer.send(email).await?;
    Ok(())
}
