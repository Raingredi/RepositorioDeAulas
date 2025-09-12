// global/mailer.js

let emailConfig = null;

/**
 * Initializes the EmailJS service with the provided or fetched configuration.
 * @param {object} [config] - Optional email configuration.
 */
export async function initializeEmailService(config = null) {
  try {
    if (config) {
      emailConfig = config;
    } else {
      const response = await fetch('/settings.json');
      const settings = await response.json();
      emailConfig = settings.email;
    }

    if (!emailConfig?.public_key) {
      console.warn('EmailJS public key not configured. Email sending will be disabled.');
      return;
    }

    // Initialize emailjs
    emailjs.init(emailConfig.public_key);
    console.log('EmailJS service initialized successfully.');

  } catch (error) {
    console.error('Failed to initialize email service:', error);
  }
}

/**
 * Sends an email using the initialized EmailJS service.
 * @param {object} emailData - The data for the email template.
 * @returns {Promise<boolean>} - True if the email was sent successfully.
 */
export async function sendEmail(emailData) {
  if (!emailConfig || !emailConfig.service_id || !emailConfig.template_id) {
    throw new Error('EmailJS is not configured or initialized properly.');
  }

  try {
    await emailjs.send(
      emailConfig.service_id,
      emailConfig.template_id,
      emailData
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
}
