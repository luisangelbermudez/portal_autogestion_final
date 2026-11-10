import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Usuario } from "../../models/usuario.model";
import { UsuarioService } from "../../services/usuario.service";

@Component({
  selector: "app-usuarios",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.css",
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  usuarioSeleccionado: Usuario = this.usuarioVacio();
  modoEdicion = false;
  mensaje = "";
  cargando = false;

  constructor(private usuarioService: UsuarioService) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  usuarioVacio(): Usuario {
    return { nombre: "", correo: "", contrasena: "", idRol: 2, idEstado: 1 };
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.usuarioService.listar().subscribe({
      next: (data) => { this.usuarios = data; this.cargando = false; },
      error: (err) => { this.mensaje = "Error al cargar usuarios: " + err.message; this.cargando = false; },
    });
  }

  guardar(): void {
    if (this.modoEdicion) {
      this.usuarioService.actualizar(this.usuarioSeleccionado).subscribe({
        next: () => { this.mensaje = "Usuario actualizado correctamente"; this.cancelar(); this.cargarUsuarios(); },
        error: (err) => this.mensaje = "Error al actualizar: " + err.message,
      });
    } else {
      this.usuarioService.crear(this.usuarioSeleccionado).subscribe({
        next: () => { this.mensaje = "Usuario creado correctamente"; this.cancelar(); this.cargarUsuarios(); },
        error: (err) => this.mensaje = "Error al crear: " + err.message,
      });
    }
  }

  editar(usuario: Usuario): void {
    this.usuarioSeleccionado = { ...usuario, contrasena: "" };
    this.modoEdicion = true;
  }

  eliminar(id?: number): void {
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    this.usuarioService.eliminar(id).subscribe({
      next: () => { this.mensaje = "Usuario eliminado correctamente"; this.cargarUsuarios(); },
      error: (err) => this.mensaje = "Error al eliminar: " + err.message,
    });
  }

  cancelar(): void {
    this.usuarioSeleccionado = this.usuarioVacio();
    this.modoEdicion = false;
  }
}
