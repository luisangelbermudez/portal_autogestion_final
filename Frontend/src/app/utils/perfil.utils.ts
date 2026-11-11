const dos = (n: number) => n.toString().padStart(2, "0");

export function iniciales(nombre?: string): string {
  const partes = (nombre || "").trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase();
}

/** Convierte "AAAA-MM-DD..." en fecha local evitando corrimientos por zona horaria. */
function fechaLocal(texto?: string | null): Date | null {
  if (!texto) return null;
  const [a, m, d] = texto.substring(0, 10).split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

export function fechaCorta(texto?: string | null): string {
  const f = fechaLocal(texto);
  return f ? `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}` : "";
}

/** Tiempo en la compañía: "6 años y 4 meses". */
export function antiguedad(fechaIngreso?: string | null): string {
  const ingreso = fechaLocal(fechaIngreso);
  if (!ingreso) return "No disponible";
  const hoy = new Date();
  let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
  if (hoy.getDate() < ingreso.getDate()) meses--;
  if (meses < 1) return "Menos de 1 mes";
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const tAnios = anios === 1 ? "1 año" : `${anios} años`;
  const tMeses = resto === 1 ? "1 mes" : `${resto} meses`;
  if (anios === 0) return tMeses;
  return resto === 0 ? tAnios : `${tAnios} y ${tMeses}`;
}

/** Último ingreso al portal: "10/11/2026 01:03 a. m." (null = primer ingreso; undefined = sin dato). */
export function formatearUltimoAcceso(valor?: string | null): string {
  if (valor === undefined) return "No disponible";
  if (valor === null) return "Primer ingreso al portal";
  const f = new Date(valor);
  if (isNaN(f.getTime())) return "No disponible";
  const h = f.getHours();
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(h % 12 || 12)}:${dos(f.getMinutes())} ${h < 12 ? "a. m." : "p. m."}`;
}
