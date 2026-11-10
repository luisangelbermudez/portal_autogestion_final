const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const empleadosController = require("../controllers/empleadosController");
const { autenticar, soloAdmin } = require("../utils/auth");

// Configuración de multer para guardar temporalmente el Excel subido
const almacenamiento = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "temp"),
  filename: (req, file, cb) => cb(null, `carga_${Date.now()}_${path.basename(file.originalname)}`),
});
const upload = multer({
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) return cb(null, true);
    const error = new Error("Solo se permiten archivos Excel (.xlsx)");
    error.status = 400;
    cb(error);
  },
});

router.use(autenticar);

// El empleado puede consultar su propio perfil; el listado completo es solo del administrador
// (la verificación está dentro del controlador).
router.get("/", empleadosController.listarOConsultar);
router.post("/", soloAdmin, empleadosController.crear);
router.put("/", soloAdmin, empleadosController.actualizar);
router.delete("/", soloAdmin, empleadosController.eliminar);

// Carga masiva de empleados desde un archivo Excel (.xlsx)
router.post("/carga-masiva", soloAdmin, upload.single("archivo"), empleadosController.cargaMasiva);

module.exports = router;
