// Limita los intentos fallidos de inicio de sesión (en memoria) para frenar la fuerza bruta.
const MAX_FALLOS = 5;
const VENTANA_MS = 10 * 60 * 1000;
const fallos = new Map(); // clave -> { cantidad, desde }

const clave = (req, correo) => `${req.ip}|${String(correo).toLowerCase()}`;

function bloqueado(req, correo) {
  const f = fallos.get(clave(req, correo));
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) {
    fallos.delete(clave(req, correo));
    return false;
  }
  return f.cantidad >= MAX_FALLOS;
}

function registrarFallo(req, correo) {
  const k = clave(req, correo);
  const f = fallos.get(k);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(k, { cantidad: 1, desde: Date.now() });
  else f.cantidad++;
}

const limpiar = (req, correo) => fallos.delete(clave(req, correo));
const reiniciarTodo = () => fallos.clear();

module.exports = { bloqueado, registrarFallo, limpiar, reiniciarTodo };
