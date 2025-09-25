/**
 * Email Sender - Cliente JavaScript para API Rust Mailer
 * Uso sem bibliotecas adicionais - Vanilla JavaScript
 *
 * @author Sistema de Email Rust
 * @version 1.0.0
 */

/**
 * Classe principal para envio de emails
 */
class EmailSender {
    constructor(apiUrl = null) {
        // Tenta detectar automaticamente a URL da API
        if (!apiUrl) {
            // API sempre roda na porta 8080, independente do domínio
            if (window.location.hostname === 'localhost') {
                // Desenvolvimento local
                this.apiUrl = 'http://localhost:8080';
            } else {
                // Produção - usa o mesmo domínio mas porta 8080
                this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':8080';
            }
        } else {
            this.apiUrl = apiUrl;
        }
        this.endpoint = '/send-mail';
    }

    /**
     * Envia um email usando a API
     *
     * @param {Object} options - Opções do email
     * @param {string} options.to - Email do destinatário (obrigatório)
     * @param {string} options.subject - Assunto do email (obrigatório)
     * @param {string} options.template - Nome do template (padrão: 'default.txt')
     * @param {Object} options.variables - Variáveis para substituir no template
     * @param {string} options.body - Corpo do email (usado se não houver template)
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendEmail(options = {}) {
        try {
            // Validação básica
            if (!options.to) {
                throw new Error('Destinatário (to) é obrigatório');
            }
            if (!options.subject) {
                throw new Error('Assunto (subject) é obrigatório');
            }

            // Preparar payload
            const payload = {
                to: options.to,
                subject: options.subject,
                template: options.template || 'default.txt',
                variables: options.variables || {}
            };

            // Se não usar template, usar o corpo direto
            if (!options.template && options.body) {
                payload.template = 'default.txt';
                payload.variables = { body: options.body };
            }

            // Fazer requisição
            const response = await fetch(`${this.apiUrl}${this.endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro na requisição');
            }

            return {
                success: true,
                message: result.message,
                data: result
            };

        } catch (error) {
            console.error('Erro ao enviar email:', error);

            // Verifica se é erro de conexão
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return {
                    success: false,
                    message: 'Erro de conexão com o servidor. Verifique se a API está rodando.',
                    error: error
                };
            }

            // Verifica se é erro de resposta HTTP
            if (error.message.includes('HTTP')) {
                return {
                    success: false,
                    message: `Erro do servidor: ${error.message}`,
                    error: error
                };
            }

            return {
                success: false,
                message: error.message || 'Erro desconhecido ao enviar email',
                error: error
            };
        }
    }

    /**
     * Envia email com template HTML personalizado
     *
     * @param {string} to - Destinatário
     * @param {string} subject - Assunto
     * @param {string} template - Nome do template (ex: 'envio_atividades.html')
     * @param {Object} variables - Variáveis do template
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendTemplateEmail(to, subject, template, variables = {}) {
        return this.sendEmail({
            to,
            subject,
            template,
            variables
        });
    }

    /**
     * Envia email simples (sem template)
     *
     * @param {string} to - Destinatário
     * @param {string} subject - Assunto
     * @param {string} body - Corpo do email
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendSimpleEmail(to, subject, body) {
        return this.sendEmail({
            to,
            subject,
            body
        });
    }

    /**
     * Envia email de atividade escolar
     *
     * @param {string} to - Email do professor/destinatário
     * @param {string} turma - Nome da turma
     * @param {string} fromName - Nome do aluno
     * @param {string} tema - Tema da aula
     * @param {string} mensagem - Mensagem da atividade
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendAtividadeEmail(to, turma, fromName, tema, mensagem) {
        return this.sendTemplateEmail(
            to,
            'Nova Atividade Enviada',
            'envio_atividades.html',
            {
                turma,
                from_name: fromName,
                tema,
                mensagem
            }
        );
    }
}

/**
 * Instância global do EmailSender (opcional)
 * Pode ser usada diretamente: window.emailSender.sendEmail({...})
 */
window.emailSender = new EmailSender();

// Exporta a classe para uso em módulos ES6
export default EmailSender;

/**
 * Funções de conveniência globais
 */

// Envio rápido de email
window.sendEmail = async (to, subject, body, template = null, variables = {}) => {
    const options = { to, subject };
    if (template) {
        options.template = template;
        options.variables = variables;
    } else {
        options.body = body;
    }
    return await window.emailSender.sendEmail(options);
};

// Envio de atividade escolar
window.sendAtividade = async (to, turma, fromName, tema, mensagem) => {
    return await window.emailSender.sendAtividadeEmail(to, turma, fromName, tema, mensagem);
};

// Teste da API
window.testEmailAPI = async () => {
    console.log('🧪 Testando API de email...');

    const result = await window.emailSender.sendEmail({
        to: 'teste@example.com',
        subject: 'Teste da API',
        body: 'Este é um teste da API de envio de emails!'
    });

    console.log('📧 Resultado:', result);
    return result;
};

/**
 * Funções utilitárias
 */

// Valida formato de email
window.isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Mostra resultado em um elemento HTML
window.showEmailResult = (elementId, result) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
        <div style="
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid ${result.success ? '#4CAF50' : '#f44336'};
            background-color: ${result.success ? '#e8f5e8' : '#ffebee'};
            color: ${result.success ? '#2e7d32' : '#c62828'};
        ">
            <strong>${result.success ? '✅ Sucesso' : '❌ Erro'}:</strong>
            ${result.message}
        </div>
    `;
};

/**
 * Exemplo de uso em HTML:
 *
 * <button onclick="testEmailAPI()">Testar Email</button>
 *
 * <button onclick="sendAtividade('professor@email.com', '3º Ano A', 'João Silva', 'Matemática', 'Atividade resolvida!')">
 *     Enviar Atividade
 * </button>
 *
 * <div id="result"></div>
 *
 * <script>
 *     sendAtividade('professor@email.com', '3º Ano A', 'João Silva', 'Matemática', 'Atividade resolvida!')
 *         .then(result => showEmailResult('result', result));
 * </script>
 */
