export const leadSourceOptions = [
  { value: "opc", label: "OPC" },
  { value: "redes", label: "Redes" },
  { value: "base", label: "Base" },
  { value: "referido", label: "Referido" },
  { value: "evento", label: "Evento" },
  { value: "punto_fisico", label: "Punto físico" },
  { value: "otro", label: "Otro" },
] as const;

export function normalizeLeadSource(value: string | null | undefined) {
  if (!value) return null;
  if (value === "redes_sociales") return "redes";
  return value;
}

export function getLeadSourceLabel(
  value: string | null | undefined,
  emptyLabel = "Sin origen"
) {
  const normalized = normalizeLeadSource(value);

  if (!normalized) return emptyLabel;

  const map: Record<string, string> = {
    opc: "OPC",
    redes: "Redes",
    base: "Base",
    referido: "Referido",
    evento: "Evento",
    punto_fisico: "Punto físico",
    otro: "Otro",
  };

  return map[normalized] || normalized;
}
