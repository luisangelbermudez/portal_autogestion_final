import { inject } from "@angular/core";
import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { environment } from "../../environments/environment";

// Agrega el token a cada petición a la API y, si el servidor responde 401
// (sesión vencida o token inválido), cierra la sesión y lleva al login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const esApi = req.url.startsWith(environment.apiUrl);
  const esLogin = req.url === `${environment.apiUrl}/login`;
  const token = auth.obtenerToken();

  const peticion = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && esApi && !esLogin) {
        auth.logout();
        router.navigate(["/login"], { queryParams: { expirada: 1 } });
      }
      return throwError(() => error);
    })
  );
};
