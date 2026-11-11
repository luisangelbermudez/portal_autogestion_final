export interface Usuario {
  idUsuario?: number;
  tipoDocumento: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  genero: string;
  nombre: string; // nombre completo (lo arma el servidor)
  correo: string;
  contrasena?: string;
  idRol: number;
  idEstado: number;
  rolNombre?: string;
  ultimoAcceso?: string | null;
}
