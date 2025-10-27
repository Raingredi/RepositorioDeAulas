Repositório de Aulas

Visão geral
Este é um sistema estático de distribuição de conteúdo educacional. O produto apresenta turmas, aulas e atividades de forma visual e acessível, com foco em uso em sala de aula ou ensino remoto.

Principais funcionalidades
- Listagem de turmas: cartões com nome, cor e ícone para navegação rápida.
- Acesso protegido por senha por turma: modal de senha para acessar conteúdos restritos (senhas mantidas localmente e não versionadas).
- Aulas e Atividades: cada aula/atividade é referenciada por caminhos estáticos (HTML) dentro da estrutura de pastas.
- Envio de atividades: modal com editor rich-text (Quill) para resposta dos alunos. Rascunhos são salvos no localStorage.
- Integração de envio: sistema híbrido com serviço Rust primário e EmailJS como fallback automático quando o serviço principal falha ou demora mais de 30 segundos.
- UX moderna: animações sutis, modais de sucesso/erro/carregamento e navegação otimizada para desktop e mobile.

Arquitetura de configuração
- `settings.json` (público): contém os metadados das turmas (nome, cor, ícone), caminhos das aulas e atividades — adequado para versionamento.
- `settings.secret.json` (local, não versionado): contém credenciais sensíveis (EmailJS) e senhas das turmas. O app carrega o `settings.json` e mescla `settings.secret.json` quando disponível.

Estrutura de conteúdo (resumo)
- `index.html` — interface e lógica principal em JavaScript.
- `turmas/` — organização das pastas por turma contendo `aulas/` e `atividades/`.

Contato e contribuições
- Issues e pull-requests são bem-vindos para correções, melhorias de UI e novos conteúdos.

Licença
- Inclua aqui a licença do projeto se desejar (por exemplo MIT).
Servir localmente com Docker (simples)
------------------------------------

Subir um container Nginx que sirva o diretório atual (raiz do repositório):

```sh
# a partir da raiz do repositório, execute:
docker run --name nginx -d --rm -p 80:80 -v "$(pwd):/usr/share/nginx/html:ro" nginx
```

Abra http://localhost no navegador.

Parar o container:

```sh
docker stop nginx
```

Observações:
- Usei montagem em modo somente leitura (`:ro`) por segurança. Remova `:ro` se precisar escrever arquivos a partir do container.
- Se sua máquina usa SELinux e houver problemas de permissão, troque para `:z` (ex.: `...:z`) ou ajuste o contexto.
- Para desenvolvimento com configurações mais complexas, considere criar um `docker-compose.yml`.

Configuração secreta (senhas e EmailJS)
-------------------------------------

Para gerenciar senhas das turmas e credenciais do EmailJS localmente, adicione um arquivo `settings.secret.json` na raiz do repositório.

Um exemplo de template (sem segredos reais) foi adicionado como `example.secret.json`. Copie-o e atualize os valores:

```sh
cp example.secret.json settings.secret.json
# então edite settings.secret.json e preencha os valores reais (não versionar)
```

Campos principais do template:
- `emailjs.serviceId`, `emailjs.templateId`, `emailjs.userId` (e opcional `accessToken`) — usados para fallback de envio de emails.
- `email.public_key`, `email.service_id`, `email.template_id` — configurações do sistema híbrido de email.
- `turmasSenhas` — objeto com chaves por turma contendo a senha necessária para acessar conteúdos protegidos.

Sistema de Email Híbrido
------------------------

O sistema utiliza dois serviços de email em cascata para máxima confiabilidade:

1. **Serviço Primário (Rust)**: API local que processa emails usando SMTP direto
2. **Fallback (EmailJS)**: Serviço pago na nuvem quando o primário falha

**Fluxo de funcionamento:**
- Tentativa inicial sempre pelo serviço Rust (mais rápido e sem custos)
- Se falhar ou demorar >30 segundos, automaticamente usa EmailJS
- Configuração no `settings.secret.json` (não versionado):

```json
{
  "email": {
    "public_key": "SUA_PUBLIC_KEY_DO_EMAILJS",
    "service_id": "SUA_SERVICE_ID",
    "template_id": "SUA_TEMPLATE_ID",
    "fallback_enabled": true,
    "timeout_ms": 30000
  }
}
```

**Variáveis do template EmailJS:**
- `to_email`: Destinatário
- `subject`: Assunto
- `from_name`: Nome do remetente
- `message`: Corpo da mensagem
- Outras variáveis conforme `options.variables`

Segurança:
- Não comite `settings.secret.json` no controle de versão. Adicione-o ao `.gitignore` se ainda não estiver.
- Mantenha `example.secret.json` no repositório apenas como referência.
