// Manejo de contraseñas con bcrypt (bcryptjs: JavaScript puro, sin compilación nativa en Windows).
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const RONDAS = 10;
const esHash = (valor) => typeof valor === "string" && /^\$2[aby]\$/.test(valor);

const hashear = (contrasena) => bcrypt.hash(String(contrasena), RONDAS);

// Verifica una contraseña contra lo almacenado. Si lo almacenado todavía es texto plano
// (base de datos anterior a la migración) lo compara de forma segura y avisa con
// `migrar: true` para que quien llama lo convierta a hash en ese momento.
async function verificar(contrasena, almacenado) {
  if (esHash(almacenado)) {
    return { ok: await bcrypt.compare(String(contrasena), almacenado), migrar: false };
  }
  const a = Buffer.from(String(contrasena));
  const b = Buffer.from(String(almacenado ?? ""));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, migrar: ok };
}

module.exports = { hashear, verificar, esHash };
