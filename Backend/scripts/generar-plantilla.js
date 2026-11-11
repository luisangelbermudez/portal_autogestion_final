// Genera plantilla_carga_empleados.xlsx (hoja "Empleados" solo con encabezados + hoja "Instrucciones").
const XLSX = require("xlsx");
const columnas = ["tipoDocumento", "numeroDocumento", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido", "genero", "correo", "contrasena", "cargo", "area", "fechaIngreso", "salario", "promedioHorasExtras"];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([columnas]), "Empleados");
const instrucciones = [
  ["Columna", "Obligatoria", "Qué escribir"],
  ["tipoDocumento", "Sí", "CC (Cédula de Ciudadanía), CE (Cédula de Extranjería), PPT (Permiso por Protección Temporal) o PA (Pasaporte)"],
  ["numeroDocumento", "Sí", "Solo números (5 a 15 dígitos); en pasaporte puede incluir letras. No puede repetirse"],
  ["primerNombre", "Sí", "Primer nombre"],
  ["segundoNombre", "No", "Segundo nombre"],
  ["primerApellido", "Sí", "Primer apellido"],
  ["segundoApellido", "No", "Segundo apellido"],
  ["genero", "Sí", "Masculino o Femenino (también se acepta M o F)"],
  ["correo", "Sí", "Correo de acceso al portal; no puede repetirse"],
  ["contrasena", "No", "Mínimo 6 caracteres. Si se deja vacía, se asigna 123456"],
  ["cargo", "Sí", "Cargo del empleado"],
  ["area", "Sí", "Área o dependencia"],
  ["fechaIngreso", "Sí", "AAAA-MM-DD (por ejemplo 2024-03-15); no puede ser futura"],
  ["salario", "No", "Salario básico mensual, sin puntos ni símbolos (por ejemplo 3500000)"],
  ["promedioHorasExtras", "No", "Promedio de horas extras de los últimos 3 meses"],
  [],
  ["Ejemplo de una fila", "", "CC | 1012345678 | Ana | María | Pérez | Gómez | Femenino | ana.perez@empresa.com | | Analista | Tecnología | 2024-03-15 | 3500000 | 0"],
  ["Importante", "", "Escribe los datos en la hoja Empleados, desde la fila 2. Esta hoja es solo una guía. No cambies los nombres de las columnas."],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instrucciones), "Instrucciones");
wb.Sheets["Empleados"]["!cols"] = columnas.map(() => ({ wch: 20 }));
wb.Sheets["Instrucciones"]["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 110 }];
XLSX.writeFile(wb, __dirname + "/../plantilla_carga_empleados.xlsx");
console.log("plantilla generada");
