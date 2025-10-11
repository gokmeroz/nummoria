// backend/src/routes/contact.js
import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// Build a transporter based on provider (env)
function makeTransport() {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "gmail") {
    // Gmail/Google Workspace with App Password
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.CONTACT_EMAIL, // MUST be the same account the app password was created for
        pass: process.env.CONTACT_PASS,
      },
    });
  }

  if (provider === "mailtrap") {
    return nodemailer.createTransport({
      host: "smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    });
  }

  // Generic SMTP fallback
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: !!Number(process.env.SMTP_SECURE || 0),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Create once
const transporter = makeTransport();

router.post("/", async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Optional: verify SMTP connection on first use
    if (typeof transporter._verified === "undefined") {
      await transporter.verify();
      transporter._verified = true;
    }

    const to = process.env.CONTACT_RECEIVER || process.env.CONTACT_EMAIL;
    const fromSupport = process.env.CONTACT_EMAIL; // authenticated sender

    const info = await transporter.sendMail({
      from: `"Nummoria Support" <${fromSupport}>`, // MUST match the authenticated account/domain
      to, // where you want to receive messages
      cc: fromSupport, // also drop a copy to your support mailbox (visible in Inbox)
      replyTo: `"${name}" <${email}>`, // reply goes to the user
      subject: `Nummoria Contact — ${name}`,
      text: message,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 8px">New contact message</h2>
          <p style="margin:0 0 12px"><b>From:</b> ${name} &lt;${email}&gt;</p>
          <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;margin:0">${escapeHtml(
            message
          )}</pre>
        </div>
      `,
    });

    // Log for debugging; do not expose full details to client
    console.log("CONTACT sent:", info.messageId);

    res.json({ message: "✅ Message sent successfully!" });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    const hint =
      err?.code === "EAUTH"
        ? "Authentication failed. If using Gmail, use an App Password and make sure CONTACT_EMAIL matches that account."
        : "Failed to send email.";
    res.status(500).json({ error: hint });
  }
});

// Simple HTML escaper for safety
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default router;
