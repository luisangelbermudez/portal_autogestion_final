// Autenticación con JWT y control de acceso por rol.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ID_ROL_ADMIN = 1;

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // Sin JWT_SECRET en el .env se usa una clave aleatoria: funciona, pero las sesiones
  // se invalidan cada vez que se reinicia el servidor. Defínela en el .env para producción.
  SECRET = crypto.randomBytes(32).toString("hex");
  if (process.env.NODE_ENV !== "test") {
    console.warn("[auth] JWT_SECRET no está definido en .env: se usa una clave temporal.");
  }
}
const EXPIRA = process.env.JWT_EXPIRES_IN || "8h";

function firmarToken(usuario) {
  return jwt.sign(
    { idUsuario: usuario.id_usuario, idRol: usuario.id_rol, nombre: usuario.nombre },
    SECRET,
    { expiresIn: EXPIRA }
  );
}

// Exige un token válido en el encabezado "Authorization: Bearer <token>".
function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const [esquema, token] = cabecera.split(" ");
  if (esquema !== "Bearer" || !token) {
    return res.status(401).json({ mensaje: "No autenticado: inicia sesión para continuar" });
  }
  try {
    req.usuario = jwt.verify(token, SECRET);
    return next();
  } catch (error) {
    const expirado = error.name === "TokenExpiredError";
    return res.status(401).json({ mensaje: expirado ? "Tu sesión expiró: inicia sesión nuevamente" : "Token inválido" });
  }
}

const esAdmin = (req) => req.usuario?.idRol === ID_ROL_ADMIN;

function soloAdmin(req, res, next) {
  if (!esAdmin(req)) {
    return res.status(403).json({ mensaje: "No tienes permiso para realizar esta acción" });
  }
  return next();
}

module.exports = { firmarToken, autenticar, soloAdmin, esAdmin, ID_ROL_ADMIN };
