import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeHtml } from "../utils/sanitize.js";
import { RESET_TOKEN_MINUTES } from "../models/User.model.js";

const createTransport = () => {
  if (!env.smtp.isConfigured) return null;
  return nodemailer.createTransport({
    connectionTimeout: 10000,
    socketTimeout: 15000,
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
};

export const sendEnquiryNotificationEmail = async (enquiry) => {
  const transport = createTransport();
  if (!transport) throw new Error("SMTP is not configured");
  if (!env.smtp.notificationTo) throw new Error("SMTP notification recipient is not configured");
  const result = await transport.sendMail({
    from: env.smtp.from,
    to: env.smtp.notificationTo,
    subject: "New Silverfox property enquiry",
    text: `Name: ${enquiry.name}\n\n${enquiry.message}\n\nReference: ${enquiry._id}`,
    html: `<h2>New enquiry</h2><p><strong>Name:</strong> ${escapeHtml(enquiry.name)}</p><p>${escapeHtml(enquiry.message).replace(/\n/g, "<br>")}</p>`,
  });
  if (!result.accepted?.length) throw new Error("Email was not accepted");
};

export const verifySmtpConnection = async () => {
  const transport = createTransport();
  if (!transport) return { ok: false, reason: "not_configured" };
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

export const sendPasswordResetEmail = async (to, name, resetUrl) => {
  const transport = createTransport();

  if (!transport) {
    if (!env.isProd) return { devMode: true, resetUrl };
    throw new ApiError(503, "Email service is not configured");
  }

  await transport.sendMail({
    from: env.smtp.from,
    to,
    subject: "Reset your Silverfox staff password",
    text: `Hello ${name},\n\nUse this link to choose a new password. It expires in ${RESET_TOKEN_MINUTES} minutes and can be used once:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use this link to choose a new password. It expires in ${RESET_TOKEN_MINUTES} minutes and can be used once:</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { devMode: false };
};

export const sendTestimonialNotificationEmail = async (testimonial) => {
  const transport = createTransport();
  if (!transport) {
    if (env.isProd) console.error("[email] Testimonial notification skipped: SMTP is not configured");
    return { sent: false };
  }

  const rating = `${testimonial.rating}/5`;
  await transport.sendMail({
    from: env.smtp.from,
    to: env.smtp.from,
    subject: `New testimonial — ${testimonial.name} (${rating})`,
    text: [
      "New testimonial submitted — pending review",
      "",
      `Name: ${testimonial.name}`,
      `Rating: ${rating}`,
      "",
      testimonial.comment,
      "",
      "Review and publish it from the staff workspace.",
    ].join("\n"),
    html: `<h2>New testimonial submitted — pending review</h2><p><strong>Name:</strong> ${escapeHtml(testimonial.name)}</p><p><strong>Rating:</strong> ${rating}</p><p>${escapeHtml(testimonial.comment).replace(/\n/g, "<br>")}</p><p>Review and publish it from the staff workspace.</p>`,
  });
  return { sent: true };
};
