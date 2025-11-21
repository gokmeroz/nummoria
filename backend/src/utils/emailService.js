// src/utils/emailService.js
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn("⚠️ SMTP env vars missing, email sending will fail.");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return info;
}

// --- specific helpers ---

export function sendPurchaseEmail({ to, name, productName, amount, date }) {
  const subject = `Your purchase on Nummoria`;
  const text = `
Hi ${name},

Thanks for your purchase!

Product: ${productName}
Amount: ${amount}
Date: ${date.toISOString()}

You can always see your purchases in your Nummoria account.

Best,
Nummoria
  `.trim();

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px;">
      <h2 style="color:#4f772d;">Thanks for your purchase, ${name}!</h2>
      <p>Here are your purchase details:</p>
      <ul>
        <li><strong>Product:</strong> ${productName}</li>
        <li><strong>Amount:</strong> ${amount}</li>
        <li><strong>Date:</strong> ${date.toISOString().slice(0, 10)}</li>
      </ul>
      <p>You can review this anytime in your Nummoria account.</p>
      <p style="margin-top:24px;color:#6b7280;">— Nummoria</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}

export function sendRenewalReminderEmail({
  to,
  name,
  planName,
  renewAt,
  daysLeft,
}) {
  const subject = `Your ${planName} plan renews in ${daysLeft} days`;
  const text = `
Hi ${name},

Just a heads-up: your ${planName} plan will renew on ${renewAt
    .toISOString()
    .slice(0, 10)} (in about ${daysLeft} days).

If you want to update billing or cancel auto-renew, log in to your Nummoria account.

Best,
Nummoria
  `.trim();

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px;">
      <h2 style="color:#4f772d;">Heads up, ${name} 👋</h2>
      <p>Your <strong>${planName}</strong> plan will renew soon.</p>
      <p>
        <strong>Renewal date:</strong> ${renewAt
          .toISOString()
          .slice(0, 10)}<br/>
        <strong>Time left:</strong> ~${daysLeft} days
      </p>
      <p>
        If you want to update billing or cancel auto-renew,
        please log in to your Nummoria account.
      </p>
      <p style="margin-top:24px;color:#6b7280;">— Nummoria</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}
