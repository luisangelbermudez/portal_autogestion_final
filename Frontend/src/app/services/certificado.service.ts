import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Certificado, GenerarCertificadoRequest } from "../models/certificado.model";

@Injectable({ providedIn: "root" })
export class CertificadoService {
  private readonly baseUrl = `${environment.apiUrl}/certificados`;

  constructor(private http: HttpClient) {}

  historialPorEmpleado(idEmpleado: number): Observable<Certificado[]> {
    return this.http.get<Certificado[]>(`${this.baseUrl}?idEmpleado=${idEmpleado}`);
  }

  listarTodos(): Observable<Certificado[]> {
    return this.http.get<Certificado[]>(this.baseUrl);
  }

  // Para canal = correo, la API responde JSON
  generarYEnviarPorCorreo(datos: GenerarCertificadoRequest): Observable<any> {
    return this.http.post(this.baseUrl, datos);
  }

  // Para canal = pdf, la API responde un binario (blob) para descargar
  generarPdf(datos: GenerarCertificadoRequest): Observable<Blob> {
    return this.http.post(this.baseUrl, datos, { responseType: "blob" });
  }
}
