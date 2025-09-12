// global/mailer.js
export async function sendEmail(emailData, customConfig = null) {
    try {
      // se não passar customConfig, carrega settings.json
      let emailConfig = customConfig;
      if (!emailConfig) {
        const response = await fetch('/settings.json');
        const settings = await response.json();
        emailConfig = settings.email; // Changed from settings.emailjs to settings.email
      }
  
      if (!emailConfig?.service_id || !emailConfig?.template_id || !emailConfig?.public_key) {
        throw new Error('Configuração de email inválida.');
      }
  
      // Initialize emailjs if not already initialized
      if (!window.emailjs) {
        emailjs.init({
          publicKey: emailConfig.public_key,
          blockHeadless: true,
          blockList: {
            '\w+@email\.com': 'block' // Block emails with this domain
          },
          throttle: 50,
        });
      }
  
      await emailjs.send(
        emailConfig.service_id,
        emailConfig.template_id,
        emailData,
        emailConfig.public_key
      );
  
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw error;
    }
  }
  