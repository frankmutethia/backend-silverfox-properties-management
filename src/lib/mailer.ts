import nodemailer from "nodemailer";
import { config } from "../config.js";

export type Mail = { to: string; subject: string; text: string; html: string };

export const outbox: Mail[] = [];

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(mail: Mail) {
  if (config.NODE_ENV === "test") {
    outbox.push(mail);
    return;
  }
  if (!transport) {
    if (config.isProduction) throw new Error("SMTP is not configured; cannot send email.");
    console.info(`[mail] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
    return;
  }
  await transport.sendMail({ from: config.MAIL_FROM, ...mail });
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function passwordResetMail(to: string, name: string, link: string): Mail {
  return {
    to,
    subject: "Reset your Silverfox staff password",
    text: `Hello ${name},\n\nUse this link to choose a new password. It expires in 60 minutes and can be used once:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escape(name)},</p><p>Use this link to choose a new password. It expires in 60 minutes and can be used once:</p><p><a href="${escape(link)}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}
