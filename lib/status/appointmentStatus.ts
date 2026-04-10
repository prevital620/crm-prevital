export function traducirEstadoCita(status: string) {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    en_espera: "En espera",
    asistio: "Asistió",
    no_asistio: "No asistió",
    reagendada: "Reagendada",
    cancelada: "Cancelada",
    en_atencion: "En atención",
    finalizada: "Finalizada",
  };
  return map[status] || status;
}

export function appointmentStatusClass(status: string) {
  switch (status) {
    case "agendada":
      return "bg-slate-100 text-slate-700";
    case "confirmada":
      return "bg-blue-100 text-blue-700";
    case "en_espera":
      return "bg-amber-100 text-amber-700";
    case "asistio":
      return "bg-emerald-100 text-emerald-700";
    case "no_asistio":
      return "bg-rose-100 text-rose-700";
    case "reagendada":
      return "bg-violet-100 text-violet-700";
    case "cancelada":
      return "bg-red-100 text-red-700";
    case "en_atencion":
      return "bg-cyan-100 text-cyan-700";
    case "finalizada":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
