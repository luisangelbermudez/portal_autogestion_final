import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { CertificadoService } from "../../services/certificado.service";
import { EmpleadoService } from "../../services/empleado.service";
import { AuthService } from "../../services/auth.service";
import { Certificado, GenerarCertificadoRequest } from "../../models/certificado.model";
import { Empleado } from "../../models/empleado.model";

interface OpcionCertificado {
  valor: "todos" | "sin_basico" | "con_extras";
  icono: string;
  titulo: string;
  descripcion: string;
  detalle: string;
}

@Component({
  selector: "app-certificados",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./certificados.component.html",
  styleUrl: "./certificados.component.css",
})
export class CertificadosComponent implements OnInit {
  empleado: Empleado | null = null;
  historial: Certificado[] = [];
  mensaje = "";
  tipoMensaje: "exito" | "error" = "exito";
  generando = false;
  ultimoAccesoTexto = "";

  readonly opciones: OpcionCertificado[] = [
    {
      valor: "todos", icono: "📋", titulo: "Certificación Laboral Completa",
      descripcion: "Nombre, cédula, cargo, área, ingreso y salario básico",
      detalle: "Incluye nombre, cédula, cargo, área, fecha de ingreso y salario básico mensual. Para trámites financieros o bancarios.",
    },
    {
      valor: "sin_basico", icono: "📄", titulo: "Sin Salario Básico",
      descripcion: "Igual que el anterior pero sin mencionar el salario",
      detalle: "Incluye nombre, cédula, cargo, área y fecha de ingreso, sin mencionar el salario. Ideal cuando no se requiere revelar los ingresos.",
    },
    {
      valor: "con_extras", icono: "⏱️", titulo: "Con Horas Extras",
      descripcion: "Incluye el promedio de horas extras de los últimos 3 meses",
      detalle: "Incluye todos los datos anteriores más el promedio de horas extras de los últimos 3 meses.",
    },
  ];

  opcionSeleccionada: OpcionCertificado = this.opciones[0];

  constructor(
    private certificadoService: CertificadoService,
    private empleadoService: EmpleadoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario) return;
    this.ultimoAccesoTexto = this.formatearUltimoAcceso(usuario.ultimoAcceso);
    this.empleadoService.consultarPorIdUsuario(usuario.idUsuario!).subscribe({
      next: (emp) => {
        this.empleado = emp;
        this.cargarHistorial();
      },
      error: () => (this.mensaje = "No se encontró un perfil de empleado asociado a tu usuario."),
    });
  }

  cargarHistorial(): void {
    if (!this.empleado?.id_empleado) return;
    this.certificadoService.historialPorEmpleado(this.empleado.id_empleado).subscribe({
      next: (data) => (this.historial = data),
    });
  }

  seleccionar(opcion: OpcionCertificado): void {
    this.opcionSeleccionada = opcion;
    this.mensaje = "";
  }

  descargarPdf(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario) return;

    const solicitud: GenerarCertificadoRequest = {
      idUsuario: usuario.idUsuario!,
      tipoCarta: this.opcionSeleccionada.valor,
      canal: "pdf",
    };
    this.generando = true;
    this.mensaje = "";

    this.certificadoService.generarPdf(solicitud).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `certificado-${this.opcionSeleccionada.valor}.pdf`;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.tipoMensaje = "exito";
        this.mensaje = "Certificado generado y descargado correctamente.";
        this.generando = false;
        this.cargarHistorial();
      },
      error: async (err) => {
        this.tipoMensaje = "error";
        this.mensaje = "Error al generar el certificado: " + (await this.leerMensajeError(err));
        this.generando = false;
      },
    });
  }

  enviarPorCorreo(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario) return;

    const solicitud: GenerarCertificadoRequest = {
      idUsuario: usuario.idUsuario!,
      tipoCarta: this.opcionSeleccionada.valor,
      canal: "correo",
    };
    this.generando = true;
    this.mensaje = "";

    this.certificadoService.generarYEnviarPorCorreo(solicitud).subscribe({
      next: (resp) => {
        this.tipoMensaje = "exito";
        this.mensaje = resp.mensaje;
        this.generando = false;
        this.cargarHistorial();
      },
      error: (err) => {
        this.tipoMensaje = "error";
        this.mensaje = "Error al enviar el certificado: " + (err.error?.mensaje || err.message);
        this.generando = false;
      },
    });
  }

  // ---------- datos de la tarjeta de perfil ----------

  get iniciales(): string {
    const partes = (this.empleado?.nombre || "").trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase();
  }

  private fechaIngreso(): Date | null {
    const texto = this.empleado?.fecha_ingreso || this.empleado?.fechaIngreso;
    if (!texto) return null;
    // Se toma solo AAAA-MM-DD para evitar corrimientos por zona horaria.
    const [a, m, d] = texto.substring(0, 10).split("-").map(Number);
    return a && m && d ? new Date(a, m - 1, d) : null;
  }

  get fechaIngresoTexto(): string {
    const f = this.fechaIngreso();
    return f ? `${this.dos(f.getDate())}/${this.dos(f.getMonth() + 1)}/${f.getFullYear()}` : "";
  }

  /** Tiempo en la compañía: "6 años y 4 meses". */
  get antiguedad(): string {
    const ingreso = this.fechaIngreso();
    if (!ingreso) return "No disponible";
    const hoy = new Date();
    let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
    if (hoy.getDate() < ingreso.getDate()) meses--;
    if (meses < 1) return "Menos de 1 mes";
    const anios = Math.floor(meses / 12);
    const resto = meses % 12;
    const tAnios = anios === 1 ? "1 año" : `${anios} años`;
    const tMeses = resto === 1 ? "1 mes" : `${resto} meses`;
    if (anios === 0) return tMeses;
    return resto === 0 ? tAnios : `${tAnios} y ${tMeses}`;
  }

  private formatearUltimoAcceso(valor?: string | null): string {
    if (valor === undefined) return "No disponible";
    if (valor === null) return "Primer ingreso al portal";
    const f = new Date(valor);
    if (isNaN(f.getTime())) return "No disponible";
    const h = f.getHours();
    const sufijo = h < 12 ? "a. m." : "p. m.";
    return `${this.dos(f.getDate())}/${this.dos(f.getMonth() + 1)}/${f.getFullYear()} ${this.dos(h % 12 || 12)}:${this.dos(f.getMinutes())} ${sufijo}`;
  }

  private dos(n: number): string {
    return n.toString().padStart(2, "0");
  }

  // Cuando se pide un PDF (blob), el cuerpo del error también llega como blob: se lee para mostrar el motivo.
  private async leerMensajeError(err: any): Promise<string> {
    try {
      if (err.error instanceof Blob) return JSON.parse(await err.error.text()).mensaje;
    } catch { /* se usa el mensaje por defecto */ }
    return err.error?.mensaje || err.message;
  }
}
