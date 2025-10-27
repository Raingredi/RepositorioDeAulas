use lmdb::{Environment, Database, Transaction, WriteFlags, Cursor};
use std::path::Path;
use std::fs;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use crate::database::models::*;
use uuid::Uuid;

pub struct DatabaseManager {
    env: Environment,
    users_db: Database,
    turmas_db: Database,
    aulas_db: Database,
    atividades_db: Database,
    rascunhos_db: Database,
    metadata_db: Database,
}

impl DatabaseManager {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        // Criar diretório se não existir
        fs::create_dir_all(&path)?;

        // Configurar ambiente LMDB
        let env = Environment::new()
            .set_max_dbs(6) // 6 databases
            .set_map_size(10485760) // 10MB
            .open(path.as_ref())?;

        // Criar databases
        let users_db = env.create_db(Some("users"), lmdb::DatabaseFlags::empty())?;
        let turmas_db = env.create_db(Some("turmas"), lmdb::DatabaseFlags::empty())?;
        let aulas_db = env.create_db(Some("aulas"), lmdb::DatabaseFlags::empty())?;
        let atividades_db = env.create_db(Some("atividades"), lmdb::DatabaseFlags::empty())?;
        let rascunhos_db = env.create_db(Some("rascunhos"), lmdb::DatabaseFlags::empty())?;
        let metadata_db = env.create_db(Some("metadata"), lmdb::DatabaseFlags::empty())?;

        Ok(DatabaseManager {
            env,
            users_db,
            turmas_db,
            aulas_db,
            atividades_db,
            rascunhos_db,
            metadata_db,
        })
    }

    // ========== USUÁRIOS ==========

    pub fn create_usuario(&self, usuario: &str, senha: &str, nome: &str, cargo: Cargo, turmas: Vec<String>) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = chrono::Utc::now().timestamp();

        let id = Uuid::new_v4().to_string();
        let user = Usuario {
            id: id.clone(),
            usuario: usuario.to_string(),
            senha: senha.to_string(), // TODO: Hash da senha
            nome: nome.to_string(),
            cargo,
            turmas,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("user:{}", usuario);
        let value = serde_json::to_string(&user)?;
        txn.put(self.users_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_usuario(&self, usuario: &str) -> Result<Option<Usuario>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("user:{}", usuario);

        match txn.get(self.users_db, &key.as_bytes()) {
            Ok(data) => {
                let user: Usuario = serde_json::from_slice(data)?;
                Ok(Some(user))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar usuário: {}", e)),
        }
    }

    pub fn authenticate_usuario(&self, usuario: &str, senha: &str) -> Result<Option<Usuario>> {
        if let Some(user) = self.get_usuario(usuario)? {
            if user.senha == senha { // TODO: Verificar hash
                Ok(Some(user))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    pub fn update_usuario(&self, usuario: &str, updates: UsuarioUpdate) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;

        if let Some(mut user) = self.get_usuario(usuario)? {
            if let Some(senha) = updates.senha {
                user.senha = senha;
            }
            if let Some(nome) = updates.nome {
                user.nome = nome;
            }
            if let Some(cargo) = updates.cargo {
                user.cargo = cargo;
            }
            if let Some(turmas) = updates.turmas {
                user.turmas = turmas;
            }
            user.atualizado_em = chrono::Utc::now().timestamp();

            let key = format!("user:{}", usuario);
            let value = serde_json::to_string(&user)?;
            txn.put(self.users_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
            txn.commit()?;
        }

        Ok(())
    }

    // ========== TURMAS ==========

    pub fn create_turma(&self, id: &str, nome: &str, cor: &str, icone: &str) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = chrono::Utc::now().timestamp();

        let turma = Turma {
            id: id.to_string(),
            nome: nome.to_string(),
            cor: cor.to_string(),
            icone: icone.to_string(),
            aulas: HashMap::new(),
            atividades: Vec::new(),
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("turma:{}", id);
        let value = serde_json::to_string(&turma)?;
        txn.put(self.turmas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id.to_string())
    }

    pub fn get_turma(&self, id: &str) -> Result<Option<Turma>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("turma:{}", id);

        match txn.get(self.turmas_db, &key.as_bytes()) {
            Ok(data) => {
                let turma: Turma = serde_json::from_slice(data)?;
                Ok(Some(turma))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar turma: {}", e)),
        }
    }

    pub fn list_turmas(&self) -> Result<Vec<Turma>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.turmas_db)?;
        let mut turmas = Vec::new();

        for (key, value) in cursor.iter() {
            if key.starts_with(b"turma:") {
                let turma: Turma = serde_json::from_slice(value)?;
                turmas.push(turma);
            }
        }

        Ok(turmas)
    }

    // ========== AULAS ==========

    pub fn create_aula(&self, titulo: &str, caminho: &str, icone: &str, descricao: &str, turma_id: &str, ordem: i32) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = chrono::Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let aula = Aula {
            id: id.clone(),
            titulo: titulo.to_string(),
            caminho: caminho.to_string(),
            icone: icone.to_string(),
            descricao: descricao.to_string(),
            turma_id: turma_id.to_string(),
            ordem,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("aula:{}", id);
        let value = serde_json::to_string(&aula)?;
        txn.put(self.aulas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_aula(&self, id: &str) -> Result<Option<Aula>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("aula:{}", id);

        match txn.get(self.aulas_db, &key.as_bytes()) {
            Ok(data) => {
                let aula: Aula = serde_json::from_slice(data)?;
                Ok(Some(aula))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar aula: {}", e)),
        }
    }

    pub fn get_aulas_by_turma(&self, turma_id: &str) -> Result<Vec<Aula>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.aulas_db)?;
        let mut aulas = Vec::new();

        for (key, value) in cursor.iter() {
            if key.starts_with(b"aula:") {
                let aula: Aula = serde_json::from_slice(value)?;
                if aula.turma_id == turma_id {
                    aulas.push(aula);
                }
            }
        }

        aulas.sort_by(|a, b| a.ordem.cmp(&b.ordem));
        Ok(aulas)
    }

    // ========== ATIVIDADES ==========

    pub fn create_atividade(&self, titulo: &str, descricao: &str, caminho: &str, icone: &str, turma_id: &str, aulas_relacionadas: Vec<String>) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = chrono::Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let atividade = Atividade {
            id: id.clone(),
            titulo: titulo.to_string(),
            descricao: descricao.to_string(),
            caminho: caminho.to_string(),
            icone: icone.to_string(),
            turma_id: turma_id.to_string(),
            aulas_relacionadas,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("atividade:{}", id);
        let value = serde_json::to_string(&atividade)?;
        txn.put(self.atividades_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_atividade(&self, id: &str) -> Result<Option<Atividade>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("atividade:{}", id);

        match txn.get(self.atividades_db, &key.as_bytes()) {
            Ok(data) => {
                let atividade: Atividade = serde_json::from_slice(data)?;
                Ok(Some(atividade))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar atividade: {}", e)),
        }
    }

    pub fn get_atividades_by_turma(&self, turma_id: &str) -> Result<Vec<Atividade>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.atividades_db)?;
        let mut atividades = Vec::new();

        for (key, value) in cursor.iter() {
            if key.starts_with(b"atividade:") {
                let atividade: Atividade = serde_json::from_slice(value)?;
                if atividade.turma_id == turma_id {
                    atividades.push(atividade);
                }
            }
        }

        Ok(atividades)
    }

    // ========== RASCUNHOS ==========

    pub fn create_rascunho(&self, usuario_id: &str, atividade_id: &str, titulo: &str, conteudo: &str) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = chrono::Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        // Verificar se já existe rascunho para este usuário e atividade
        let existing_key = format!("rascunho:{}:{}", usuario_id, atividade_id);
        if txn.get(self.rascunhos_db, &existing_key.as_bytes()).is_ok() {
            return Err(anyhow!("Já existe um rascunho para esta atividade"));
        }

        let rascunho = Rascunho {
            id: id.clone(),
            usuario_id: usuario_id.to_string(),
            atividade_id: atividade_id.to_string(),
            titulo: titulo.to_string(),
            conteudo: conteudo.to_string(),
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);
        let value = serde_json::to_string(&rascunho)?;
        txn.put(self.rascunhos_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_rascunho(&self, usuario_id: &str, atividade_id: &str) -> Result<Option<Rascunho>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        match txn.get(self.rascunhos_db, &key.as_bytes()) {
            Ok(data) => {
                let rascunho: Rascunho = serde_json::from_slice(data)?;
                Ok(Some(rascunho))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar rascunho: {}", e)),
        }
    }

    pub fn update_rascunho(&self, usuario_id: &str, atividade_id: &str, titulo: Option<&str>, conteudo: Option<&str>) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        if let Ok(data) = txn.get(self.rascunhos_db, &key.as_bytes()) {
            let mut rascunho: Rascunho = serde_json::from_slice(data)?;

            if let Some(t) = titulo {
                rascunho.titulo = t.to_string();
            }
            if let Some(c) = conteudo {
                rascunho.conteudo = c.to_string();
            }
            rascunho.atualizado_em = chrono::Utc::now().timestamp();

            let value = serde_json::to_string(&rascunho)?;
            txn.put(self.rascunhos_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
            txn.commit()?;
        }

        Ok(())
    }

    pub fn delete_rascunho(&self, usuario_id: &str, atividade_id: &str) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        txn.del(self.rascunhos_db, &key.as_bytes(), None)?;
        txn.commit()?;
        Ok(())
    }

    pub fn get_rascunhos_usuario(&self, usuario_id: &str) -> Result<Vec<Rascunho>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.rascunhos_db)?;
        let mut rascunhos = Vec::new();
        let prefix = format!("rascunho:{}:", usuario_id);

        for (key, value) in cursor.iter() {
            if key.starts_with(prefix.as_bytes()) {
                let rascunho: Rascunho = serde_json::from_slice(value)?;
                rascunhos.push(rascunho);
            }
        }

        Ok(rascunhos)
    }

    // ========== METADATA ==========

    pub fn set_initialized(&self) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        txn.put(self.metadata_db, b"initialized", b"true", WriteFlags::empty())?;
        txn.commit()?;
        Ok(())
    }

    pub fn is_initialized(&self) -> Result<bool> {
        let txn = self.env.begin_ro_txn()?;

        match txn.get(self.metadata_db, b"initialized") {
            Ok(data) => Ok(data == b"true"),
            Err(lmdb::Error::NotFound) => Ok(false),
            Err(e) => Err(anyhow!("Erro ao verificar inicialização: {}", e)),
        }
    }
}

#[derive(Debug)]
pub struct UsuarioUpdate {
    pub senha: Option<String>,
    pub nome: Option<String>,
    pub cargo: Option<Cargo>,
    pub turmas: Option<Vec<String>>,
}

impl Default for UsuarioUpdate {
    fn default() -> Self {
        UsuarioUpdate {
            senha: None,
            nome: None,
            cargo: None,
            turmas: None,
        }
    }
}
