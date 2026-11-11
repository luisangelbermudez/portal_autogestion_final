export interface Certificado {
  id_certificado?: number;
  id_empleado?: number;
  id_tipo?: number;
  consecutivo?: number;
  incluye_sueldo?: boolean;
  fecha_generacion?: string;
  canal_entrega?: string;
  archivo_pdf?: string;
}

export interface GenerarCertificadoRequest {
  idUsuario: number;
  tipoCarta: "todos" | "sin_basico" | "con_extras";
  canal: "pdf" | "correo";
}
