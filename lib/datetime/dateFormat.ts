export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "Sin fecha";
  try {
    return new Date(dateString).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(dateString);
  }
}

export function formatDateOnly(dateString: string | null | undefined) {
  if (!dateString) return "Sin fecha";
  try {
    return new Date(dateString).toLocaleDateString("es-CO", {
      dateStyle: "medium",
    });
  } catch {
    return String(dateString);
  }
}
