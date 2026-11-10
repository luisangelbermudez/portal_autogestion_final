import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Empleado, ResultadoCargaMasiva } from "../models/empleado.model";

@Injectable({ providedIn: "root" })
export class EmpleadoService {
  private readonly baseUrl = `${environment.apiUrl}/empleados`;

  constructor(private http: HttpClient) {}

  listar(): Observable<Empleado[]> {
    return this.http.get<Empleado[]>(this.baseUrl);
  }

  consultarPorId(id: number): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.baseUrl}?id=${id}`);
  }

  consultarPorIdUsuario(idUsuario: number): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.baseUrl}?idUsuario=${idUsuario}`);
  }

  crear(empleado: Empleado): Observable<any> {
    return this.http.post(this.baseUrl, empleado);
  }

  actualizar(empleado: Empleado): Observable<any> {
    return this.http.put(this.baseUrl, empleado);
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}?id=${id}`);
  }

  cargaMasiva(archivo: File): Observable<ResultadoCargaMasiva> {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return this.http.post<ResultadoCargaMasiva>(`${this.baseUrl}/carga-masiva`, formData);
  }
}
