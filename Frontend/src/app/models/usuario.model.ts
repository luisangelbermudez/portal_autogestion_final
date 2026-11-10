export interface Usuario {
  idUsuario?: number;
  nombre: string;
  correo: string;
  contrasena?: string;
  idRol: number;
  idEstado: number;
  rolNombre?: string;
  ultimoAcceso?: string | null;
}
