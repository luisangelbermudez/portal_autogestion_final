const { pool } = require("../config/db");
const { esAdmin } = require("../utils/auth");
const { validarSolicitud, texto } = require("../utils/validaciones");
const { manejarError } = require("../utils/errores");

const ESTADO_PENDIENTE = 3;
const ESTADO_RECHAZADO = 6;
const ESTADOS_SOLICITUD = [3, 4, 5, 6]; // Pendiente, En revisión, Aprobado, Rechazado

// Solicitud + última respuesta escrita por el administrador (si existe).
const SELECT_SOLICITUD = `
  SELECT s.*,
    (SELECT r.mensaje FROM respuestas r
      WHERE r.id_solicitud = s.id_solicitud
      ORDER BY r.fecha_respuesta DESC, r.id_respuesta DESC LIMIT 1) AS respuesta
  FROM solicitudes s
`;

const prohibido = (res) => res.status(403).json({ mensaje: "No tienes permiso para realizar esta acción" });

// Devuelve el id_usuario dueño de un empleado (o null si no existe).
async function usuarioDeEmpleado(idEmpleado) {
  const [rows] = await pool.query("SELECT id_usuario FROM empleados WHERE id_empleado = ?", [idEmpleado]);
  return rows.length ? rows[0].id_usuario : null;
}

async function listarOConsultar(req, res) {
  try {
    const { id, empleado } = req.query;
    if (id) {
      const [rows] = await pool.query(`${SELECT_SOLICITUD} WHERE s.id_solicitud = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ mensaje: "Solicitud no encontrada" });
      if (!esAdmin(req) && (await usuarioDeEmpleado(rows[0].id_empleado)) !== req.usuario.idUsuario) return prohibido(res);
      return res.status(200).json(rows[0]);
    }
    if (empleado) {
      if (!esAdmin(req) && (await usuarioDeEmpleado(empleado)) !== req.usuario.idUsuario) return prohibido(res);
      const [rows] = await pool.query(`${SELECT_SOLICITUD} WHERE s.id_empleado = ? ORDER BY s.fecha_creacion DESC`, [empleado]);
      return res.status(200).json(rows);
    }
    // Todas las solicitudes: solo administradores.
    if (!esAdmin(req)) return prohibido(res);
    const [rows] = await pool.query(`${SELECT_SOLICITUD} ORDER BY s.fecha_creacion DESC`);
    return res.status(200).json(rows);
  } catch (error) {
    return manejarError(res, error, "GET /api/solicitudes");
  }
}

async function crear(req, res) {
  try {
    const { idEmpleado, tipoSolicitud, descripcion } = req.body;
    if (!idEmpleado || !tipoSolicitud) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: idEmpleado, tipoSolicitud" });
    }
    const errorValidacion = validarSolicitud(req.body);
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    // Un empleado solo puede radicar solicitudes a su nombre.
    const duenio = await usuarioDeEmpleado(idEmpleado);
    if (duenio === null) return res.status(404).json({ mensaje: "Empleado no encontrado" });
    if (!esAdmin(req) && duenio !== req.usuario.idUsuario) return prohibido(res);

    const [result] = await pool.query(
      "INSERT INTO solicitudes (id_empleado, id_estado, tipo_solicitud, descripcion) VALUES (?, ?, ?, ?)",
      [idEmpleado, ESTADO_PENDIENTE, texto(tipoSolicitud), texto(descripcion) || null]
    );
    return res.status(201).json({
      mensaje: "Solicitud enviada correctamente. Estado: Pendiente",
      idSolicitud: result.insertId,
    });
  } catch (error) {
    return manejarError(res, error, "POST /api/solicitudes");
  }
}

// PUT /api/solicitudes  (administrador)
// body: { idSolicitud, idEstado, mensaje? }  -> el mensaje queda guardado en la tabla respuestas.
// Al rechazar, el motivo (mensaje) es obligatorio.
async function actualizar(req, res) {
  try {
    const { idSolicitud, idEstado } = req.body;
    const mensaje = texto(req.body.mensaje);
    if (!idSolicitud || !idEstado) {
      return res.status(400).json({ mensaje: "Los campos idSolicitud e idEstado son obligatorios" });
    }
    if (!ESTADOS_SOLICITUD.includes(Number(idEstado))) {
      return res.status(400).json({ mensaje: "Estado inválido. Use 3 (Pendiente), 4 (En revisión), 5 (Aprobado) o 6 (Rechazado)" });
    }
    if (Number(idEstado) === ESTADO_RECHAZADO && !mensaje) {
      return res.status(400).json({ mensaje: "Indica el motivo del rechazo" });
    }
    if (mensaje.length > 1000) {
      return res.status(400).json({ mensaje: "El mensaje no puede superar 1000 caracteres" });
    }

    const [existe] = await pool.query("SELECT id_solicitud FROM solicitudes WHERE id_solicitud = ?", [idSolicitud]);
    if (existe.length === 0) return res.status(404).json({ mensaje: "Solicitud no encontrada" });

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query("UPDATE solicitudes SET id_estado = ? WHERE id_solicitud = ?", [idEstado, idSolicitud]);
      if (mensaje) {
        await conexion.query(
          "INSERT INTO respuestas (id_solicitud, id_usuario, mensaje) VALUES (?, ?, ?)",
          [idSolicitud, req.usuario.idUsuario, mensaje]
        );
      }
      await conexion.commit();
    } catch (errorTransaccion) {
      await conexion.rollback();
      throw errorTransaccion;
    } finally {
      conexion.release();
    }
    return res.status(200).json({ mensaje: "Estado actualizado correctamente" });
  } catch (error) {
    return manejarError(res, error, "PUT /api/solicitudes");
  }
}

// DELETE /api/solicitudes?id=  -> el administrador siempre; el empleado solo sus solicitudes pendientes.
async function eliminar(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ mensaje: "El parametro id es obligatorio" });

    const [rows] = await pool.query("SELECT id_empleado, id_estado FROM solicitudes WHERE id_solicitud = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ mensaje: "Solicitud no encontrada" });

    if (!esAdmin(req)) {
      if ((await usuarioDeEmpleado(rows[0].id_empleado)) !== req.usuario.idUsuario) return prohibido(res);
      if (rows[0].id_estado !== ESTADO_PENDIENTE) {
        return res.status(409).json({ mensaje: "Solo puedes eliminar solicitudes que aún están pendientes" });
      }
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query("DELETE FROM respuestas WHERE id_solicitud = ?", [id]);
      await conexion.query("DELETE FROM solicitudes WHERE id_solicitud = ?", [id]);
      await conexion.commit();
    } catch (errorTransaccion) {
      await conexion.rollback();
      throw errorTransaccion;
    } finally {
      conexion.release();
    }
    return res.status(200).json({ mensaje: "Solicitud eliminada correctamente" });
  } catch (error) {
    return manejarError(res, error, "DELETE /api/solicitudes");
  }
}

module.exports = { listarOConsultar, crear, actualizar, eliminar };
