export function translateTechnicalErrorMessage(
  message: string | null | undefined,
  fallback = "Ocurrio un error inesperado. Intentalo nuevamente."
) {
  const rawMessage = String(message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (!normalized) return fallback;

  if (normalized.includes("commercial_cases_commission_source_type_check")) {
    return "La fuente para comision no es valida. Revisa si el cliente viene de OPC, TMK, Base, Redes u Otro e intenta guardarlo nuevamente.";
  }

  if (normalized.includes("commercial_cases_lead_source_type_check")) {
    return "El origen del cliente no es valido. Selecciona una fuente permitida e intenta guardar nuevamente.";
  }

  if (normalized.includes("violates check constraint")) {
    return "Hay un dato con una opcion no permitida. Revisa los campos seleccionados e intenta guardar nuevamente.";
  }

  if (normalized.includes("duplicate key value violates unique constraint")) {
    return "Ese registro ya existe. Revisa si ya fue creado antes de guardarlo nuevamente.";
  }

  if (normalized.includes("violates foreign key constraint")) {
    return "No se encontro uno de los registros relacionados. Actualiza la pagina y vuelve a seleccionar la opcion.";
  }

  if (
    normalized.includes("could not find the") &&
    normalized.includes("schema cache")
  ) {
    return "La base de datos todavia no reconoce un campo nuevo. Actualiza la pagina y, si sigue pasando, hay que subir la migracion pendiente.";
  }

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "No tienes permiso para realizar esta accion con tu usuario actual.";
  }

  if (normalized.includes("jwt expired") || normalized.includes("invalid jwt")) {
    return "Tu sesion vencio. Cierra sesion e ingresa nuevamente.";
  }

  if (normalized.includes("invalid input syntax")) {
    return "Hay un dato con formato invalido. Revisa la informacion digitada e intenta nuevamente.";
  }

  if (normalized.startsWith("new row for relation")) {
    return "La base de datos no acepto uno de los datos enviados. Revisa los campos seleccionados e intenta guardar nuevamente.";
  }

  return rawMessage || fallback;
}

export function toSpanishErrorMessage(error: unknown, fallback?: string) {
  if (error instanceof Error) {
    return translateTechnicalErrorMessage(error.message, fallback);
  }

  if (typeof error === "string") {
    return translateTechnicalErrorMessage(error, fallback);
  }

  return fallback || "Ocurrio un error inesperado. Intentalo nuevamente.";
}
