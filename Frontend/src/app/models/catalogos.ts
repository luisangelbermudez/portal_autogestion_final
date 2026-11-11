export const TIPOS_DOCUMENTO = [
  { codigo: "CC", nombre: "Cédula de Ciudadanía" },
  { codigo: "CE", nombre: "Cédula de Extranjería" },
  { codigo: "PPT", nombre: "Permiso por Protección Temporal" },
  { codigo: "PA", nombre: "Pasaporte" },
];
export const GENEROS = ["Masculino", "Femenino"];
export const nombreTipoDocumento = (codigo?: string): string =>
  TIPOS_DOCUMENTO.find((t) => t.codigo === codigo)?.nombre || codigo || "";
