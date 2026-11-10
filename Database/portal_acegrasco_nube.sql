-- Version para bases en la nube (Aiven, TiDB Cloud...): sin CREATE DATABASE ni USE.
-- Ejecutar dentro de la base que entrega el proveedor (p. ej. defaultdb) y poner ese nombre en DB_NAME.
-- ============================================================
--  Portal de Autogestión - Acegrasco S.A.
--  Archivo: portal_acegrasco.sql
--  Versión: 2.1 | Con campo 'area' y registros reales integrados
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE roles (
                       id_rol     INT(11)     NOT NULL AUTO_INCREMENT,
                       nombre_rol VARCHAR(50) NOT NULL,
                       PRIMARY KEY (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (nombre_rol) VALUES ('Administrador'), ('Empleado');

CREATE TABLE estados (
                         id_estado     INT(11)     NOT NULL AUTO_INCREMENT,
                         nombre_estado VARCHAR(50) NOT NULL,
                         PRIMARY KEY (id_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO estados (nombre_estado) VALUES
('Activo'), ('Inactivo'), ('Pendiente'),
('En revisión'), ('Aprobado'), ('Rechazado');

CREATE TABLE usuarios (
                          id_usuario INT(11)      NOT NULL AUTO_INCREMENT,
                          nombre     VARCHAR(100) NOT NULL,
                          correo     VARCHAR(100) NOT NULL UNIQUE,
                          contrasena VARCHAR(255) NOT NULL COMMENT 'En producción usar hash bcrypt',
                          id_rol     INT(11)      NOT NULL,
                          id_estado  INT(11)      NOT NULL DEFAULT 1,
                          ultimo_acceso DATETIME  NULL COMMENT 'Fecha y hora del último inicio de sesión',
                          PRIMARY KEY (id_usuario),
                          CONSTRAINT fk_usuario_rol    FOREIGN KEY (id_rol)    REFERENCES roles   (id_rol),
                          CONSTRAINT fk_usuario_estado FOREIGN KEY (id_estado) REFERENCES estados (id_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contrasenas guardadas con hash bcrypt (la clave de los usuarios de ejemplo es 123456).
INSERT INTO usuarios (id_usuario, nombre, correo, contrasena, id_rol, id_estado) VALUES
(1, 'José Leonardo Triviño',  'jltrivino@acegrasco.com',    '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 1, 1),
(2, 'Gennifer Silvana',       'gsilvana@acegrasco.com',     '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 2, 1),
(3, 'Richard Acevedo',        'racevedo@acegrasco.com',     '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 2, 1),
(4, 'Nicolas Luna',           'nluna@acegrasco.com',        '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 2, 1),
(8, 'Julio Cesar Sanchez',    'jcsanchez@acegrasco.com',    '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 2, 1),
(9, 'Jennifer Keller',        'jkeller@acegrasco.com',      '$2b$10$CJrxqcBRlb7ZIZGrs/jo/u8SMVyLgEpYizjS/Mp8ZSxu.IyJZG0UO', 2, 1);

CREATE TABLE empleados (
                           id_empleado           INT(11)       NOT NULL AUTO_INCREMENT,
                           id_usuario            INT(11)       NOT NULL,
                           cedula                VARCHAR(20)   NOT NULL UNIQUE,
                           cargo                 VARCHAR(100)  NOT NULL,
                           area                  VARCHAR(100)  NOT NULL,
                           fecha_ingreso         DATE          NOT NULL,
                           salario               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                           promedio_horas_extras DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
                           PRIMARY KEY (id_empleado),
                           CONSTRAINT fk_empleado_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO empleados (id_empleado, id_usuario, cedula, cargo, area, fecha_ingreso, salario, promedio_horas_extras) VALUES
(1, 2, '9876543210', 'Coordinadora RRHH',    'Gestion Humana', '2019-07-01', 4000000.00, 0.00),
(2, 3, '1122334455', 'Analista de Sistemas',  'Tecnologia',     '2020-11-10', 3000000.00, 150.00),
(3, 4, '5566778899', 'Director de Contabilidad','Financiera',   '2021-05-20', 4000000.00, 0.00),
(4, 1, '1234567890', 'Gerente General',       'Gerencia',       '2018-03-15', 5000000.00, 0.00),
(5, 8, '1130857026', 'Jefe de Tesoreria',     'Financiera',     '2023-01-15', 4500000.00, 0.00),
(6, 9, '1055684257', 'Jefe de calidad',       'Calidad',        '2022-06-14', 4500000.00, 0.00);

CREATE TABLE tipo_certificados (
id_tipo     INT(11)      NOT NULL AUTO_INCREMENT,
nombre_tipo VARCHAR(100) NOT NULL,
descripcion TEXT,
PRIMARY KEY (id_tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tipo_certificados (nombre_tipo, descripcion) VALUES
('Certificación Laboral Completa',   'Incluye nombre, cédula, cargo, área, fecha de ingreso y salario básico mensual. Para trámites financieros o bancarios.'),
('Certificación Laboral sin Salario Básico','Incluye nombre, cédula, cargo, área y fecha de ingreso. Sin mención del salario. Ideal cuando no se requiere revelar ingresos.'),
('Certificado con Horas Extras', 'Incluye todos los datos más el promedio de horas extras de los últimos 3 meses.');

CREATE TABLE certificados (
id_certificado   INT(11)      NOT NULL AUTO_INCREMENT,
id_empleado      INT(11)      NOT NULL,
id_tipo          INT(11)      NOT NULL,
consecutivo      INT(11)      NOT NULL,
incluye_sueldo   TINYINT(1)   NOT NULL DEFAULT 0,
fecha_generacion TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
canal_entrega    VARCHAR(20)  NOT NULL DEFAULT 'pdf' COMMENT 'pdf | correo',
archivo_pdf      VARCHAR(255),
PRIMARY KEY (id_certificado),
UNIQUE KEY uq_certificados_consecutivo (consecutivo),
CONSTRAINT fk_cert_empleado FOREIGN KEY (id_empleado) REFERENCES empleados        (id_empleado),
CONSTRAINT fk_cert_tipo     FOREIGN KEY (id_tipo)     REFERENCES tipo_certificados (id_tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO certificados (id_empleado, id_tipo, consecutivo, incluye_sueldo, canal_entrega, archivo_pdf) VALUES
    (1, 1, 1, 0, 'pdf', 'CERT-0001.pdf');

CREATE TABLE solicitudes (
id_solicitud   INT(11)      NOT NULL AUTO_INCREMENT,
id_empleado    INT(11)      NOT NULL,
id_estado      INT(11)      NOT NULL DEFAULT 3,
tipo_solicitud VARCHAR(100) NOT NULL,
descripcion    TEXT,
fecha_creacion TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (id_solicitud),
CONSTRAINT fk_solic_empleado FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado),
CONSTRAINT fk_solic_estado   FOREIGN KEY (id_estado)   REFERENCES estados   (id_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO solicitudes (id_empleado, id_estado, tipo_solicitud, descripcion) VALUES
(1, 3, 'Permiso',    'Permiso médico el día 25 de junio.'),
(2, 5, 'Vacaciones', 'Solicitud de vacaciones del 1 al 15 de julio.');

CREATE TABLE respuestas (
id_respuesta    INT(11)   NOT NULL AUTO_INCREMENT,
id_solicitud    INT(11)   NOT NULL,
id_usuario      INT(11)   NOT NULL,
mensaje         TEXT      NOT NULL,
fecha_respuesta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (id_respuesta),
CONSTRAINT fk_resp_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes (id_solicitud),
CONSTRAINT fk_resp_usuario   FOREIGN KEY (id_usuario)   REFERENCES usuarios    (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO respuestas (id_solicitud, id_usuario, mensaje) VALUES
    (2, 1, 'Vacaciones aprobadas del 1 al 15 de julio. ¡Que las disfrutes!');

CREATE OR REPLACE VIEW v_solicitudes_detalle AS
SELECT
    s.id_solicitud,
    u.nombre        AS empleado,
    e.cargo,
    e.area,
    s.tipo_solicitud,
    s.descripcion,
    es.nombre_estado AS estado,
    s.fecha_creacion,
    r.mensaje       AS respuesta,
    r.fecha_respuesta
FROM solicitudes s
         JOIN empleados e  ON e.id_empleado = s.id_empleado
         JOIN usuarios  u  ON u.id_usuario  = e.id_usuario
         JOIN estados   es ON es.id_estado  = s.id_estado
         LEFT JOIN respuestas r ON r.id_solicitud = s.id_solicitud;

CREATE OR REPLACE VIEW v_certificados_detalle AS
SELECT
    c.consecutivo,
    u.nombre        AS empleado,
    e.cargo,
    e.area,
    tc.nombre_tipo  AS tipo_certificado,
    c.incluye_sueldo,
    c.canal_entrega,
    c.archivo_pdf,
    c.fecha_generacion
FROM certificados c
         JOIN empleados        e  ON e.id_empleado = c.id_empleado
         JOIN usuarios         u  ON u.id_usuario  = e.id_usuario
         JOIN tipo_certificados tc ON tc.id_tipo   = c.id_tipo;
