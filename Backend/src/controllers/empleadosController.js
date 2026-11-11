const fs = require("fs");
const XLSX = require("xlsx");
const { pool } = require("../config/db");
const { esAdmin } = require("../utils/auth");
const { hashear } = require("../utils/passwords");
const {
  validarEmpleado, validarUsuario, validarPersona, validarDocumento, nombreCompleto, dividirNombre,
  normalizarTipoDocumento, normalizarGenero, normalizarFecha, texto,
} = require("../utils/validaciones");
const path = require("path");
const { manejarError } = require("../utils/errores");

// Consulta base con datos del usuario asociado (nombre, correo) unidos por JOIN
const SELECT_EMPLEADO_COMPLETO = `
  SELECT e.*, u.nombre, u.correo, u.id_rol, u.id_estado, u.tipo_documento, u.numero_documento,
    u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido, u.genero
  FROM empleados e
  JOIN usuarios u ON u.id_usuario = e.id_usuario
`;

const prohibido = (res) => res.status(403).json({ mensaje: "No tienes permiso para consultar esta información" });

async function listarOConsultar(req, res) {
  try {
    const { id, idUsuario, documento } = req.query;

    // Búsqueda por número de documento (la usa el administrador para editar sin conocer ids).
    if (documento) {
      if (!esAdmin(req)) return prohibido(res);
      const [rows] = await pool.query(`${SELECT_EMPLEADO_COMPLETO} WHERE e.cedula = ? OR u.numero_documento = ?`, [texto(documento), texto(documento)]);
      if (rows.length === 0) return res.status(404).json({ mensaje: "No existe un empleado con ese número de documento" });
      return res.status(200).json(rows[0]);
    }

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

// POST /api/empleados
// body: { numeroDocumento, cargo, area, fechaIngreso, salario?, promedioHorasExtras? }
// La persona se busca por su número de documento entre los usuarios ya creados (también se acepta
// idUsuario por compatibilidad). El id del empleado lo asigna la base de datos.
async function crear(req, res) {
  try {
    const { numeroDocumento, idUsuario, cargo, area, fechaIngreso } = req.body;
    if ((!numeroDocumento && !idUsuario) || !cargo || !area || !fechaIngreso) {
      return res.status(400).json({ mensaje: "Faltan campos obligatorios: numeroDocumento, cargo, area, fechaIngreso" });
    }
    const errorValidacion =
      (numeroDocumento ? validarDocumento("CC", numeroDocumento) : null) || validarEmpleado(req.body, { exigirCedula: false });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [usuarios] = numeroDocumento
      ? await pool.query("SELECT id_usuario, numero_documento FROM usuarios WHERE numero_documento = ?", [texto(numeroDocumento)])
      : await pool.query("SELECT id_usuario, numero_documento FROM usuarios WHERE id_usuario = ?", [idUsuario]);
    if (usuarios.length === 0) {
      return res.status(404).json({ mensaje: "No existe un usuario con ese número de documento. Créalo primero en el módulo Usuarios" });
    }
    const usuario = usuarios[0];
    const cedula = usuario.numero_documento || texto(req.body.cedula);
    if (!/^\d{5,15}$/.test(cedula)) return res.status(400).json({ mensaje: "El usuario no tiene un número de documento válido" });

    const [yaEmpleado] = await pool.query("SELECT id_empleado FROM empleados WHERE id_usuario = ?", [usuario.id_usuario]);
    if (yaEmpleado.length > 0) return res.status(409).json({ mensaje: "Esta persona ya está registrada como empleado: edítala desde la lista" });

    const [result] = await pool.query(
      `INSERT INTO empleados (id_usuario, cedula, cargo, area, fecha_ingreso, salario, promedio_horas_extras)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuario.id_usuario, cedula, texto(cargo), texto(area), normalizarFecha(fechaIngreso), Number(req.body.salario) || 0, Number(req.body.promedioHorasExtras) || 0]
    );
    return res.status(201).json({ mensaje: "Empleado registrado correctamente", idEmpleado: result.insertId });
  } catch (error) {
    return manejarError(res, error, "POST /api/empleados");
  }
}

async function actualizar(req, res) {
  try {
    const { idEmpleado, cargo, area, fechaIngreso, salario, promedioHorasExtras } = req.body;
    if (!idEmpleado) return res.status(400).json({ mensaje: "No se indicó el empleado a actualizar" });
    const errorValidacion = validarEmpleado(req.body, { exigirCedula: false });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });

    const [existe] = await pool.query("SELECT id_empleado FROM empleados WHERE id_empleado = ?", [idEmpleado]);
    if (existe.length === 0) return res.status(404).json({ mensaje: "Empleado no encontrado" });

    await pool.query(
      `UPDATE empleados
       SET cargo = ?, area = ?, fecha_ingreso = ?, salario = ?, promedio_horas_extras = ?
       WHERE id_empleado = ?`,
      [texto(cargo), texto(area), normalizarFecha(fechaIngreso), Number(salario) || 0, Number(promedioHorasExtras) || 0, idEmpleado]
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

      // Columnas nuevas: tipoDocumento, numeroDocumento, primerNombre, segundoNombre, primerApellido,
      // segundoApellido, genero. Se aceptan también las antiguas "cedula" y "nombre".
      const partes = fila.primerNombre || fila.primerApellido ? {} : dividirNombre(fila.nombre);
      const persona = {
        tipoDocumento: normalizarTipoDocumento(fila.tipoDocumento || "CC"),
        numeroDocumento: texto(fila.numeroDocumento || fila.cedula),
        primerNombre: texto(fila.primerNombre) || partes.primerNombre || "",
        segundoNombre: texto(fila.segundoNombre) || partes.segundoNombre || "",
        primerApellido: texto(fila.primerApellido) || partes.primerApellido || "",
        segundoApellido: texto(fila.segundoApellido) || partes.segundoApellido || "",
        genero: normalizarGenero(fila.genero),
      };
      const correo = texto(fila.correo).toLowerCase();
      const contrasena = texto(fila.contrasena) || "123456"; // valor por defecto si no se especifica
      const cargo = texto(fila.cargo);
      const area = texto(fila.area);
      const fechaIngreso = normalizarFecha(fila.fechaIngreso);
      const salario = Number(fila.salario) || 0;
      const promedioHorasExtras = Number(fila.promedioHorasExtras) || 0;
      const cedula = persona.numeroDocumento;

      if (!persona.numeroDocumento || !persona.primerNombre || !persona.primerApellido || !correo || !cargo || !area || !fila.fechaIngreso) {
        resultado.fallidos++;
        resultado.errores.push(`Fila ${numeroFila}: faltan campos obligatorios (numeroDocumento, primerNombre, primerApellido, correo, cargo, area, fechaIngreso)`);
        continue;
      }

      const errorFila =
        validarPersona(persona) ||
        validarUsuario({ correo, contrasena, idRol: 2, idEstado: 1 }, { exigirContrasena: true }) ||
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

        const [cedulaExistente] = await conexion.query("SELECT id_usuario FROM usuarios WHERE numero_documento = ?", [cedula]);
        if (cedulaExistente.length > 0) {
          throw new Error(`el documento '${cedula}' ya está registrado`);
        }

        const [resultadoUsuario] = await conexion.query(
          `INSERT INTO usuarios (tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido,
             segundo_apellido, genero, nombre, correo, contrasena, id_rol, id_estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 1)`,
          [persona.tipoDocumento, cedula, persona.primerNombre, persona.segundoNombre || null, persona.primerApellido,
           persona.segundoApellido || null, persona.genero, nombreCompleto(persona), correo, await hashear(contrasena)]
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

// GET /api/empleados/plantilla  (administrador): descarga la plantilla de Excel para la carga masiva.
function descargarPlantilla(req, res) {
  return res.download(path.join(__dirname, "..", "..", "plantilla_carga_empleados.xlsx"), "plantilla_carga_empleados.xlsx");
}

module.exports = { listarOConsultar, crear, actualizar, eliminar, cargaMasiva, descargarPlantilla };
