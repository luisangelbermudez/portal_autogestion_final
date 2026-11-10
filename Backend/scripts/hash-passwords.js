// Convierte a hash bcrypt las contraseñas que aún estén en texto plano en la tabla usuarios.
// Uso (desde la carpeta Backend):  npm run hash-passwords
// Es seguro ejecutarlo varias veces: omite las que ya son hash.
const { pool } = require("../src/config/db");
const { hashear, esHash } = require("../src/utils/passwords");

(async () => {
  try {
    const [usuarios] = await pool.query("SELECT id_usuario, contrasena FROM usuarios");
    let convertidas = 0;
    for (const u of usuarios) {
      if (esHash(u.contrasena)) continue;
      await pool.query("UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?", [await hashear(u.contrasena), u.id_usuario]);
      convertidas++;
    }
    console.log(`Listo: ${convertidas} contraseña(s) convertida(s) a hash de ${usuarios.length} usuario(s).`);
  } catch (error) {
    console.error("Error al convertir contraseñas:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
