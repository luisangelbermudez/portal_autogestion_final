import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Empleado, ResultadoCargaMasiva } from "../../models/empleado.model";
import { EmpleadoService } from "../../services/empleado.service";

@Component({
  selector: "app-empleados",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./empleados.component.html",
  styleUrl: "./empleados.component.css",
})
export class EmpleadosComponent implements OnInit {
  empleados: Empleado[] = [];
  empleadoSeleccionado: Empleado = this.empleadoVacio();
  modoEdicion = false;
  mensaje = "";
  cargando = false;

  archivoSeleccionado: File | null = null;
  cargandoExcel = false;
  resultadoCarga: ResultadoCargaMasiva | null = null;

  constructor(private empleadoService: EmpleadoService) {}

  ngOnInit(): void { this.cargarEmpleados(); }

  empleadoVacio(): Empleado {
    return { idUsuario: 0, cedula: "", cargo: "", area: "", fechaIngreso: "", salario: 0, promedioHorasExtras: 0 };
  }

  cargarEmpleados(): void {
    this.cargando = true;
    this.empleadoService.listar().subscribe({
      next: (data) => { this.empleados = data; this.cargando = false; },
      error: (err) => { this.mensaje = "Error al cargar empleados: " + err.message; this.cargando = false; },
    });
  }

  guardar(): void {
    if (this.modoEdicion) {
      this.empleadoService.actualizar(this.empleadoSeleccionado).subscribe({
        next: () => { this.mensaje = "Empleado actualizado correctamente"; this.cancelar(); this.cargarEmpleados(); },
        error: (err) => this.mensaje = "Error al actualizar: " + err.message,
      });
    } else {
      this.empleadoService.crear(this.empleadoSeleccionado).subscribe({
        next: () => { this.mensaje = "Empleado registrado correctamente"; this.cancelar(); this.cargarEmpleados(); },
        error: (err) => this.mensaje = "Error al registrar: " + err.message,
      });
    }
  }

  editar(empleado: Empleado): void {
    this.empleadoSeleccionado = { ...empleado };
    this.modoEdicion = true;
  }

  eliminar(id?: number): void {
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar este empleado?")) return;
    this.empleadoService.eliminar(id).subscribe({
      next: () => { this.mensaje = "Empleado eliminado correctamente"; this.cargarEmpleados(); },
      error: (err) => this.mensaje = "Error al eliminar: " + err.message,
    });
  }

  cancelar(): void {
    this.empleadoSeleccionado = this.empleadoVacio();
    this.modoEdicion = false;
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado = input.files && input.files.length > 0 ? input.files[0] : null;
    this.resultadoCarga = null;
  }

  cargarExcel(): void {
    if (!this.archivoSeleccionado) {
      this.mensaje = "Selecciona primero un archivo Excel (.xlsx)";
      return;
    }
    this.cargandoExcel = true;
    this.resultadoCarga = null;
    this.empleadoService.cargaMasiva(this.archivoSeleccionado).subscribe({
      next: (resp) => {
        this.resultadoCarga = resp;
        this.cargandoExcel = false;
        this.archivoSeleccionado = null;
        this.cargarEmpleados();
      },
      error: (err) => {
        this.mensaje = "Error al procesar el archivo: " + (err.error?.mensaje || err.message);
        this.cargandoExcel = false;
      },
    });
  }
}
