import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TarjetaPerfilComponent, DatoPerfil } from "../tarjeta-perfil/tarjeta-perfil.component";
import { antiguedad, fechaCorta, formatearUltimoAcceso } from "../../utils/perfil.utils";
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
  imports: [CommonModule, TarjetaPerfilComponent],
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
    this.ultimoAccesoTexto = formatearUltimoAcceso(usuario.ultimoAcceso);
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

  get antiguedad(): string {
    return antiguedad(this.empleado?.fecha_ingreso || this.empleado?.fechaIngreso);
  }

  get datosPerfil(): DatoPerfil[] {
    const e = this.empleado;
    return [
      { icono: "cedula", etiqueta: "Cédula", valor: e?.cedula || "" },
      { icono: "area", etiqueta: "Área", valor: e?.area || "" },
      { icono: "fecha", etiqueta: "Fecha de ingreso", valor: fechaCorta(e?.fecha_ingreso || e?.fechaIngreso) },
      { icono: "reloj", etiqueta: "Último ingreso", valor: this.ultimoAccesoTexto },
    ];
  }

  // Cuando se pide un PDF (blob), el cuerpo del error también llega como blob: se lee para mostrar el motivo.
  private async leerMensajeError(err: any): Promise<string> {
    try {
      if (err.error instanceof Blob) return JSON.parse(await err.error.text()).mensaje;
    } catch { /* se usa el mensaje por defecto */ }
    return err.error?.mensaje || err.message;
  }
}
