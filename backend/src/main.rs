mod mailer;
mod database;

use axum::{routing::{post, get}, Router, Json, Extension};
use tower_http::cors::{Any, CorsLayer};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::database::DatabaseManager;

#[derive(Deserialize)]
struct LoginRequest {
    usuario: String,
    senha: String,
}

#[derive(Serialize)]
struct AuthResponse {
    success: bool,
    message: String,
    usuario: Option<crate::database::models::Usuario>,
}

#[derive(Serialize)]
struct TurmasResponse {
    success: bool,
    turmas: Vec<crate::database::models::Turma>,
}

async fn login(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<LoginRequest>,
) -> Json<AuthResponse> {
    match db.authenticate_usuario(&req.usuario, &req.senha) {
        Ok(Some(usuario)) => Json(AuthResponse {
            success: true,
            message: "Login realizado com sucesso!".to_string(),
            usuario: Some(usuario),
        }),
        Ok(None) => Json(AuthResponse {
            success: false,
            message: "Usuário ou senha incorretos".to_string(),
            usuario: None,
        }),
        Err(e) => Json(AuthResponse {
            success: false,
            message: format!("Erro interno: {}", e),
            usuario: None,
        }),
    }
}

async fn get_turmas(
    Extension(db): Extension<Arc<DatabaseManager>>,
) -> Json<TurmasResponse> {
    match db.list_turmas() {
        Ok(turmas) => Json(TurmasResponse {
            success: true,
            turmas,
        }),
        Err(e) => Json(TurmasResponse {
            success: false,
            turmas: vec![],
        }),
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // Inicializar o banco de dados LMDB
    println!("🗄️  Inicializando banco de dados LMDB...");
    let db = match database::database::DatabaseManager::new("./database/data") {
        Ok(db) => {
            println!("✅ Banco LMDB conectado com sucesso!");

            // Inicializar dados se for a primeira vez
            if !database::init::is_initialized(&db).unwrap_or(false) {
                println!("📝 Inicializando dados do banco...");
                if let Err(e) = database::init::initialize_database_from_default(&db).await {
                    eprintln!("❌ Erro ao inicializar dados: {}", e);
                } else {
                    println!("✅ Dados inicializados com sucesso!");
                }
            } else {
                println!("ℹ️  Banco já inicializado");
            }

            Arc::new(db)
        }
        Err(e) => {
            eprintln!("❌ Erro ao inicializar banco LMDB: {}", e);
            std::process::exit(1);
        }
    };

    // Inicializar o sistema de emails
    mailer::init_mailer();

    // Configurar CORS para permitir requisições do navegador
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/send-mail", post(mailer::send_mail))
        .route("/auth/login", post(login))
        .route("/turmas", get(get_turmas))
        .layer(Extension(db))
        .layer(cors);

    println!("🚀 Servidor Rust Mailer rodando em 0.0.0.0:8080");
    println!("📧 Endpoint: POST /send-mail");
    println!("📁 Templates disponíveis em: /app/templates/");
    println!("🗄️  LMDB disponível em: ./database/data");
    println!("🌐 CORS habilitado para desenvolvimento");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
