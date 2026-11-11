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
const DORADO = "#EF9F27";
const GRIS_TEXTO = "#333333";
const GRIS_CLARO = "#777777";

function generarPdfCertificado(rutaArchivo, { consecutivo, empleado, tipoCarta }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "LETTER" });
    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    const anchoPagina = doc.page.width;
    const margenLateral = 55;
    const anchoContenido = anchoPagina - margenLateral * 2;

    // ===== Encabezado con el banner del portal =====
    const altoEncabezado = 110;
    doc.rect(0, 0, anchoPagina, altoEncabezado).fill("#FFFFFF");
    if (fs.existsSync(RUTA_LOGO)) {
      doc.image(RUTA_LOGO, 0, 0, { fit: [anchoPagina, altoEncabezado], align: "center", valign: "center" });
    } else {
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(22)
        .text("PORTAL DE AUTOGESTIÓN", 0, 40, { align: "center", width: anchoPagina });
    }

    // Línea dorada decorativa bajo el encabezado
    doc.rect(0, altoEncabezado, anchoPagina, 5).fill(DORADO);

    // ===== Título del certificado =====
    doc.fillColor(GRIS_TEXTO);
    let y = altoEncabezado + 35;
    doc.font("Helvetica-Bold").fontSize(15).fillColor(AZUL)
      .text("CERTIFICACIÓN LABORAL", margenLateral, y, { align: "center", width: anchoContenido });
    y += 24;

    const subtitulos = {
      todos: null,
      sin_basico: "(sin salario básico)",
      con_extras: "(con horas extras)",
    };
    if (subtitulos[tipoCarta]) {
      doc.font("Helvetica-Oblique").fontSize(10).fillColor(GRIS_CLARO)
        .text(subtitulos[tipoCarta], margenLateral, y, { align: "center", width: anchoContenido });
      y += 16;
    }

    doc.font("Helvetica").fontSize(10).fillColor(GRIS_TEXTO)
      .text(`Consecutivo N.° ${consecutivo}`, margenLateral, y, { align: "center", width: anchoContenido });
    y += 14;
    doc.text(`Bogotá D.C., ${formatearFechaLarga(new Date())}`, margenLateral, y, { align: "center", width: anchoContenido });
    y += 34;

    // ===== Cuerpo del certificado =====
    doc.x = margenLateral;
    doc.y = y;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(AZUL).text("A quien pueda interesar:", { width: anchoContenido });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10.5).fillColor(GRIS_TEXTO).text(
      "El Portal de Autogestión certifica que el/la señor(a):",
      { align: "justify", width: anchoContenido }
    );
    doc.moveDown(0.8);

    // Recuadro con los datos del empleado
    const inicioRecuadro = doc.y;
    const campos = [
      ["Nombre completo", empleado.nombre],
      ["Cédula de ciudadanía", empleado.cedula],
      ["Cargo", empleado.cargo],
      ["Área / Departamento", empleado.area],
      ["Fecha de ingreso", formatearFechaCorta(empleado.fecha_ingreso)],
    ];
    if (tipoCarta === "todos") campos.push(["Salario básico mensual", formatearMoneda(empleado.salario)]);
    if (tipoCarta === "con_extras") campos.push(["Promedio de horas extras (últimos 3 meses)", `${empleado.promedio_horas_extras} horas`]);

    const altoFila = 20;
    const altoRecuadro = campos.length * altoFila + 16;
    doc.roundedRect(margenLateral, inicioRecuadro, anchoContenido, altoRecuadro, 5)
      .fillAndStroke("#F5F7FC", "#DCE3F5");

    let yCampo = inicioRecuadro + 10;
    campos.forEach(([etiqueta, valor]) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(AZUL)
        .text(`${etiqueta}:`, margenLateral + 14, yCampo, { continued: false, width: 220 });
      doc.font("Helvetica").fontSize(10).fillColor(GRIS_TEXTO)
        .text(valor, margenLateral + 240, yCampo, { width: anchoContenido - 254 });
      yCampo += altoFila;
    });

    doc.x = margenLateral;
    doc.y = inicioRecuadro + altoRecuadro + 18;

    const clausulaSalario = tipoCarta === "todos"
      ? ", devengando el salario básico mensual indicado"
      : "";

    doc.font("Helvetica").fontSize(10.5).fillColor(GRIS_TEXTO).text(
      `Se certifica que el/la empleado(a) se encuentra activo(a) en nuestra empresa${clausulaSalario} ` +
      "con todos los beneficios de ley del Código Sustantivo del Trabajo de Colombia.",
      { align: "justify", width: anchoContenido }
    );
    doc.moveDown(0.6);
    doc.text("La presente certificación se expide con veracidad y es válida a la fecha indicada.", { align: "justify", width: anchoContenido });

    doc.moveDown(3);
    doc.fillColor(GRIS_TEXTO).text("______________________________", { width: anchoContenido });
    doc.font("Helvetica-Bold").fillColor(AZUL).text("Recursos Humanos — Portal de Autogestión", { width: anchoContenido });
    doc.font("Helvetica").fontSize(9).fillColor(GRIS_CLARO).text("Firma autorizada / Sello empresa", { width: anchoContenido });

    // ===== Pie de página con franja azul =====
    const altoPie = 34;
    doc.rect(0, doc.page.height - altoPie, anchoPagina, altoPie).fill(AZUL);
    doc.fontSize(8).fillColor("#D8E1FA").text(
      `Portal de Autogestión © ${new Date().getFullYear()} | Documento generado electrónicamente | Consecutivo N.° ${consecutivo}`,
      margenLateral, doc.page.height - altoPie + 12, { align: "center", width: anchoContenido }
    );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

module.exports = { listarOConsultar, generar };
