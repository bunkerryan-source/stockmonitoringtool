import * as nodemailer from 'nodemailer';

export async function sendEmail(
  to: string,
  from: string,
  subject: string,
  html: string
): Promise<void> {
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!appPassword) {
    throw new Error(
      'GMAIL_APP_PASSWORD not set in .env file. See README for setup instructions.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: from,
      pass: appPassword,
    },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  console.log(`Email sent to ${to}`);
}
