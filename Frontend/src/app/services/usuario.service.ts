import { Injectable } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, catchError, map, of, throwError } from "rxjs";
import { environment } from "../../environments/environment";
import { Usuario } from "../models/usuario.model";

@Injectable({ providedIn: "root" })
export class UsuarioService {
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  // La API devuelve los campos en snake_case (id_usuario...); aquí se pasan a camelCase.
  private mapear(r: any): Usuario {
    return {
      idUsuario: r.id_usuario,
      tipoDocumento: r.tipo_documento || "CC",
      numeroDocumento: r.numero_documento || "",
      primerNombre: r.primer_nombre || "",
      segundoNombre: r.segundo_nombre || "",
      primerApellido: r.primer_apellido || "",
      segundoApellido: r.segundo_apellido || "",
      genero: r.genero || "",
      nombre: r.nombre,
      correo: r.correo,
      idRol: r.id_rol,
      idEstado: r.id_estado,
    };
  }

  listar(): Observable<Usuario[]> {
    return this.http.get<any[]>(this.baseUrl).pipe(map((lista) => lista.map((r) => this.mapear(r))));
  }

  /** Devuelve el usuario con ese número de documento, o null si no existe. */
  buscarPorDocumento(numero: string): Observable<Usuario | null> {
    return this.http.get<any>(`${this.baseUrl}?documento=${encodeURIComponent(numero.trim())}`).pipe(
      map((r) => this.mapear(r)),
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err)))
    );
  }

  crear(usuario: Usuario): Observable<any> {
    return this.http.post(this.baseUrl, usuario);
  }

  actualizar(usuario: Usuario): Observable<any> {
    return this.http.put(this.baseUrl, usuario);
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}?id=${id}`);
  }
}
