import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../environments/environment";
import { Usuario } from "../models/usuario.model";

const CLAVE_SESION = "autogestion_usuario";
const CLAVE_TOKEN = "autogestion_token";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/login`;

  constructor(private http: HttpClient) {}

  login(correo: string, contrasena: string): Observable<{ mensaje: string; token: string; usuario: Usuario }> {
    return this.http
      .post<{ mensaje: string; token: string; usuario: Usuario }>(this.baseUrl, { correo, contrasena })
      .pipe(
        tap((resp) => {
          sessionStorage.setItem(CLAVE_SESION, JSON.stringify(resp.usuario));
          sessionStorage.setItem(CLAVE_TOKEN, resp.token);
        })
      );
  }

  cambiarContrasena(actual: string, nueva: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.baseUrl}/contrasena`, { actual, nueva });
  }

  logout(): void {
    sessionStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem(CLAVE_TOKEN);
  }

  obtenerToken(): string | null {
    return sessionStorage.getItem(CLAVE_TOKEN);
  }

  obtenerUsuario(): Usuario | null {
    const datos = sessionStorage.getItem(CLAVE_SESION);
    return datos ? JSON.parse(datos) : null;
  }

  estaAutenticado(): boolean {
    return this.obtenerUsuario() !== null && this.obtenerToken() !== null;
  }

  esAdministrador(): boolean {
    const usuario = this.obtenerUsuario();
    return usuario?.idRol === 1;
  }

  esEmpleado(): boolean {
    const usuario = this.obtenerUsuario();
    return usuario?.idRol === 2;
  }
}
