import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Solicitud, NuevaSolicitud } from "../../models/solicitud.model";
import { SolicitudService } from "../../services/solicitud.service";
import { AuthService } from "../../services/auth.service";
import { EmpleadoService } from "../../services/empleado.service";

@Component({
  selector: "app-solicitudes",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./solicitudes.component.html",
  styleUrl: "./solicitudes.component.css",
})
export class SolicitudesComponent implements OnInit {
  solicitudes: Solicitud[] = [];
  nuevaSolicitud: NuevaSolicitud = this.solicitudVacia();
  mensaje = "";
  cargando = false;
  miIdEmpleado: number | null = null;
  rechazando: Solicitud | null = null; // solicitud a la que se está escribiendo el motivo de rechazo
  motivo = "";

  readonly ESTADOS: Record<number, string> = {
    1: "Activo", 2: "Inactivo", 3: "Pendiente", 4: "En revisión", 5: "Aprobado", 6: "Rechazado",
  };

  constructor(
    private solicitudService: SolicitudService,
    public authService: AuthService,
    private empleadoService: EmpleadoService
  ) {}

  ngOnInit(): void {
    if (this.authService.esAdministrador()) {
      this.cargarSolicitudes();
    } else {
      // El empleado solo ve y crea SUS propias solicitudes
      const usuario = this.authService.obtenerUsuario();
      if (usuario) {
        this.empleadoService.consultarPorIdUsuario(usuario.idUsuario!).subscribe({
          next: (emp) => {
            this.miIdEmpleado = emp.id_empleado!;
            this.nuevaSolicitud.idEmpleado = emp.id_empleado!;
            this.cargarMisSolicitudes();
          },
        });
      }
    }
  }

  solicitudVacia(): NuevaSolicitud {
    return { idEmpleado: 0, tipoSolicitud: "", descripcion: "" };
  }

  cargarSolicitudes(): void {
    this.cargando = true;
    this.solicitudService.listar().subscribe({
      next: (data) => { this.solicitudes = data; this.cargando = false; },
      error: (err) => { this.mensaje = "Error al cargar solicitudes: " + err.message; this.cargando = false; },
    });
  }

  cargarMisSolicitudes(): void {
    if (!this.miIdEmpleado) return;
    this.cargando = true;
    this.solicitudService.listarPorEmpleado(this.miIdEmpleado).subscribe({
      next: (data) => { this.solicitudes = data; this.cargando = false; },
      error: (err) => { this.mensaje = "Error al cargar tus solicitudes: " + err.message; this.cargando = false; },
    });
  }

  crear(): void {
    this.solicitudService.crear(this.nuevaSolicitud).subscribe({
      next: () => {
        this.mensaje = "Solicitud enviada correctamente";
        const idEmpleado = this.nuevaSolicitud.idEmpleado;
        this.nuevaSolicitud = this.solicitudVacia();
        this.nuevaSolicitud.idEmpleado = idEmpleado;
        this.authService.esAdministrador() ? this.cargarSolicitudes() : this.cargarMisSolicitudes();
      },
      error: (err) => this.mensaje = "Error al enviar la solicitud: " + (err.error?.mensaje || err.message),
    });
  }

  cambiarEstado(solicitud: Solicitud, nuevoEstado: number, mensaje?: string): void {
    if (!solicitud.id_solicitud) return;
    this.solicitudService.actualizarEstado(solicitud.id_solicitud, nuevoEstado, mensaje).subscribe({
      next: () => { this.mensaje = "Estado actualizado correctamente"; this.cargarSolicitudes(); },
      error: (err) => this.mensaje = "Error al actualizar estado: " + (err.error?.mensaje || err.message),
    });
  }

  // Al rechazar se pide el motivo, que el empleado verá en su tabla de solicitudes.
  abrirRechazo(solicitud: Solicitud): void {
    this.rechazando = solicitud;
    this.motivo = "";
  }

  cancelarRechazo(): void {
    this.rechazando = null;
    this.motivo = "";
  }

  confirmarRechazo(): void {
    if (!this.rechazando || !this.motivo.trim()) return;
    this.cambiarEstado(this.rechazando, 6, this.motivo.trim());
    this.cancelarRechazo();
  }

  eliminar(id?: number): void {
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar esta solicitud?")) return;
    this.solicitudService.eliminar(id).subscribe({
      next: () => {
        this.mensaje = "Solicitud eliminada correctamente";
        this.authService.esAdministrador() ? this.cargarSolicitudes() : this.cargarMisSolicitudes();
      },
      error: (err) => this.mensaje = "Error al eliminar: " + (err.error?.mensaje || err.message),
    });
  }
}
