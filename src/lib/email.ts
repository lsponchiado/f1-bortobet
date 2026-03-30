import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@bortobet.com';

export async function sendPasswordResetEmail(to: string, code: string) {
  await transporter.sendMail({
    from: `"F1 Bortobet" <${FROM}>`,
    to,
    subject: 'Código de recuperação de senha - F1 Bortobet',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #15151e; color: #fff; border-radius: 16px; overflow: hidden;">
        <div style="height: 4px; background: #e10600;"></div>
        <div style="padding: 32px;">
          <h1 style="color: #e10600; font-size: 24px; font-style: italic; margin: 0 0 8px;">F1 BORTOBET</h1>
          <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 24px;">Recuperação de Senha</p>
          <p style="color: #d1d5db; font-size: 14px; margin: 0 0 24px;">Use o código abaixo para redefinir sua senha. Ele expira em <strong>15 minutos</strong>.</p>
          <div style="background: #1f1f27; border: 1px solid #374151; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #fff;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 12px; margin: 0;">Se você não solicitou essa recuperação, ignore este e-mail.</p>
        </div>
      </div>
    `,
  });
}
