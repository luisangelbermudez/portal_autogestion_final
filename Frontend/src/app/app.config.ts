import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import localeEsCo from "@angular/common/locales/es-CO";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";

import { routes } from "./app.routes";
import { authInterceptor } from "./interceptors/auth.interceptor";

// Fechas y números en español de Colombia (por ejemplo, "p. m." en lugar de "PM").
registerLocaleData(localeEsCo, "es-CO");

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: "es-CO" },
  ],
};
