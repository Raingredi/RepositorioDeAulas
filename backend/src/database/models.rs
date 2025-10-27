use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usuario {
    pub id: String,
    pub usuario: String,
    pub senha: String, // Em produção, deve ser hash
    pub nome: String,
    pub cargo: Cargo,
    pub turmas: Vec<String>,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Cargo {
    #[serde(rename = "aluno")]
    Aluno,
    #[serde(rename = "professor")]
    Professor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turma {
    pub id: String,
    pub nome: String,
    pub cor: String,
    pub icone: String,
    pub aulas: HashMap<String, Aula>,
    pub atividades: Vec<Atividade>,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aula {
    pub id: String,
    pub titulo: String,
    pub caminho: String,
    pub icone: String,
    pub descricao: String,
    pub turma_id: String,
    pub ordem: i32,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Atividade {
    pub id: String,
    pub titulo: String,
    pub descricao: String,
    pub caminho: String,
    pub icone: String,
    pub turma_id: String,
    pub aulas_relacionadas: Vec<String>, // IDs das aulas relacionadas
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rascunho {
    pub id: String,
    pub usuario_id: String,
    pub atividade_id: String,
    pub conteudo: String,
    pub titulo: String,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

// Estruturas para inicialização
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialData {
    pub turmas: HashMap<String, TurmaData>,
    pub logica: TurmaData,
    pub usuarios_iniciais: Vec<UsuarioInicial>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaData {
    pub nome: String,
    pub cor: String,
    pub icone: String,
    pub aulas: HashMap<String, AulaData>,
    pub atividades: Vec<AtividadeData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AulaData {
    pub caminho: String,
    pub icone: String,
    pub descricao: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtividadeData {
    pub id: String,
    pub icone: String,
    pub titulo: String,
    pub descricao: String,
    pub caminho: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsuarioInicial {
    pub usuario: String,
    pub senha: String,
    pub nome: String,
    pub cargo: String,
    pub turmas: Vec<String>,
}
