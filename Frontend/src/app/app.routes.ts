import { Routes } from "@angular/router";
import { DashboardComponent } from "./components/dashboard/dashboard.component";
import { UsuariosComponent } from "./components/usuarios/usuarios.component";
import { EmpleadosComponent } from "./components/empleados/empleados.component";
import { SolicitudesComponent } from "./components/solicitudes/solicitudes.component";
import { CertificadosComponent } from "./components/certificados/certificados.component";
import { CambiarContrasenaComponent } from "./components/cambiar-contrasena/cambiar-contrasena.component";
import { LoginComponent } from "./components/login/login.component";
import { authGuard } from "./guards/auth.guard";
import { adminGuard } from "./guards/admin.guard";

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  { path: "", component: DashboardComponent, canActivate: [authGuard] },
  { path: "usuarios", component: UsuariosComponent, canActivate: [authGuard, adminGuard] },
  { path: "empleados", component: EmpleadosComponent, canActivate: [authGuard, adminGuard] },
  { path: "solicitudes", component: SolicitudesComponent, canActivate: [authGuard] },
  { path: "certificados", component: CertificadosComponent, canActivate: [authGuard] },
  { path: "cambiar-contrasena", component: CambiarContrasenaComponent, canActivate: [authGuard] },
  { path: "**", redirectTo: "login" },
];
