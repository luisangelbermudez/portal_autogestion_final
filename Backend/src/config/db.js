// src/config/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

// Las bases de datos en la nube exigen conexion cifrada:
//   DB_SSL=true                       activa SSL
//   DB_SSL_CA="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"   (opcional) certificado CA del proveedor
//   DB_SSL_REJECT_UNAUTHORIZED=false  (opcional) solo si el proveedor no da CA y el certificado no es publico
let ssl;
if (String(process.env.DB_SSL).toLowerCase() === "true") {
  ssl = { minVersion: "TLSv1.2", rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };
  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "portal_acegrasco",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl,
});

async function verificarConexion() {
  try {
    const conn = await pool.getConnection();
    console.log(`Conexion a MySQL (${process.env.DB_NAME || "portal_acegrasco"}) establecida correctamente.`);
    conn.release();
  } catch (error) {
    console.error("Error al conectar con la base de datos MySQL:", error.message);
  }
}

module.exports = { pool, verificarConexion };
