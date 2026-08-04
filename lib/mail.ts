import "server-only";
import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const url = process.env.EMAIL_SERVER;
  if (!url) return null;
  cachedTransporter = nodemailer.createTransport(url);
  return cachedTransporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mail] EMAIL_SERVER not set, skipping:", opts.subject);
    return { skipped: true };
  }
  // EMAIL_FROM must be an address your SMTP provider is allowed to send as.
  const from = process.env.EMAIL_FROM ?? "TMS <no-reply@tms.sohotransllc.com>";
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { skipped: false };
}
