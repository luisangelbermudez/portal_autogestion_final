import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Empleado, ResultadoCargaMasiva } from "../../models/empleado.model";
import { Usuario } from "../../models/usuario.model";
import { EmpleadoService } from "../../services/empleado.service";
import { UsuarioService } from "../../services/usuario.service";
import { nombreTipoDocumento } from "../../models/catalogos";

interface PersonaVista { nombre: string; correo: string; genero: string; tipoDocumento: string; numeroDocumento: string; }

@Component({
  selector: "app-empleados",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./empleados.component.html",
  styleUrl: "./empleados.component.css",
})
export class EmpleadosComponent implements OnInit {
  readonly nombreTipo = nombreTipoDocumento;

  empleados: Empleado[] = [];
  /** Datos laborales del formulario; el id del empleado lo maneja el sistema internamente. */
  form = this.formVacio();
  persona: PersonaVista | null = null;
  modoEdicion = false;
  paso: "busqueda" | "formulario" = "busqueda";
  documentoNuevo = "";
  busqueda = "";
  faltaUsuario = false;
  mensaje = "";
  tipoMensaje: "exito" | "error" = "exito";
  cargando = false;

  archivoSeleccionado: File | null = null;
  cargandoExcel = false;
  resultadoCarga: ResultadoCargaMasiva | null = null;

  constructor(private empleadoService: EmpleadoService, private usuarioService: UsuarioService) {}

  ngOnInit(): void { this.cargarEmpleados(); }

  formVacio() {
    return { idEmpleado: 0, cargo: "", area: "", fechaIngreso: "", salario: 0, promedioHorasExtras: 0 };
  }

  private avisar(tipo: "exito" | "error", texto: string): void {
    this.tipoMensaje = tipo;
    this.mensaje = texto;
  }

  cargarEmpleados(): void {
    this.cargando = true;
    this.empleadoService.listar().subscribe({
      next: (data) => { this.empleados = data; this.cargando = false; },
      error: (err) => { this.avisar("error", "Error al cargar empleados: " + (err.error?.mensaje || err.message)); this.cargando = false; },
    });
  }

  // ----- Nuevo empleado: se busca a la persona por su documento -----
  buscarPersona(): void {
    this.mensaje = "";
    this.faltaUsuario = false;
    const documento = this.documentoNuevo.trim();
    if (!documento) return this.avisar("error", "Escribe el número de documento de la persona");

    this.empleadoService.consultarPorDocumento(documento).subscribe({
      next: (emp) => {
        if (emp) {
          this.avisar("error", `${emp.nombre} ya está registrado como empleado: puedes editarlo.`);
          return this.editar(emp);
        }
        this.usuarioService.buscarPorDocumento(documento).subscribe({
          next: (u: Usuario | null) => {
            if (!u) {
              this.faltaUsuario = true;
              return this.avisar("error", "No existe un usuario con ese número de documento. Primero créalo en el módulo Usuarios.");
            }
            this.persona = { nombre: u.nombre, correo: u.correo, genero: u.genero, tipoDocumento: u.tipoDocumento, numeroDocumento: u.numeroDocumento };
            this.form = this.formVacio();
            this.modoEdicion = false;
            this.paso = "formulario";
          },
          error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo consultar el documento"),
        });
      },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo consultar el documento"),
    });
  }

  // ----- Editar: por búsqueda de documento o desde la tabla -----
  buscarParaEditar(): void {
    this.mensaje = "";
    const documento = this.busqueda.trim();
    if (!documento) return this.avisar("error", "Escribe el número de documento del empleado");
    this.empleadoService.consultarPorDocumento(documento).subscribe({
      next: (emp) => (emp ? this.editar(emp) : this.avisar("error", "No existe un empleado con ese número de documento")),
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo realizar la búsqueda"),
    });
  }

  editar(e: Empleado): void {
    this.persona = {
      nombre: e.nombre || "", correo: e.correo || "", genero: e.genero || "",
      tipoDocumento: e.tipo_documento || "CC", numeroDocumento: e.numero_documento || e.cedula,
    };
    this.form = {
      idEmpleado: e.id_empleado || 0,
      cargo: e.cargo, area: e.area,
      fechaIngreso: (e.fecha_ingreso || e.fechaIngreso || "").substring(0, 10),
      salario: Number(e.salario) || 0,
      promedioHorasExtras: Number(e.promedio_horas_extras ?? e.promedioHorasExtras) || 0,
    };
    this.modoEdicion = true;
    this.paso = "formulario";
    this.busqueda = "";
  }

  guardar(): void {
    if (!this.persona) return;
    const peticion = this.modoEdicion
      ? this.empleadoService.actualizar({ ...this.form })
      : this.empleadoService.crear({ numeroDocumento: this.persona.numeroDocumento, ...this.form });
    peticion.subscribe({
      next: (resp) => { this.avisar("exito", resp.mensaje); this.cancelar(false); this.cargarEmpleados(); },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo guardar el empleado"),
    });
  }

  eliminar(e: Empleado): void {
    if (!e.id_empleado) return;
    if (!confirm(`¿Seguro que deseas eliminar a ${e.nombre} como empleado?`)) return;
    this.empleadoService.eliminar(e.id_empleado).subscribe({
      next: () => { this.avisar("exito", "Empleado eliminado correctamente"); this.cargarEmpleados(); },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo eliminar el empleado"),
    });
  }

  cancelar(limpiarMensaje = true): void {
    this.form = this.formVacio();
    this.persona = null;
    this.modoEdicion = false;
    this.paso = "busqueda";
    this.documentoNuevo = "";
    this.faltaUsuario = false;
    if (limpiarMensaje) this.mensaje = "";
  }

  // ----- Carga masiva -----
  descargarPlantilla(): void {
    this.empleadoService.descargarPlantilla().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = "plantilla_carga_empleados.xlsx";
        enlace.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.avisar("error", "No se pudo descargar la plantilla"),
    });
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado = input.files && input.files.length > 0 ? input.files[0] : null;
    this.resultadoCarga = null;
  }

  cargarExcel(): void {
    if (!this.archivoSeleccionado) return this.avisar("error", "Selecciona primero un archivo Excel (.xlsx)");
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
        this.avisar("error", "Error al procesar el archivo: " + (err.error?.mensaje || err.message));
        this.cargandoExcel = false;
      },
    });
  }
}
