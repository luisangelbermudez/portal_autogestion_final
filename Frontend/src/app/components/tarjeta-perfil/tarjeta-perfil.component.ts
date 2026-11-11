import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { iniciales } from "../../utils/perfil.utils";

export interface DatoPerfil {
  icono: "cedula" | "area" | "fecha" | "reloj" | "correo" | "rol";
  etiqueta: string;
  valor: string;
}

/** Tarjeta de perfil que se usa en Inicio y en Certificados. */
@Component({
  selector: "app-tarjeta-perfil",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./tarjeta-perfil.component.html",
  styleUrl: "./tarjeta-perfil.component.css",
})
export class TarjetaPerfilComponent {
  @Input() nombre = "";
  @Input() subtitulo = "";
  @Input() selloValor = "";
  @Input() selloEtiqueta = "en la compañía";
  @Input() datos: DatoPerfil[] = [];

  get iniciales(): string {
    return iniciales(this.nombre);
  }
}
