import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { EmpleadoService } from "../../services/empleado.service";
import { SolicitudService } from "../../services/solicitud.service";
import { UsuarioService } from "../../services/usuario.service";
import { Empleado } from "../../models/empleado.model";
import { Solicitud } from "../../models/solicitud.model";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
})
export class DashboardComponent implements OnInit {
  // Datos comunes
  usuario = this.authService.obtenerUsuario();

  // Vista Empleado
  empleado: Empleado | null = null;
  misSolicitudes: Solicitud[] = [];
  totalSolicitudes = 0;
  solicitudesAtendidas = 0;
  solicitudesPendientes = 0;

  // Vista Administrador
  totalUsuarios = 0;
  totalEmpleados = 0;
  totalSolicitudesPendientesAdmin = 0;

  cargando = true;

  constructor(
    public authService: AuthService,
    private empleadoService: EmpleadoService,
    private solicitudService: SolicitudService,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    if (this.authService.esAdministrador()) {
      this.cargarDatosAdmin();
    } else {
      this.cargarDatosEmpleado();
    }
  }

  private cargarDatosEmpleado(): void {
    if (!this.usuario) return;
    this.empleadoService.consultarPorIdUsuario(this.usuario.idUsuario!).subscribe({
      next: (emp) => {
        this.empleado = emp;
        this.solicitudService.listarPorEmpleado(emp.id_empleado!).subscribe({
          next: (solicitudes) => {
            this.misSolicitudes = solicitudes.slice(0, 5);
            this.totalSolicitudes = solicitudes.length;
            this.solicitudesPendientes = solicitudes.filter((s) => s.id_estado === 3).length;
            this.solicitudesAtendidas = this.totalSolicitudes - this.solicitudesPendientes;
            this.cargando = false;
          },
          error: () => (this.cargando = false),
        });
      },
      error: () => (this.cargando = false),
    });
  }

  private cargarDatosAdmin(): void {
    this.usuarioService.listar().subscribe({ next: (u) => (this.totalUsuarios = u.length) });
    this.empleadoService.listar().subscribe({ next: (e) => (this.totalEmpleados = e.length) });
    this.solicitudService.listar().subscribe({
      next: (s) => {
        this.totalSolicitudesPendientesAdmin = s.filter((x) => x.id_estado === 3).length;
        this.cargando = false;
      },
      error: () => (this.cargando = false),
    });
  }

  readonly ESTADOS: Record<number, string> = {
    1: "Activo", 2: "Inactivo", 3: "Pendiente", 4: "En revisión", 5: "Aprobado", 6: "Rechazado",
  };
}
