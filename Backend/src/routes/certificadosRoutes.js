const express = require("express");
const router = express.Router();
const certificadosController = require("../controllers/certificadosController");
const { autenticar } = require("../utils/auth");

router.use(autenticar);

router.get("/", certificadosController.listarOConsultar);
router.post("/", certificadosController.generar);

module.exports = router;
