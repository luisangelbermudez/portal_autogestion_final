const fs = require("fs");
const XLSX = require("xlsx");
const { pool } = require("../config/db");
const { esAdmin } = require("../utils/auth");
const { hashear } = require("../utils/passwords");
const { validarEmpleado, validarUsuario, normalizarFecha, texto } = require("../utils/validaciones");
const { manejarError } = require("../utils/errores");

// Consulta base con datos del usuario asociado (nombre, correo) unidos por JOIN
const SELECT_EMPLEADO_COMPLETO = `
  SELECT e.*, u.nombre, u.correo, u.id_rol, u.id_estado
  FROM empleados e
  JOIN usuarios u ON u.id_usuario = e.id_usuario
`;

const prohibido = (res) => res.status(403).json({ mensaje: "No tienes permiso para consultar esta información" });

async function listarOConsultar(req, res) {
  try {
    const { id, idUsuario } = req.query;

    if (id) {
      const [rows] = await pool.query(`${SELECT_EMPLEADO_COMPLETO} WHERE e.id_empleado = ?`, [id]);
      if (rows.length === 0) return res.status(404).json({ mensaje: "Empleado no encontrado" });
      if (!esAdmin(req) && rows[0].id_usuario !== req.usuario.idUsuario) return prohibido(res);
      return res.status(200).json(rows[0]);
    }

    if (idUsuario) {
      // Un empleado solo puede consultar su propio perfil.
      if (!esAdmin(req) && Number(idUsuario) !== req.usuario.idUsuario) return prohibido(res);
      const [rows] = await pool.query(`${SELECT_EMPLEADO_COMPLETO} WHERE e.id_usuario = ?`, [idUsuario]);
      if (rows.length === 0) return res.status(404).json({ mensaje: "Este usuario no tiene un perfil de empleado asociado" });
      return res.status(200).json(rows[0]);
    }

    // El listado completo (con cédulas y salarios) es solo para administradores.
    if (!esAdmin(req)) return prohibido(res);
    const [rows] = await pool.query(`${SELECT_EMPLEADO_COMPLETO} ORDER BY e.id_empleado`);
    return res.status(200).json(rows);
  } catch (error) {
    return manejarError(res, error, "GET /api/empleados");
  }
}

async function crear(req, res) {
  try {
    const { idUsuario, cedula, cargo, area, fechaIngreso, salario, promedioHorasExtras } = req.body;
    if (!idUsuario || !cedula || !cargo || !area || !fechaIngreso) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: idUsuario, cedula, cargo, area, fechaIngreso" });
    }
    const errorValidacion = validarEmpleado(req.body);
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [result] = await pool.query(
      `INSERT INTO empleados (id_usuario, cedula, cargo, area, fecha_ingreso, salario, promedio_horas_extras)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, texto(cedula), texto(cargo), texto(area), normalizarFecha(fechaIngreso), Number(salario) || 0, Number(promedioHorasExtras) || 0]
    );
    return res.status(201).json({ mensaje: "Empleado registrado correctamente", idEmpleado: result.insertId });
  } catch (error) {
    return manejarError(res, error, "POST /api/empleados");
  }
}

async function actualizar(req, res) {
  try {
    const { idEmpleado, cedula, cargo, area, fechaIngreso, salario, promedioHorasExtras } = req.body;
    if (!idEmpleado) return res.status(400).json({ mensaje: "El campo idEmpleado es obligatorio" });
    const errorValidacion = validarEmpleado(req.body);
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [existe] = await pool.query("SELECT id_empleado FROM empleados WHERE id_empleado = ?", [idEmpleado]);
    if (existe.length === 0) return res.status(404).json({ mensaje: "Empleado no encontrado" });

    await pool.query(
      `UPDATE empleados
       SET cedula = ?, cargo = ?, area = ?, fecha_ingreso = ?, salario = ?, promedio_horas_extras = ?
       WHERE id_empleado = ?`,
      [texto(cedula), texto(cargo), texto(area), normalizarFecha(fechaIngreso), Number(salario) || 0, Number(promedioHorasExtras) || 0, idEmpleado]
    );
    return res.status(200).json({ mensaje: "Empleado actualizado correctamente" });
  } catch (error) {
    return manejarError(res, error, "PUT /api/empleados");
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ mensaje: "El parametro id es obligatorio" });
    await pool.query("DELETE FROM empleados WHERE id_empleado = ?", [id]);
    return res.status(200).json({ mensaje: "Empleado eliminado correctamente" });
  } catch (error) {
    return manejarError(res, error, "DELETE /api/empleados");
  }
}

// POST /api/empleados/carga-masiva
// Recibe un archivo Excel (.xlsx) mediante multipart/form-data (campo "archivo").
// Cada fila debe tener las columnas: nombre, correo, contrasena, cedula, cargo, area,
// fechaIngreso, salario, promedioHorasExtras. Por cada fila se crea el USUARIO
// y el EMPLEADO asociado, en una sola transacción por fila.
async function cargaMasiva(req, res) {
  if (!req.file) {
    return res.status(400).json({ mensaje: "Debes adjuntar un archivo Excel (.xlsx) en el campo 'archivo'" });
  }

  const resultado = { insertados: 0, fallidos: 0, errores: [] };

  try {
    // cellDates: las celdas de fecha de Excel llegan como fechas reales y no como números de serie.
    const libro = XLSX.readFile(req.file.path, { cellDates: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

    if (filas.length === 0) {
      return res.status(400).json({ mensaje: "El archivo Excel no contiene filas de datos" });
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numeroFila = i + 2; // +2 porque la fila 1 es el encabezado

      const nombre = texto(fila.nombre);
      const correo = texto(fila.correo).toLowerCase();
      const contrasena = texto(fila.contrasena) || "123456"; // valor por defecto si no se especifica
      const cedula = texto(fila.cedula);
      const cargo = texto(fila.cargo);
      const area = texto(fila.area);
      const fechaIngreso = normalizarFecha(fila.fechaIngreso);
      const salario = Number(fila.salario) || 0;
      const promedioHorasExtras = Number(fila.promedioHorasExtras) || 0;

      if (!nombre || !correo || !cedula || !cargo || !area || !fila.fechaIngreso) {
        resultado.fallidos++;
        resultado.errores.push(`Fila ${numeroFila}: faltan campos obligatorios (nombre, correo, cedula, cargo, area, fechaIngreso)`);
        continue;
      }

      const errorFila =
        validarUsuario({ nombre, correo, contrasena, idRol: 2, idEstado: 1 }, { exigirContrasena: true }) ||
        validarEmpleado({ cedula, cargo, area, fechaIngreso, salario, promedioHorasExtras });
      if (errorFila) {
        resultado.fallidos++;
        resultado.errores.push(`Fila ${numeroFila} (${correo}): ${errorFila}`);
        continue;
      }

      const conexion = await pool.getConnection();
      try {
        await conexion.beginTransaction();

        const [usuarioExistente] = await conexion.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo]);
        if (usuarioExistente.length > 0) {
          throw new Error(`el correo '${correo}' ya está registrado`);
        }

        const [cedulaExistente] = await conexion.query("SELECT id_empleado FROM empleados WHERE cedula = ?", [cedula]);
        if (cedulaExistente.length > 0) {
          throw new Error(`la cédula '${cedula}' ya está registrada`);
        }

        const [resultadoUsuario] = await conexion.query(
          "INSERT INTO usuarios (nombre, correo, contrasena, id_rol, id_estado) VALUES (?, ?, ?, 2, 1)",
          [nombre, correo, await hashear(contrasena)]
        );
        const idUsuarioNuevo = resultadoUsuario.insertId;

        await conexion.query(
          `INSERT INTO empleados (id_usuario, cedula, cargo, area, fecha_ingreso, salario, promedio_horas_extras)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [idUsuarioNuevo, cedula, cargo, area, fechaIngreso, salario, promedioHorasExtras]
        );

        await conexion.commit();
        resultado.insertados++;
      } catch (errorTransaccion) {
        await conexion.rollback();
        resultado.fallidos++;
        resultado.errores.push(`Fila ${numeroFila} (${correo || "sin correo"}): ${errorTransaccion.message}`);
      } finally {
        conexion.release();
      }
    }

    return res.status(200).json({
      mensaje: `Carga masiva finalizada: ${resultado.insertados} empleados creados, ${resultado.fallidos} con error.`,
      ...resultado,
    });
  } catch (error) {
    console.error("Error en POST /api/empleados/carga-masiva:", error.message);
    return res.status(500).json({ mensaje: "Error al procesar el archivo Excel" });
  } finally {
    // Elimina el archivo temporal subido por multer
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
}

module.exports = { listarOConsultar, crear, actualizar, eliminar, cargaMasiva };
