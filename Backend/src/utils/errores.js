// Respuestas de error uniformes: no se expone el detalle técnico al cliente.
function manejarError(res, error, contexto) {
  console.error(`Error en ${contexto}:`, error.message);

  switch (error.code) {
    case "ER_DUP_ENTRY": {
      const detalle = String(error.sqlMessage || "");
      let campo = "valor";
      if (/correo/i.test(detalle)) campo = "correo";
      else if (/numero_documento/i.test(detalle)) campo = "número de documento";
      else if (/cedula/i.test(detalle)) campo = "cédula";
      return res.status(409).json({
        mensaje: campo === "valor" ? "Ya existe un registro con esos datos" : `El ${campo} ya está registrado`,
      });
    }
    case "ER_ROW_IS_REFERENCED_2":
      return res.status(409).json({
        mensaje: "No se puede eliminar: tiene registros asociados (por ejemplo, certificados o solicitudes)",
      });
    case "ER_NO_REFERENCED_ROW_2":
      return res.status(400).json({ mensaje: "Referencia inválida: el usuario, rol o estado indicado no existe" });
    default:
      return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
}

module.exports = { manejarError };
