// Forma en la que el backend devuelve las solicitudes (columnas reales de la tabla, snake_case)
export interface Solicitud {
  id_solicitud?: number;
  id_empleado?: number;
  id_estado?: number;
  tipo_solicitud?: string;
  descripcion?: string;
  fecha_creacion?: string;
  nombre_empleado?: string;
  cedula_empleado?: string;
  respuesta?: string | null; // último mensaje escrito por el administrador
}

// Forma que espera el backend al crear una solicitud (el controlador lee camelCase del body)
export interface NuevaSolicitud {
  idEmpleado: number;
  tipoSolicitud: string;
  descripcion: string;
}
