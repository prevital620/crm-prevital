export function traducirEstadoComercial(status: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente de asignación",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atención",
    seguimiento: "Seguimiento",
    seguimiento_comercial: "Seguimiento",
    finalizado: "Finalizado",
  };
  return map[status || ""] || status || "Sin estado";
}

export function commercialStatusClass(status: string | null | undefined) {
  switch (status) {
    case "pendiente_asignacion_comercial":
      return "bg-amber-100 text-amber-700";
    case "asignado_comercial":
      return "bg-blue-100 text-blue-700";
    case "en_atencion_comercial":
      return "bg-cyan-100 text-cyan-700";
    case "seguimiento":
    case "seguimiento_comercial":
      return "bg-violet-100 text-violet-700";
    case "finalizado":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
