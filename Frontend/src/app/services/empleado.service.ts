import { Injectable } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, catchError, of, throwError } from "rxjs";
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

  /** Devuelve el empleado con ese número de documento, o null si no existe. */
  consultarPorDocumento(documento: string): Observable<Empleado | null> {
    return this.http.get<Empleado>(`${this.baseUrl}?documento=${encodeURIComponent(documento.trim())}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err)))
    );
  }

  /** Descarga la plantilla de Excel (el token viaja en el encabezado, por eso no es un enlace simple). */
  descargarPlantilla(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/plantilla`, { responseType: "blob" });
  }

  crear(empleado: any): Observable<any> {
    return this.http.post(this.baseUrl, empleado);
  }

  actualizar(empleado: any): Observable<any> {
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
