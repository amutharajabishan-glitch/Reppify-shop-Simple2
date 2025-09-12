// /lib/mailer.js
import nodemailer from "nodemailer";

let transporter;

export function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT) === "465", // 465 => SSL, sonst STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    tls: { rejectUnauthorized: true },
  });

  return transporter;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
    replyTo,
  });
  return info;
}
