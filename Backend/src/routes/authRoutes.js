const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { autenticar } = require("../utils/auth");

router.post("/", authController.login);
router.put("/contrasena", autenticar, authController.cambiarContrasena);

module.exports = router;
