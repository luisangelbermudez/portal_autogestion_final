import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Usuario } from "../models/usuario.model";

@Injectable({ providedIn: "root" })
export class UsuarioService {
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  consultarPorId(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.baseUrl}?id=${id}`);
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
