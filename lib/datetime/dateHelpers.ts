export function hoyISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function normalizarHora(value: string) {
  return value.slice(0, 5);
}

export function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

export function dateToLocalISO(dateString: string | null | undefined) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function isSameLocalDay(dateString: string | null | undefined, targetIso: string) {
  return dateToLocalISO(dateString) === targetIso;
}
