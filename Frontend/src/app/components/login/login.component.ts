import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
})
export class LoginComponent implements OnInit, OnDestroy {
  correo = "";
  contrasena = "";
  error = "";
  cargando = false;

  // Carrusel de imágenes
  readonly imagenes = [
    { src: "assets/imagenes/portal1.JPG", etiqueta: "Bienvenido", titulo: "Portal de Autogestión Acegrasco", descripcion: "Gestiona tus solicitudes y certificados de forma rápida, segura y desde cualquier dispositivo." },
    { src: "assets/imagenes/portal2.jpg", etiqueta: "Trámites en línea", titulo: "Solicitudes sin filas ni papeleo", descripcion: "Radica permisos, vacaciones y novedades laborales desde donde estés." },
    { src: "assets/imagenes/portal3.JPG", etiqueta: "Certificados al instante", titulo: "Genera tus certificados laborales", descripcion: "Descárgalos en PDF o recíbelos directamente en tu correo, en segundos." },
  ];
  indiceActual = 0;
  private intervalo: any;

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.intervalo = setInterval(() => this.siguiente(), 5000);
    if (this.route.snapshot.queryParamMap.get("expirada")) {
      this.error = "Tu sesión expiró. Inicia sesión nuevamente.";
    }
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  siguiente(): void {
    this.indiceActual = (this.indiceActual + 1) % this.imagenes.length;
  }

  anterior(): void {
    this.indiceActual = (this.indiceActual - 1 + this.imagenes.length) % this.imagenes.length;
  }

  irA(indice: number): void {
    this.indiceActual = indice;
  }

  ingresar(): void {
    this.error = "";
    if (!this.correo || !this.contrasena) {
      this.error = "Ingresa tu correo y contraseña";
      return;
    }
    this.cargando = true;
    this.authService.login(this.correo, this.contrasena).subscribe({
      next: () => {
        this.cargando = false;
        this.router.navigate(["/"]);
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.mensaje || "No se pudo iniciar sesión. Verifica tus credenciales.";
      },
    });
  }
}
