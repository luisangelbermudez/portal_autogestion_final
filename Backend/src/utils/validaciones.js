// Validaciones de entrada. Cada función devuelve un texto con el error o null si todo está bien.
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());

function validarTexto(valor, etiqueta, min, max) {
  const t = texto(valor);
  if (t.length < min) return `${etiqueta} es obligatorio${min > 1 ? ` (mínimo ${min} caracteres)` : ""}`;
  if (t.length > max) return `${etiqueta} no puede superar ${max} caracteres`;
  return null;
}

function validarCorreo(valor) {
  const t = texto(valor);
  if (!t) return "El correo es obligatorio";
  if (t.length > 100 || !REGEX_CORREO.test(t)) return "El correo no tiene un formato válido";
  return null;
}

function validarContrasena(valor) {
  const t = String(valor ?? "");
  if (t.length < 6) return "La contraseña debe tener mínimo 6 caracteres";
  if (t.length > 72) return "La contraseña no puede superar 72 caracteres";
  return null;
}

// Acepta "AAAA-MM-DD", "DD/MM/AAAA", Date o número de serie de Excel. Devuelve "AAAA-MM-DD" o null.
function normalizarFecha(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  let d = null;
  if (valor instanceof Date) d = valor;
  else if (typeof valor === "number") d = new Date(Math.round((valor - 25569) * 86400 * 1000));
  else {
    const t = String(valor).trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  }
  if (!d || isNaN(d.getTime())) return null;
  const iso = d.toISOString().substring(0, 10);
  // Descarta fechas imposibles como 2026-02-31 (JavaScript las "corrige" al mes siguiente).
  if (typeof valor === "string") {
    const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m && iso !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  }
  return iso;
}

// ---- Datos personales: tipo de documento, número, nombres, apellidos y género ----
const TIPOS_DOCUMENTO = {
  CC: "Cédula de Ciudadanía",
  CE: "Cédula de Extranjería",
  PPT: "Permiso por Protección Temporal",
  PA: "Pasaporte",
};
const GENEROS = ["Masculino", "Femenino"];
const REGEX_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’ -]{1,49}$/;

// Acepta el código (CC) o el nombre (Cédula de Ciudadanía), sin importar mayúsculas ni tildes.
const sinTildes = (t) => texto(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function normalizarTipoDocumento(valor) {
  const v = sinTildes(valor);
  return Object.keys(TIPOS_DOCUMENTO).find((c) => c.toLowerCase() === v || sinTildes(TIPOS_DOCUMENTO[c]) === v) || null;
}
function normalizarGenero(valor) {
  const v = sinTildes(valor);
  if (["m", "masculino", "hombre"].includes(v)) return "Masculino";
  if (["f", "femenino", "mujer"].includes(v)) return "Femenino";
  return null;
}

function validarDocumento(tipoDocumento, numeroDocumento) {
  if (!TIPOS_DOCUMENTO[tipoDocumento]) return "El tipo de documento no es válido";
  const n = texto(numeroDocumento);
  if (tipoDocumento === "PA") {
    return /^[A-Za-z0-9]{5,20}$/.test(n) ? null : "El número de pasaporte debe tener entre 5 y 20 letras o números";
  }
  return /^\d{5,15}$/.test(n) ? null : "El número de documento debe contener solo números (entre 5 y 15 dígitos)";
}

function validarNombrePersona(valor, etiqueta, obligatorio) {
  const t = texto(valor);
  if (!t) return obligatorio ? `${etiqueta} es obligatorio` : null;
  return REGEX_NOMBRE.test(t) ? null : `${etiqueta} solo puede tener letras (entre 2 y 50 caracteres)`;
}

function validarPersona(p) {
  return (
    validarDocumento(p.tipoDocumento, p.numeroDocumento) ||
    validarNombrePersona(p.primerNombre, "El primer nombre", true) ||
    validarNombrePersona(p.segundoNombre, "El segundo nombre", false) ||
    validarNombrePersona(p.primerApellido, "El primer apellido", true) ||
    validarNombrePersona(p.segundoApellido, "El segundo apellido", false) ||
    (!GENEROS.includes(p.genero) ? "El género debe ser Masculino o Femenino" : null)
  );
}

const nombreCompleto = (p) =>
  [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido].map(texto).filter(Boolean).join(" ");

// Para archivos antiguos con una sola columna "nombre": 2 palabras = nombre + apellido,
// 3 = nombre + 2 apellidos, 4 o más = 2 nombres + 2 apellidos.
function dividirNombre(nombre) {
  const p = texto(nombre).split(/\s+/).filter(Boolean);
  if (p.length >= 4) return { primerNombre: p[0], segundoNombre: p[1], primerApellido: p[2], segundoApellido: p.slice(3).join(" ") };
  if (p.length === 3) return { primerNombre: p[0], segundoNombre: "", primerApellido: p[1], segundoApellido: p[2] };
  if (p.length === 2) return { primerNombre: p[0], segundoNombre: "", primerApellido: p[1], segundoApellido: "" };
  return { primerNombre: p[0] || "", segundoNombre: "", primerApellido: "", segundoApellido: "" };
}

function validarUsuario({ correo, contrasena, idRol, idEstado }, { exigirContrasena }) {
  return (
    validarCorreo(correo) ||
    (exigirContrasena || contrasena ? validarContrasena(contrasena) : null) ||
    (![1, 2].includes(Number(idRol)) ? "El rol debe ser 1 (Administrador) o 2 (Empleado)" : null) ||
    (idEstado !== undefined && ![1, 2].includes(Number(idEstado)) ? "El estado debe ser 1 (Activo) o 2 (Inactivo)" : null)
  );
}

function validarEmpleado({ cedula, cargo, area, fechaIngreso, salario, promedioHorasExtras }, { exigirCedula = true } = {}) {
  const fecha = normalizarFecha(fechaIngreso);
  const sal = salario === undefined || salario === null || salario === "" ? 0 : Number(salario);
  const hor = promedioHorasExtras === undefined || promedioHorasExtras === null || promedioHorasExtras === "" ? 0 : Number(promedioHorasExtras);
  if (exigirCedula && !/^\d{5,15}$/.test(texto(cedula))) return "La cédula debe contener solo números (entre 5 y 15 dígitos)";
  return (
    validarTexto(cargo, "El cargo", 2, 100) ||
    validarTexto(area, "El área", 2, 100) ||
    (!fecha ? "La fecha de ingreso no es válida (use AAAA-MM-DD)" : null) ||
    (fecha > new Date().toISOString().substring(0, 10) ? "La fecha de ingreso no puede ser futura" : null) ||
    (isNaN(sal) || sal < 0 || sal > 999999999.99 ? "El salario debe ser un número mayor o igual a 0" : null) ||
    (isNaN(hor) || hor < 0 || hor > 999.99 ? "El promedio de horas extras debe ser un número mayor o igual a 0" : null)
  );
}

function validarSolicitud({ tipoSolicitud, descripcion }) {
  return (
    validarTexto(tipoSolicitud, "El tipo de solicitud", 2, 100) ||
    (texto(descripcion).length > 1000 ? "La descripción no puede superar 1000 caracteres" : null)
  );
}

module.exports = { TIPOS_DOCUMENTO, GENEROS, validarDocumento, validarPersona, nombreCompleto, dividirNombre, normalizarTipoDocumento, normalizarGenero, texto, validarTexto, validarCorreo, validarContrasena, normalizarFecha, validarUsuario, validarEmpleado, validarSolicitud };
