const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { pool } = require("../config/db");
const { esAdmin } = require("../utils/auth");
const { enviarCertificado } = require("../utils/mailer");
const { manejarError } = require("../utils/errores");

const TIPO_CARTA_A_ID = {
  todos: 1,
  sin_basico: 2,
  con_extras: 3,
};

const CARPETA_CERTIFICADOS = path.join(__dirname, "..", "..", "certificados");
if (!fs.existsSync(CARPETA_CERTIFICADOS)) {
  fs.mkdirSync(CARPETA_CERTIFICADOS, { recursive: true });
}

const prohibido = (res) => res.status(403).json({ mensaje: "No tienes permiso para realizar esta acción" });
const MAX_INTENTOS_CONSECUTIVO = 3;

async function listarOConsultar(req, res) {
  try {
    const { idEmpleado } = req.query;
    if (idEmpleado) {
      // Un empleado solo puede ver el historial de sus propios certificados.
      if (!esAdmin(req)) {
        const [duenio] = await pool.query("SELECT id_usuario FROM empleados WHERE id_empleado = ?", [idEmpleado]);
        if (duenio.length === 0 || duenio[0].id_usuario !== req.usuario.idUsuario) return prohibido(res);
      }
      const [rows] = await pool.query(
        "SELECT * FROM certificados WHERE id_empleado = ? ORDER BY fecha_generacion DESC",
        [idEmpleado]
      );
      return res.status(200).json(rows);
    }
    if (!esAdmin(req)) return prohibido(res);
    const [rows] = await pool.query("SELECT * FROM certificados ORDER BY fecha_generacion DESC");
    return res.status(200).json(rows);
  } catch (error) {
    return manejarError(res, error, "GET /api/certificados");
  }
}

// Reserva el siguiente consecutivo. La columna tiene restriccion UNIQUE, asi que si dos
// personas generan a la vez y chocan (ER_DUP_ENTRY), se recalcula y se reintenta.
async function registrarCertificado({ empleado, idTipo, incluyeSueldo, canal }) {
  for (let intento = 1; intento <= MAX_INTENTOS_CONSECUTIVO; intento++) {
    const [maxRows] = await pool.query("SELECT MAX(consecutivo) AS maxConsecutivo FROM certificados");
    const consecutivo = (maxRows[0].maxConsecutivo || 0) + 1;
    const consecutivoFormateado = String(consecutivo).padStart(4, "0");
    const nombreArchivo = `CERT-${consecutivoFormateado}-${Date.now()}.pdf`;
    try {
      const [result] = await pool.query(
        `INSERT INTO certificados (id_empleado, id_tipo, consecutivo, incluye_sueldo, canal_entrega, archivo_pdf)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empleado.id_empleado, idTipo, consecutivo, incluyeSueldo, canal, nombreArchivo]
      );
      return { idCertificado: result.insertId, consecutivo, consecutivoFormateado, nombreArchivo };
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY" || intento === MAX_INTENTOS_CONSECUTIVO) throw error;
    }
  }
}

async function generar(req, res) {
  let registro = null;
  let rutaArchivo = null;
  let enviandoCorreo = false;
  try {
    const { idUsuario, tipoCarta, canal } = req.body;
    if (!idUsuario || !tipoCarta || !canal) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: idUsuario, tipoCarta, canal" });
    }
    const idTipo = TIPO_CARTA_A_ID[tipoCarta];
    if (!idTipo) {
      return res.status(400).json({ mensaje: "tipoCarta invalido. Use: todos, sin_basico o con_extras" });
    }
    if (!["pdf", "correo"].includes(canal)) {
      return res.status(400).json({ mensaje: "canal invalido. Use: pdf o correo" });
    }
    // Cada persona genera unicamente SUS certificados (se compara con el usuario del token).
    if (Number(idUsuario) !== req.usuario.idUsuario) return prohibido(res);

    const [empleados] = await pool.query(
      `SELECT e.*, u.nombre, u.correo
       FROM empleados e
       JOIN usuarios u ON u.id_usuario = e.id_usuario
       WHERE e.id_usuario = ?`,
      [idUsuario]
    );
    if (empleados.length === 0) {
      return res.status(404).json({ mensaje: "No se encontro un perfil de empleado para este usuario" });
    }
    const empleado = empleados[0];

    const incluyeSueldo = tipoCarta === "todos" ? 1 : 0;
    registro = await registrarCertificado({ empleado, idTipo, incluyeSueldo, canal });

    rutaArchivo = path.join(CARPETA_CERTIFICADOS, registro.nombreArchivo);
    await generarPdfCertificado(rutaArchivo, { consecutivo: registro.consecutivoFormateado, empleado, tipoCarta });

    if (canal === "correo") {
      enviandoCorreo = true;
      await enviarCertificado({
        para: empleado.correo,
        nombre: empleado.nombre,
        consecutivo: registro.consecutivoFormateado,
        rutaPdf: rutaArchivo,
        nombreArchivo: registro.nombreArchivo,
      });
      return res.status(200).json({
        mensaje: `Certificado N. ${registro.consecutivoFormateado} enviado al correo: ${empleado.correo}`,
        consecutivo: registro.consecutivo,
      });
    }

    return res.download(rutaArchivo, registro.nombreArchivo);
  } catch (error) {
    // Si algo fallo despues de reservar el consecutivo, se deshace para no dejar registros fantasma.
    if (registro) {
      await pool.query("DELETE FROM certificados WHERE id_certificado = ?", [registro.idCertificado]).catch(() => {});
      if (rutaArchivo) fs.unlink(rutaArchivo, () => {});
    }
    if (error.code === "SMTP_NO_CONFIGURADO") {
      return res.status(503).json({
        mensaje: "El envio por correo no esta configurado en el servidor. Descarga el PDF o pide al administrador configurar el correo (SMTP).",
      });
    }
    if (enviandoCorreo) {
      console.error("Error enviando correo:", error.message);
      return res.status(502).json({ mensaje: "No se pudo enviar el correo. Intenta de nuevo o descarga el PDF." });
    }
    return manejarError(res, error, "POST /api/certificados");
  }
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatearFechaLarga(fecha) {
  const d = new Date(fecha);
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatearFechaCorta(fecha) {
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}

function formatearMoneda(valor) {
  return `$ ${Number(valor).toLocaleString("es-CO")}`;
}

const RUTA_LOGO = path.join(__dirname, "..", "..", "assets", "portal-autogestion.jpg");
const AZUL = "#0F2F80";
const AZUL_OSCURO = "#0A2266";
const AZUL_CLARO = "#EEF3FF";
const DORADO = "#EF9F27";
const GRIS_TEXTO = "#2B3042";
const GRIS_CLARO = "#6B7390";

function generarPdfCertificado(rutaArchivo, { consecutivo, empleado, tipoCarta }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "LETTER", info: { Title: `Certificación laboral N.° ${consecutivo}`, Author: "Portal de Autogestión" } });
    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;
    const margen = 56;
    const ancho = W - margen * 2;

    // ===== Marca de agua: anillos concéntricos muy tenues =====
    doc.save().opacity(0.045).lineWidth(26).circle(W / 2, H / 2 + 20, 210).stroke(AZUL)
      .lineWidth(8).circle(W / 2, H / 2 + 20, 245).stroke(DORADO).restore();

    // ===== Encabezado azul con logo y título =====
    const altoEnc = 124;
    doc.rect(0, 0, W, altoEnc).fill(AZUL_OSCURO);
    doc.save().rect(0, 0, W, altoEnc).clip().opacity(0.12).circle(W - 40, -10, 120).fill("#FFFFFF").circle(W - 150, altoEnc + 20, 70).fill(DORADO).restore();
    doc.roundedRect(margen - 6, 22, 226, 80, 10).fill("#FFFFFF");
    if (fs.existsSync(RUTA_LOGO)) {
      doc.image(RUTA_LOGO, margen - 2, 26, { fit: [218, 72], align: "center", valign: "center" });
    } else {
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(14).text("PORTAL DE AUTOGESTIÓN", margen, 54, { width: 214, align: "center" });
    }
    const xTitulo = margen + 240;
    const anchoTitulo = W - margen - xTitulo;
    doc.fillColor(DORADO).font("Helvetica-Bold").fontSize(9).text("DOCUMENTO OFICIAL", xTitulo, 34, { width: anchoTitulo, align: "right", characterSpacing: 2.5 });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(23).text("CERTIFICACIÓN", xTitulo, 50, { width: anchoTitulo, align: "right" });
    doc.text("LABORAL", xTitulo, 76, { width: anchoTitulo, align: "right" });
    doc.rect(0, altoEnc, W, 5).fill(DORADO);

    // ===== Consecutivo y fecha =====
    let y = altoEnc + 28;
    const etiquetaNum = `N.° ${consecutivo}`;
    doc.font("Helvetica-Bold").fontSize(10);
    const anchoNum = doc.widthOfString(etiquetaNum) + 24;
    doc.roundedRect(margen, y - 4, anchoNum, 22, 11).fill(AZUL_CLARO);
    doc.fillColor(AZUL).text(etiquetaNum, margen, y + 2, { width: anchoNum, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor(GRIS_CLARO)
      .text(`Bogotá D.C., ${formatearFechaLarga(new Date())}`, margen, y + 2, { width: ancho, align: "right" });
    y += 38;

    const subtitulos = { todos: null, sin_basico: "Sin salario básico", con_extras: "Con promedio de horas extras" };
    if (subtitulos[tipoCarta]) {
      doc.font("Helvetica-Oblique").fontSize(10).fillColor(GRIS_CLARO).text(subtitulos[tipoCarta], margen, y - 6, { width: ancho, align: "center" });
      y += 12;
    }

    // ===== Saludo y presentación =====
    doc.font("Helvetica-Bold").fontSize(12).fillColor(AZUL).text("A quien pueda interesar:", margen, y, { width: ancho });
    y += 26;
    doc.font("Helvetica").fontSize(11).fillColor(GRIS_TEXTO)
      .text("El Portal de Autogestión certifica que el/la señor(a):", margen, y, { width: ancho });
    y += 34;

    // ===== Nombre destacado =====
    doc.font("Helvetica-Bold").fontSize(21).fillColor(AZUL).text(String(empleado.nombre || "").toUpperCase(), margen, y, { width: ancho, align: "center" });
    y = doc.y + 6;
    doc.rect(W / 2 - 40, y, 80, 3).fill(DORADO);
    y += 14;
    doc.font("Helvetica").fontSize(11).fillColor(GRIS_TEXTO)
      .text(`identificado(a) con cédula de ciudadanía N.° ${empleado.cedula}`, margen, y, { width: ancho, align: "center" });
    y += 36;

    // ===== Datos laborales =====
    const campos = [
      ["Cargo", empleado.cargo],
      ["Área / Departamento", empleado.area],
      ["Fecha de ingreso", formatearFechaCorta(empleado.fecha_ingreso)],
    ];
    if (tipoCarta === "todos") campos.push(["Salario básico mensual", formatearMoneda(empleado.salario)]);
    if (tipoCarta === "con_extras") campos.push(["Promedio horas extras (3 meses)", `${empleado.promedio_horas_extras} horas`]);

    const altoFila = 28;
    const altoCard = campos.length * altoFila;
    doc.roundedRect(margen, y, ancho, altoCard, 8).fill("#F7F9FE");
    campos.forEach(([etiqueta, valor], i) => {
      const yf = y + i * altoFila;
      if (i % 2 === 1) doc.save().rect(margen + 5, yf, ancho - 5, altoFila).fill("#EEF3FF").restore();
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GRIS_CLARO)
        .text(etiqueta.toUpperCase(), margen + 20, yf + 10, { width: 230, characterSpacing: 0.4 });
      doc.font("Helvetica-Bold").fontSize(11).fillColor(GRIS_TEXTO)
        .text(String(valor), margen + 262, yf + 8.5, { width: ancho - 276 });
    });
    doc.roundedRect(margen, y, 5, altoCard, 2.5).fill(DORADO);
    y += altoCard + 28;

    // ===== Cláusulas =====
    const clausulaSalario = tipoCarta === "todos" ? ", devengando el salario básico mensual indicado" : "";
    doc.font("Helvetica").fontSize(11).fillColor(GRIS_TEXTO).text(
      `Se certifica que el/la empleado(a) se encuentra activo(a) en nuestra empresa${clausulaSalario} ` +
      "con todos los beneficios de ley del Código Sustantivo del Trabajo de Colombia.",
      margen, y, { align: "justify", width: ancho, lineGap: 3 }
    );
    doc.moveDown(0.7);
    doc.text("La presente certificación se expide con veracidad y es válida a la fecha indicada.", margen, doc.y, { align: "justify", width: ancho, lineGap: 3 });

    // ===== Firma y sello =====
    const yFirma = H - 170;
    doc.moveTo(margen, yFirma).lineTo(margen + 230, yFirma).lineWidth(1).stroke(AZUL);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(AZUL).text("Recursos Humanos", margen, yFirma + 8, { width: 260 });
    doc.font("Helvetica").fontSize(9.5).fillColor(GRIS_CLARO)
      .text("Portal de Autogestión", margen, yFirma + 23, { width: 260 })
      .text("Firma autorizada / Sello empresa", margen, yFirma + 36, { width: 260 });

    const cx = W - margen - 48;
    const cy = yFirma - 6;
    doc.lineWidth(3).circle(cx, cy, 46).stroke(DORADO).lineWidth(1).circle(cx, cy, 39).stroke(AZUL);
    doc.circle(cx, cy, 34).fill(AZUL_CLARO);
    doc.lineWidth(3).lineCap("round").lineJoin("round").moveTo(cx - 12, cy - 6).lineTo(cx - 4, cy + 3).lineTo(cx + 12, cy - 15).stroke(DORADO);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(AZUL).text("DOCUMENTO", cx - 34, cy + 9, { width: 68, align: "center", characterSpacing: 1 });
    doc.text("VÁLIDO", cx - 34, cy + 20, { width: 68, align: "center", characterSpacing: 1.5 });

    // ===== Pie de página =====
    const altoPie = 40;
    doc.rect(0, H - altoPie - 4, W, 4).fill(DORADO);
    doc.rect(0, H - altoPie, W, altoPie).fill(AZUL_OSCURO);
    doc.font("Helvetica").fontSize(8).fillColor("#D8E1FA").text(
      `Portal de Autogestión © ${new Date().getFullYear()}  ·  Documento generado electrónicamente  ·  Consecutivo N.° ${consecutivo}`,
      margen, H - altoPie + 15, { align: "center", width: ancho }
    );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

module.exports = { listarOConsultar, generar, generarPdfCertificado };
