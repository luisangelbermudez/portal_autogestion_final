import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";
import { AuthService } from "./services/auth.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  title = "Portal de Autogestión de Empleados - Acegrasco S.A.";
  mostrarNav = false;

  constructor(public authService: AuthService, private router: Router) {
    this.actualizarNav();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.actualizarNav();
    });
  }

  get usuario() {
    return this.authService.obtenerUsuario();
  }

  get iniciales(): string {
    const partes = (this.usuario?.nombre || "").trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase();
  }

  get rol(): string {
    return this.usuario?.rolNombre || (this.authService.esAdministrador() ? "Administrador" : "Empleado");
  }

  actualizarNav(): void {
    this.mostrarNav = this.authService.estaAutenticado() && this.router.url !== "/login";
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }
}
