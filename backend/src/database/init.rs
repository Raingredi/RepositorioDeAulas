use crate::database::database::DatabaseManager;
use crate::database::models::*;
use anyhow::Result;
use std::fs;
use std::path::Path;
use reqwest;

pub async fn initialize_from_remote(db: &DatabaseManager, url: &str) -> Result<()> {
    println!("📡 Baixando dados remotos de {}...", url);

    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;
    let initial_data: InitialData = response.json().await?;

    println!("✅ Dados remotos baixados, inicializando banco...");
    initialize_database(db, initial_data).await
}

pub async fn initialize_from_file<P: AsRef<Path>>(db: &DatabaseManager, path: P) -> Result<()> {
    println!("📁 Carregando dados locais de {:?}...", path.as_ref());

    let content = fs::read_to_string(path)?;
    let initial_data: InitialData = serde_json::from_str(&content)?;

    println!("✅ Dados locais carregados, inicializando banco...");
    initialize_database(db, initial_data).await
}

async fn initialize_database(db: &DatabaseManager, data: InitialData) -> Result<()> {
    println!("🏗️  Inicializando estruturas do banco...");

    // Combinar turmas regulares com logica
    let mut all_turmas = data.turmas;
    all_turmas.insert("logica".to_string(), data.logica);

    // Criar turmas
    for (turma_id, turma_data) in all_turmas {
        println!("📚 Criando turma: {}", turma_data.nome);

        // Criar turma
        db.create_turma(&turma_id, &turma_data.nome, &turma_data.cor, &turma_data.icone)?;

        // Criar aulas
        let mut ordem = 1;
        for (aula_titulo, aula_data) in turma_data.aulas {
            println!("  📖 Criando aula: {}", aula_titulo);
            db.create_aula(
                &aula_titulo,
                &aula_data.caminho,
                &aula_data.icone,
                &aula_data.descricao,
                &turma_id,
                ordem,
            )?;
            ordem += 1;
        }

        // Criar atividades
        for atividade_data in turma_data.atividades {
            println!("  📝 Criando atividade: {}", atividade_data.titulo);
            db.create_atividade(
                &atividade_data.titulo,
                &atividade_data.descricao,
                &atividade_data.caminho,
                &atividade_data.icone,
                &turma_id,
                vec![], // TODO: Implementar relacionamento com aulas
            )?;
        }
    }

    // Criar usuários iniciais
    for usuario_data in data.usuarios_iniciais {
        println!("👤 Criando usuário: {}", usuario_data.usuario);

        let cargo = match usuario_data.cargo.as_str() {
            "professor" => Cargo::Professor,
            "aluno" => Cargo::Aluno,
            _ => Cargo::Aluno,
        };

        db.create_usuario(
            &usuario_data.usuario,
            &usuario_data.senha,
            &usuario_data.nome,
            cargo,
            usuario_data.turmas,
        )?;
    }

    // Marcar como inicializado
    db.set_initialized()?;

    println!("🎉 Banco de dados inicializado com sucesso!");
    Ok(())
}

pub fn is_initialized(db: &DatabaseManager) -> Result<bool> {
    db.is_initialized()
}

pub async fn initialize_database_from_default(db: &DatabaseManager) -> Result<()> {
    // Tentar primeiro dados remotos
    let remote_url = "https://uzeda.ddns.net/efg/settings.json";
    match initialize_from_remote(db, remote_url).await {
        Ok(_) => return Ok(()),
        Err(e) => {
            eprintln!("⚠️  Erro ao carregar dados remotos: {}", e);
            eprintln!("📁 Tentando arquivo local...");
        }
    }

    // Fallback para arquivo local
    let local_path = "./database/init/initial_data.json";
    match initialize_from_file(db, local_path).await {
        Ok(_) => Ok(()),
        Err(e) => {
            eprintln!("❌ Erro ao carregar dados locais: {}", e);
            Err(e)
        }
    }
}
