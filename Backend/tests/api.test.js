// Pruebas automáticas de la API (Jest + Supertest). La base de datos y el correo se simulan,
// por eso corren sin MySQL:  npm test
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "clave_de_pruebas";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("../src/config/db", () => {
  const pool = { query: jest.fn(), getConnection: jest.fn() };
  return { pool, verificarConexion: jest.fn() };
});
jest.mock("../src/utils/mailer", () => ({
  enviarCertificado: jest.fn(() => {
    const e = new Error("SMTP no configurado");
    e.code = "SMTP_NO_CONFIGURADO";
    throw e;
  }),
}));

const { pool } = require("../src/config/db");
const { firmarToken } = require("../src/utils/auth");
const limitador = require("../src/utils/limitador");
const { normalizarFecha } = require("../src/utils/validaciones");
const app = require("../src/app");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

const CARPETA_CERT = path.join(__dirname, "..", "certificados");
const inicio = Date.now();
const tokenAdmin = firmarToken({ id_usuario: 1, id_rol: 1, nombre: "Admin" });
const tokenEmpleado = firmarToken({ id_usuario: 2, id_rol: 2, nombre: "Empleada" });
const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Enruta las consultas simuladas: cada prueba define qué responde cada SQL.
function simularBD(reglas) {
  pool.query.mockImplementation(async (sql, params) => {
    for (const [patron, respuesta] of reglas) {
      if (patron.test(sql)) return typeof respuesta === "function" ? respuesta(sql, params) : respuesta;
    }
    return [[], undefined];
  });
}

beforeEach(() => {
  pool.query.mockReset();
  pool.getConnection.mockReset();
  limitador.reiniciarTodo();
});

afterAll(() => {
  for (const f of fs.readdirSync(CARPETA_CERT)) {
    const ruta = path.join(CARPETA_CERT, f);
    if (/^CERT-\d{4}-\d+\.pdf$/.test(f) && fs.statSync(ruta).mtimeMs >= inicio) fs.unlinkSync(ruta);
  }
});

describe("Autenticación", () => {
  test("sin token las rutas protegidas responden 401", async () => {
    const r = await request(app).get("/api/usuarios");
    expect(r.status).toBe(401);
  });

  test("login correcto devuelve token y usuario", async () => {
    const hash = await bcrypt.hash("123456", 4);
    simularBD([[/FROM usuarios u/, [[{ id_usuario: 2, nombre: "Gennifer", correo: "g@a.com", contrasena: hash, id_rol: 2, nombre_rol: "Empleado", id_estado: 1, ultimo_acceso: null }]]]]);
    const r = await request(app).post("/api/login").send({ correo: "g@a.com", contrasena: "123456" });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.usuario).toMatchObject({ idUsuario: 2, idRol: 2, ultimoAcceso: null });
  });

  test("contraseña incorrecta responde 401", async () => {
    const hash = await bcrypt.hash("123456", 4);
    simularBD([[/FROM usuarios u/, [[{ id_usuario: 2, nombre: "G", correo: "g@a.com", contrasena: hash, id_rol: 2, nombre_rol: "Empleado", id_estado: 1 }]]]]);
    const r = await request(app).post("/api/login").send({ correo: "g@a.com", contrasena: "otra" });
    expect(r.status).toBe(401);
  });

  test("una contraseña en texto plano se convierte a hash en el primer ingreso", async () => {
    simularBD([[/FROM usuarios u/, [[{ id_usuario: 2, nombre: "G", correo: "g@a.com", contrasena: "123456", id_rol: 2, nombre_rol: "Empleado", id_estado: 1 }]]]]);
    const r = await request(app).post("/api/login").send({ correo: "g@a.com", contrasena: "123456" });
    expect(r.status).toBe(200);
    const actualizacion = pool.query.mock.calls.find(([sql]) => /UPDATE usuarios SET contrasena/.test(sql));
    expect(actualizacion[1][0]).toMatch(/^\$2[aby]\$/);
  });

  test("después de 5 intentos fallidos el login se bloquea (429)", async () => {
    simularBD([[/FROM usuarios u/, [[]]]]);
    for (let i = 0; i < 5; i++) await request(app).post("/api/login").send({ correo: "x@a.com", contrasena: "mala" });
    const r = await request(app).post("/api/login").send({ correo: "x@a.com", contrasena: "mala" });
    expect(r.status).toBe(429);
  });

  test("cambiar contraseña exige la actual correcta", async () => {
    const hash = await bcrypt.hash("vieja123", 4);
    simularBD([[/SELECT contrasena FROM usuarios/, [[{ contrasena: hash }]]]]);
    const mala = await request(app).put("/api/login/contrasena").set(auth(tokenEmpleado)).send({ actual: "zzz", nueva: "nueva123" });
    expect(mala.status).toBe(400);
    const buena = await request(app).put("/api/login/contrasena").set(auth(tokenEmpleado)).send({ actual: "vieja123", nueva: "nueva123" });
    expect(buena.status).toBe(200);
  });
});

describe("Control de acceso por rol", () => {
  test("un empleado no puede listar usuarios (403)", async () => {
    const r = await request(app).get("/api/usuarios").set(auth(tokenEmpleado));
    expect(r.status).toBe(403);
  });

  test("un empleado no puede listar todos los empleados (403) pero sí su propio perfil", async () => {
    simularBD([[/FROM empleados e/, [[{ id_empleado: 1, id_usuario: 2, cedula: "123" }]]]]);
    expect((await request(app).get("/api/empleados").set(auth(tokenEmpleado))).status).toBe(403);
    expect((await request(app).get("/api/empleados?idUsuario=1").set(auth(tokenEmpleado))).status).toBe(403);
    expect((await request(app).get("/api/empleados?idUsuario=2").set(auth(tokenEmpleado))).status).toBe(200);
  });

  test("un empleado no puede cambiar el estado de una solicitud (403)", async () => {
    const r = await request(app).put("/api/solicitudes").set(auth(tokenEmpleado)).send({ idSolicitud: 1, idEstado: 5 });
    expect(r.status).toBe(403);
  });

  test("un empleado no puede generar el certificado de otra persona (403)", async () => {
    const r = await request(app).post("/api/certificados").set(auth(tokenEmpleado)).send({ idUsuario: 1, tipoCarta: "todos", canal: "pdf" });
    expect(r.status).toBe(403);
  });

  test("un empleado no puede eliminar una solicitud que ya fue atendida (409)", async () => {
    simularBD([
      [/SELECT id_empleado, id_estado FROM solicitudes/, [[{ id_empleado: 1, id_estado: 5 }]]],
      [/SELECT id_usuario FROM empleados/, [[{ id_usuario: 2 }]]],
    ]);
    const r = await request(app).delete("/api/solicitudes?id=7").set(auth(tokenEmpleado));
    expect(r.status).toBe(409);
  });
});

const PERSONA = { tipoDocumento: "CC", numeroDocumento: "1012345678", primerNombre: "Ana", segundoNombre: "María", primerApellido: "Pérez", segundoApellido: "Gómez", genero: "Femenino" };

describe("Validaciones", () => {
  test("crear usuario con correo inválido responde 400", async () => {
    const r = await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...PERSONA, correo: "ana", contrasena: "123456", idRol: 2 });
    expect(r.status).toBe(400);
  });

  test("la contraseña del usuario nuevo se guarda con hash", async () => {
    simularBD([[/INSERT INTO usuarios/, [{ insertId: 9 }]]]);
    const r = await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...PERSONA, correo: "ana@a.com", contrasena: "clave123", idRol: 2 });
    expect(r.status).toBe(201);
    const insercion = pool.query.mock.calls.find(([sql]) => /INSERT INTO usuarios/.test(sql));
    expect(insercion[1][9]).toMatch(/^\$2[aby]\$/);
    expect(insercion[1][7]).toBe("Ana María Pérez Gómez"); // el nombre completo se arma solo
  });

  test("un correo duplicado responde 409 sin mostrar el error técnico", async () => {
    pool.query.mockRejectedValue(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry 'a' for key 'correo'" }));
    const r = await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...PERSONA, correo: "ana@a.com", contrasena: "clave123", idRol: 2 });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/correo/);
    expect(JSON.stringify(r.body)).not.toMatch(/Duplicate entry/);
  });

  test("el género es obligatorio y solo acepta Masculino o Femenino", async () => {
    const base = { ...PERSONA, correo: "ana@a.com", contrasena: "clave123", idRol: 2 };
    expect((await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...base, genero: undefined })).status).toBe(400);
    expect((await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...base, genero: "Otro" })).status).toBe(400);
  });

  test("documento con letras, nombres con números o documento duplicado se rechazan", async () => {
    const base = { ...PERSONA, correo: "ana@a.com", contrasena: "clave123", idRol: 2 };
    expect((await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...base, numeroDocumento: "12ab" })).status).toBe(400);
    expect((await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send({ ...base, primerNombre: "Ana2" })).status).toBe(400);
    pool.query.mockRejectedValue(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry '1' for key 'numero_documento'" }));
    const r = await request(app).post("/api/usuarios").set(auth(tokenAdmin)).send(base);
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/documento/);
  });

  test("empleado: documento inválido o fecha futura responde 400, y sin usuario responde 404", async () => {
    const base = { numeroDocumento: "123456789", cargo: "Analista", area: "TI", fechaIngreso: "2024-01-10" };
    expect((await request(app).post("/api/empleados").set(auth(tokenAdmin)).send({ ...base, numeroDocumento: "abc" })).status).toBe(400);
    expect((await request(app).post("/api/empleados").set(auth(tokenAdmin)).send({ ...base, fechaIngreso: "2099-01-01" })).status).toBe(400);
    simularBD([[/FROM usuarios/, [[]]]]);
    const r = await request(app).post("/api/empleados").set(auth(tokenAdmin)).send(base);
    expect(r.status).toBe(404);
    expect(r.body.mensaje).toMatch(/Usuarios/);
  });

  test("la plantilla de Excel solo la descarga el administrador", async () => {
    expect((await request(app).get("/api/empleados/plantilla").set(auth(tokenEmpleado))).status).toBe(403);
    const r = await request(app).get("/api/empleados/plantilla").set(auth(tokenAdmin));
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/plantilla_carga_empleados\.xlsx/);
  });

  test("rechazar una solicitud exige el motivo", async () => {
    const r = await request(app).put("/api/solicitudes").set(auth(tokenAdmin)).send({ idSolicitud: 1, idEstado: 6 });
    expect(r.status).toBe(400);
  });

  test("normalizarFecha acepta varios formatos y rechaza fechas imposibles", () => {
    expect(normalizarFecha("2024-03-15")).toBe("2024-03-15");
    expect(normalizarFecha("15/03/2024")).toBe("2024-03-15");
    expect(normalizarFecha(45366)).toBe("2024-03-15"); // número de serie de Excel
    expect(normalizarFecha("2026-02-31")).toBeNull();
    expect(normalizarFecha("hola")).toBeNull();
  });
});

describe("Certificados", () => {
  const reglasBase = [
    [/FROM empleados e/, [[{ id_empleado: 1, id_usuario: 2, nombre: "Gennifer", correo: "g@a.com", cedula: "123", cargo: "RRHH", area: "Gestion", fecha_ingreso: "2019-07-01", salario: 4000000, promedio_horas_extras: 0 }]]],
  ];

  test("si el consecutivo choca (UNIQUE) se recalcula y se reintenta", async () => {
    let maximo = 5;
    let primerIntento = true;
    simularBD([
      ...reglasBase,
      [/MAX\(consecutivo\)/, () => [[{ maxConsecutivo: maximo }]]],
      [/INSERT INTO certificados/, () => {
        if (primerIntento) {
          primerIntento = false;
          maximo = 6; // otra persona alcanzó a guardar el 6
          throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY", sqlMessage: "key 'uq_certificados_consecutivo'" });
        }
        return [{ insertId: 50 }];
      }],
    ]);
    const r = await request(app).post("/api/certificados").set(auth(tokenEmpleado)).send({ idUsuario: 2, tipoCarta: "todos", canal: "pdf" });
    expect(r.status).toBe(200);
    const inserciones = pool.query.mock.calls.filter(([sql]) => /INSERT INTO certificados/.test(sql));
    expect(inserciones).toHaveLength(2);
    expect(inserciones[0][1][2]).toBe(6);
    expect(inserciones[1][1][2]).toBe(7);
  });

  test("enviar por correo sin SMTP configurado responde 503 y no deja registro", async () => {
    simularBD([
      ...reglasBase,
      [/MAX\(consecutivo\)/, [[{ maxConsecutivo: 0 }]]],
      [/INSERT INTO certificados/, [{ insertId: 77 }]],
    ]);
    const r = await request(app).post("/api/certificados").set(auth(tokenEmpleado)).send({ idUsuario: 2, tipoCarta: "todos", canal: "correo" });
    expect(r.status).toBe(503);
    const borrado = pool.query.mock.calls.find(([sql]) => /DELETE FROM certificados/.test(sql));
    expect(borrado[1][0]).toBe(77);
  });
});
