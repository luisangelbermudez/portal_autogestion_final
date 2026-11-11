export interface Empleado {
  id_empleado?: number;
  idUsuario?: number;
  cedula: string;
  cargo: string;
  area: string;
  fechaIngreso: string;
  fecha_ingreso?: string;
  salario: number;
  promedioHorasExtras: number;
  promedio_horas_extras?: number;
  nombre?: string;
  correo?: string;
  tipo_documento?: string;
  numero_documento?: string;
  genero?: string;
}

export interface ResultadoCargaMasiva {
  mensaje: string;
  insertados: number;
  fallidos: number;
  errores: string[];
}
