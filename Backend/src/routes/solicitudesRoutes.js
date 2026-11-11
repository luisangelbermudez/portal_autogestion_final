const express = require("express");
const router = express.Router();
const solicitudesController = require("../controllers/solicitudesController");
const { autenticar, soloAdmin } = require("../utils/auth");

router.use(autenticar);

router.get("/", solicitudesController.listarOConsultar);
router.post("/", solicitudesController.crear);
router.put("/", soloAdmin, solicitudesController.actualizar);
router.delete("/", solicitudesController.eliminar);

module.exports = router;
