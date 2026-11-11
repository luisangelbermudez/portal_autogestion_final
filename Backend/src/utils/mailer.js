// Envío real de correo con Nodemailer (SMTP). Se configura en el archivo .env.
const nodemailer = require("nodemailer");

function crearTransporte() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) {
    const error = new Error("SMTP no configurado");
    error.code = "SMTP_NO_CONFIGURADO";
    throw error;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === "true", // true solo para el puerto 465
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

async function enviarCertificado({ para, nombre, consecutivo, rutaPdf, nombreArchivo }) {
  const transporte = crearTransporte();
  await transporte.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: para,
    subject: `Certificación laboral N.° ${consecutivo} - Portal de Autogestión`,
    text:
      `Hola ${nombre},\n\nAdjunto encontrarás tu certificación laboral N.° ${consecutivo}, ` +
      "generada desde el Portal de Autogestión.\n\nPortal de Autogestión",
    attachments: [{ filename: nombreArchivo, path: rutaPdf }],
  });
}

module.exports = { enviarCertificado };
