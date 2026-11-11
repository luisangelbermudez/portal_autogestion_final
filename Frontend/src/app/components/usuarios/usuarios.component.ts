import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Usuario } from "../../models/usuario.model";
import { UsuarioService } from "../../services/usuario.service";
import { GENEROS, TIPOS_DOCUMENTO, nombreTipoDocumento } from "../../models/catalogos";

@Component({
  selector: "app-usuarios",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.css",
})
export class UsuariosComponent implements OnInit {
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly generos = GENEROS;
  readonly nombreTipo = nombreTipoDocumento;

  usuarios: Usuario[] = [];
  usuarioSeleccionado: Usuario = this.usuarioVacio();
  modoEdicion = false;
  /** Paso 1: tipo y número de documento. Paso 2: el resto de los datos. */
  paso: "identificacion" | "formulario" = "identificacion";
  documentoTipo = "CC";
  documentoNumero = "";
  existente: Usuario | null = null;
  busqueda = "";
  mensaje = "";
  tipoMensaje: "exito" | "error" = "exito";
  cargando = false;

  constructor(private usuarioService: UsuarioService) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  usuarioVacio(): Usuario {
    return { tipoDocumento: "CC", numeroDocumento: "", primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "", genero: "", nombre: "", correo: "", contrasena: "", idRol: 2, idEstado: 1 };
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.usuarioService.listar().subscribe({
      next: (data) => { this.usuarios = data; this.cargando = false; },
      error: (err) => { this.avisar("error", "Error al cargar usuarios: " + (err.error?.mensaje || err.message)); this.cargando = false; },
    });
  }

  private avisar(tipo: "exito" | "error", texto: string): void {
    this.tipoMensaje = tipo;
    this.mensaje = texto;
  }

  // ----- Paso 1: identificación -----
  continuar(): void {
    this.mensaje = "";
    this.existente = null;
    const numero = this.documentoNumero.trim();
    if (!numero) return this.avisar("error", "Escribe el número de documento");
    this.usuarioService.buscarPorDocumento(numero).subscribe({
      next: (u) => {
        if (u) {
          this.existente = u;
          this.avisar("error", `Ya existe un usuario con ese documento: ${u.nombre}.`);
        } else {
          this.usuarioSeleccionado = { ...this.usuarioVacio(), tipoDocumento: this.documentoTipo, numeroDocumento: numero };
          this.paso = "formulario";
        }
      },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo consultar el documento"),
    });
  }

  // ----- Búsqueda para editar por número de documento -----
  buscar(): void {
    this.mensaje = "";
    const numero = this.busqueda.trim();
    if (!numero) return this.avisar("error", "Escribe el número de documento que quieres buscar");
    this.usuarioService.buscarPorDocumento(numero).subscribe({
      next: (u) => (u ? this.editar(u) : this.avisar("error", "No se encontró un usuario con ese número de documento")),
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo realizar la búsqueda"),
    });
  }

  guardar(): void {
    this.mensaje = "";
    const peticion = this.modoEdicion
      ? this.usuarioService.actualizar(this.usuarioSeleccionado)
      : this.usuarioService.crear(this.usuarioSeleccionado);
    peticion.subscribe({
      next: (resp) => { this.avisar("exito", resp.mensaje); this.cancelar(false); this.cargarUsuarios(); },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo guardar el usuario"),
    });
  }

  editar(usuario: Usuario): void {
    this.usuarioSeleccionado = { ...usuario, contrasena: "" };
    this.modoEdicion = true;
    this.paso = "formulario";
    this.existente = null;
    this.busqueda = "";
  }

  eliminar(usuario: Usuario): void {
    if (!usuario.idUsuario) return;
    if (!confirm(`¿Seguro que deseas eliminar a ${usuario.nombre}?`)) return;
    this.usuarioService.eliminar(usuario.idUsuario).subscribe({
      next: () => { this.avisar("exito", "Usuario eliminado correctamente"); this.cargarUsuarios(); },
      error: (err) => this.avisar("error", err.error?.mensaje || "No se pudo eliminar el usuario"),
    });
  }

  cancelar(limpiarMensaje = true): void {
    this.usuarioSeleccionado = this.usuarioVacio();
    this.modoEdicion = false;
    this.paso = "identificacion";
    this.documentoNumero = "";
    this.documentoTipo = "CC";
    this.existente = null;
    if (limpiarMensaje) this.mensaje = "";
  }
}
