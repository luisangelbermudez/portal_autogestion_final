const { pool } = require("../config/db");
const { hashear } = require("../utils/passwords");
const { validarUsuario, validarPersona, nombreCompleto, texto } = require("../utils/validaciones");
const { manejarError } = require("../utils/errores");

const COLUMNAS = `id_usuario, nombre, correo, id_rol, id_estado, tipo_documento, numero_documento,
  primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, genero`;

// Los datos personales se validan juntos; el nombre completo se arma automáticamente.
function validarDatos(b, { exigirContrasena }) {
  return validarPersona(b) || validarUsuario(b, { exigirContrasena });
}

// GET /api/usuarios            -> lista
// GET /api/usuarios?documento= -> consulta por número de documento (404 si no existe)
// GET /api/usuarios?id=        -> consulta por id interno
async function listarOConsultar(req, res) {
  try {
    const { id, documento } = req.query;
    if (id || documento) {
      const [rows] = await pool.query(
        `SELECT ${COLUMNAS} FROM usuarios WHERE ${id ? "id_usuario" : "numero_documento"} = ?`,
        [id || texto(documento)]
      );
      if (rows.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });
      return res.status(200).json(rows[0]);
    }
    const [rows] = await pool.query(`SELECT ${COLUMNAS} FROM usuarios ORDER BY primer_apellido, primer_nombre, id_usuario`);
    return res.status(200).json(rows);
  } catch (error) {
    return manejarError(res, error, "GET /api/usuarios");
  }
}

async function crear(req, res) {
  try {
    const b = req.body;
    const { correo, contrasena, idRol, idEstado } = b;
    if (!b.tipoDocumento || !b.numeroDocumento || !b.primerNombre || !b.primerApellido || !b.genero || !correo || !contrasena || !idRol) {
      return res.status(400).json({
        mensaje: "Faltan campos obligatorios: tipoDocumento, numeroDocumento, primerNombre, primerApellido, genero, correo, contrasena, idRol",
      });
    }
    const errorValidacion = validarDatos(b, { exigirContrasena: true });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [result] = await pool.query(
      `INSERT INTO usuarios (tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido,
         segundo_apellido, genero, nombre, correo, contrasena, id_rol, id_estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.tipoDocumento, texto(b.numeroDocumento), texto(b.primerNombre), texto(b.segundoNombre) || null, texto(b.primerApellido),
       texto(b.segundoApellido) || null, b.genero, nombreCompleto(b), texto(correo).toLowerCase(), await hashear(contrasena), idRol, idEstado || 1]
    );
    return res.status(201).json({ mensaje: "Usuario creado correctamente", idUsuario: result.insertId });
  } catch (error) {
    return manejarError(res, error, "POST /api/usuarios");
  }
}

async function actualizar(req, res) {
  let conexion;
  try {
    const b = req.body;
    const { idUsuario, correo, contrasena, idRol, idEstado } = b;
    if (!idUsuario) return res.status(400).json({ mensaje: "No se indicó el usuario a actualizar" });
    if (idEstado === undefined) return res.status(400).json({ mensaje: "El campo idEstado es obligatorio" });

    const errorValidacion = validarDatos(b, { exigirContrasena: false });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [existe] = await pool.query("SELECT id_usuario FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    if (existe.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });

    // Un administrador no puede quitarse a sí mismo el rol ni desactivarse (quedaría fuera del sistema).
    if (Number(idUsuario) === req.usuario.idUsuario && (Number(idRol) !== 1 || Number(idEstado) !== 1)) {
      return res.status(400).json({ mensaje: "No puedes cambiar tu propio rol ni desactivar tu propio usuario" });
    }

    const campos = [b.tipoDocumento, texto(b.numeroDocumento), texto(b.primerNombre), texto(b.segundoNombre) || null,
      texto(b.primerApellido), texto(b.segundoApellido) || null, b.genero, nombreCompleto(b), texto(correo).toLowerCase(), idRol, idEstado];
    let sql = `UPDATE usuarios SET tipo_documento = ?, numero_documento = ?, primer_nombre = ?, segundo_nombre = ?,
      primer_apellido = ?, segundo_apellido = ?, genero = ?, nombre = ?, correo = ?, id_rol = ?, id_estado = ?`;
    if (contrasena) {
      sql += ", contrasena = ?";
      campos.push(await hashear(contrasena));
    }
    sql += " WHERE id_usuario = ?";
    campos.push(idUsuario);

    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    await conexion.query(sql, campos);
    // La cédula del perfil de empleado siempre es la del documento del usuario.
    await conexion.query("UPDATE empleados SET cedula = ? WHERE id_usuario = ?", [texto(b.numeroDocumento), idUsuario]);
    await conexion.commit();
    return res.status(200).json({ mensaje: "Usuario actualizado correctamente" });
  } catch (error) {
    if (conexion) await conexion.rollback().catch(() => {});
    return manejarError(res, error, "PUT /api/usuarios");
  } finally {
    if (conexion) conexion.release();
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
