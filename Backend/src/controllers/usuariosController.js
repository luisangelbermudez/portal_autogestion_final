const { pool } = require("../config/db");
const { hashear } = require("../utils/passwords");
const { validarUsuario, texto } = require("../utils/validaciones");
const { manejarError } = require("../utils/errores");

async function listarOConsultar(req, res) {
  try {
    const { id } = req.query;
    if (id) {
      const [rows] = await pool.query(
        "SELECT id_usuario, nombre, correo, id_rol, id_estado FROM usuarios WHERE id_usuario = ?",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });
      return res.status(200).json(rows[0]);
    }
    const [rows] = await pool.query(
      "SELECT id_usuario, nombre, correo, id_rol, id_estado FROM usuarios ORDER BY id_usuario"
    );
    return res.status(200).json(rows);
  } catch (error) {
    return manejarError(res, error, "GET /api/usuarios");
  }
}

async function crear(req, res) {
  try {
    const { nombre, correo, contrasena, idRol, idEstado } = req.body;
    if (!nombre || !correo || !contrasena || !idRol) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: nombre, correo, contrasena, idRol" });
    }
    const errorValidacion = validarUsuario({ nombre, correo, contrasena, idRol, idEstado }, { exigirContrasena: true });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [result] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, contrasena, id_rol, id_estado) VALUES (?, ?, ?, ?, ?)",
      [texto(nombre), texto(correo).toLowerCase(), await hashear(contrasena), idRol, idEstado || 1]
    );
    return res.status(201).json({ mensaje: "Usuario creado correctamente", idUsuario: result.insertId });
  } catch (error) {
    return manejarError(res, error, "POST /api/usuarios");
  }
}

async function actualizar(req, res) {
  try {
    const { idUsuario, nombre, correo, idRol, idEstado, contrasena } = req.body;
    if (!idUsuario) return res.status(400).json({ mensaje: "El campo idUsuario es obligatorio" });
    if (idEstado === undefined) return res.status(400).json({ mensaje: "El campo idEstado es obligatorio" });

    const errorValidacion = validarUsuario({ nombre, correo, contrasena, idRol, idEstado }, { exigirContrasena: false });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [existe] = await pool.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    if (existe.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });

    // Un administrador no puede quitarse a sí mismo el rol ni desactivarse (quedaría fuera del sistema).
    if (Number(idUsuario) === req.usuario.idUsuario && (Number(idRol) !== 1 || Number(idEstado) !== 1)) {
      return res.status(400).json({ mensaje: "No puedes cambiar tu propio rol ni desactivar tu propio usuario" });
    }

    if (contrasena) {
      await pool.query(
        "UPDATE usuarios SET nombre = ?, correo = ?, id_rol = ?, id_estado = ?, contrasena = ? WHERE id_usuario = ?",
        [texto(nombre), texto(correo).toLowerCase(), idRol, idEstado, await hashear(contrasena), idUsuario]
      );
    } else {
      await pool.query(
        "UPDATE usuarios SET nombre = ?, correo = ?, id_rol = ?, id_estado = ? WHERE id_usuario = ?",
        [texto(nombre), texto(correo).toLowerCase(), idRol, idEstado, idUsuario]
      );
    }
    return res.status(200).json({ mensaje: "Usuario actualizado correctamente" });
  } catch (error) {
    return manejarError(res, error, "PUT /api/usuarios");
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ mensaje: "El parametro id es obligatorio" });
    if (Number(id) === req.usuario.idUsuario) {
      return res.status(400).json({ mensaje: "No puedes eliminar tu propio usuario" });
    }
    await pool.query("DELETE FROM usuarios WHERE id_usuario = ?", [id]);
    return res.status(200).json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    return manejarError(res, error, "DELETE /api/usuarios");
  }
}

module.exports = { listarOConsultar, crear, actualizar, eliminar };
