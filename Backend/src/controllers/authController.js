const { pool } = require("../config/db");
const { firmarToken } = require("../utils/auth");
const { hashear, verificar } = require("../utils/passwords");
const { validarContrasena } = require("../utils/validaciones");
const { manejarError } = require("../utils/errores");
const limitador = require("../utils/limitador");

// POST /api/login
// body: { correo, contrasena }
// Responde { mensaje, token, usuario }. El token se envía en las demás peticiones
// con el encabezado "Authorization: Bearer <token>".
async function login(req, res) {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({ mensaje: "Correo y contrasena son obligatorios" });
    }

    if (limitador.bloqueado(req, correo)) {
      return res.status(429).json({ mensaje: "Demasiados intentos fallidos. Intenta de nuevo en 10 minutos" });
    }

    // ultimo_acceso se agrega con Database/migracion_ultimo_acceso.sql; si la columna
    // aun no existe, el login sigue funcionando sin ella.
    let rows;
    let tieneUltimoAcceso = true;
    try {
      [rows] = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena, u.id_rol, r.nombre_rol, u.id_estado, u.ultimo_acceso
         FROM usuarios u
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.correo = ?`,
        [correo]
      );
    } catch (error) {
      if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
      tieneUltimoAcceso = false;
      [rows] = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena, u.id_rol, r.nombre_rol, u.id_estado
         FROM usuarios u
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.correo = ?`,
        [correo]
      );
    }

    if (rows.length === 0) {
      limitador.registrarFallo(req, correo);
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    const usuario = rows[0];
    const { ok, migrar } = await verificar(contrasena, usuario.contrasena);
    if (!ok) {
      limitador.registrarFallo(req, correo);
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }
    limitador.limpiar(req, correo);

    if (usuario.id_estado !== 1) {
      return res.status(403).json({ mensaje: "El usuario se encuentra inactivo" });
    }

    // Si la contraseña seguía en texto plano, se convierte a hash en este primer ingreso.
    if (migrar) {
      await pool.query("UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?", [await hashear(contrasena), usuario.id_usuario]);
    }

    // Se devuelve el ingreso ANTERIOR (null si es el primero) y luego se registra el actual.
    const ultimoAcceso = tieneUltimoAcceso ? usuario.ultimo_acceso : null;
    if (tieneUltimoAcceso) {
      await pool.query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?", [usuario.id_usuario]);
    }

    return res.status(200).json({
      mensaje: "Inicio de sesion exitoso",
      token: firmarToken(usuario),
      usuario: {
        idUsuario: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        idRol: usuario.id_rol,
        rolNombre: usuario.nombre_rol,
        ultimoAcceso,
      },
    });
  } catch (error) {
    return manejarError(res, error, "POST /api/login");
  }
}

// PUT /api/login/contrasena  (requiere sesión)
// body: { actual, nueva }
async function cambiarContrasena(req, res) {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) {
      return res.status(400).json({ mensaje: "Debes indicar la contraseña actual y la nueva" });
    }
    const errorNueva = validarContrasena(nueva);
    if (errorNueva) return res.status(400).json({ mensaje: errorNueva });
    if (actual === nueva) {
      return res.status(400).json({ mensaje: "La nueva contraseña debe ser diferente a la actual" });
    }

    const [rows] = await pool.query("SELECT contrasena FROM usuarios WHERE id_usuario = ?", [req.usuario.idUsuario]);
    if (rows.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });

    const { ok } = await verificar(actual, rows[0].contrasena);
    if (!ok) return res.status(400).json({ mensaje: "La contraseña actual no es correcta" });

    await pool.query("UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?", [await hashear(nueva), req.usuario.idUsuario]);
    return res.status(200).json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    return manejarError(res, error, "PUT /api/login/contrasena");
  }
}

module.exports = { login, cambiarContrasena };
