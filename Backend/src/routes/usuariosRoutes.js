const express = require("express");
const router = express.Router();
const usuariosController = require("../controllers/usuariosController");
const { autenticar, soloAdmin } = require("../utils/auth");

// Toda la gestión de usuarios es exclusiva del administrador.
router.use(autenticar, soloAdmin);

router.get("/", usuariosController.listarOConsultar);
router.post("/", usuariosController.crear);
router.put("/", usuariosController.actualizar);
router.delete("/", usuariosController.eliminar);

module.exports = router;
