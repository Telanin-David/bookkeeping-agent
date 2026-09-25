import sgMail from '@sendgrid/mail';
import { config } from '../config';

sgMail.setApiKey(config.sendgrid.apiKey);

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!config.sendgrid.apiKey) {
    console.warn(`[email] SendGrid not configured — skipping email to ${to}`);
    return;
  }
  await sgMail.send({ to, from: config.sendgrid.fromEmail, subject, html });
}

export async function sendAlertEmail(to: string, alertMessage: string, shopName: string): Promise<void> {
  await sendEmail(
    to,
    `Bookkeeping Alert — ${shopName}`,
    `<p>${alertMessage}</p><p>Log in to your bookkeeping dashboard to take action.</p>`,
  );
}

export async function sendReportEmail(to: string, reportType: string, pdfBuffer: Buffer): Promise<void> {
  if (!config.sendgrid.apiKey) {
    console.warn('[email] SendGrid not configured — skipping report email');
    return;
  }
  await sgMail.send({
    to,
    from: config.sendgrid.fromEmail,
    subject: `Your ${reportType} Report`,
    text: `Please find your ${reportType} report attached.`,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `${reportType.toLowerCase().replace(/\s+/g, '-')}-report.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }],
  });
}
