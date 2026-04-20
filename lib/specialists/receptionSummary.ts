import { parseStoredCommercialNotes } from "@/lib/commercial/notes";
import { repairMojibake } from "@/lib/text/repairMojibake";

const OUTCOME_CODES = new Set(["ganada", "perdida", "pendiente"]);

export type SpecialistReceptionSummary = {
  document: string;
  age: string;
  eps: string;
  occupation: string;
  basicHistory: string;
};

function cleanText(value: string | null | undefined) {
  return repairMojibake(value || "").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function splitSummary(summary: string) {
  return summary
    .split("|")
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function extractByPrefixes(parts: string[], prefixes: string[]) {
  const normalizedPrefixes = prefixes.map((item) => normalizeLabel(item));

  for (const part of parts) {
    const [rawLabel, ...rest] = part.split(":");
    if (rest.length === 0) continue;
    const normalizedLabel = normalizeLabel(rawLabel);
    if (!normalizedPrefixes.includes(normalizedLabel)) continue;
    return cleanText(rest.join(":"));
  }

  return "";
}

function buildEpsValue(hasEps: string, affiliation: string) {
  if (hasEps && affiliation) return `${hasEps} · ${affiliation}`;
  if (affiliation) return affiliation;
  return hasEps;
}

export function getCommercialReceptionSummaryText(
  commercialNotes: string | null | undefined,
  saleResult: string | null | undefined
) {
  const notesSummary = cleanText(
    parseStoredCommercialNotes(commercialNotes).receptionSummary
  );

  if (notesSummary) return notesSummary;

  const cleanSaleResult = cleanText(saleResult);
  if (!cleanSaleResult) return "";
  if (OUTCOME_CODES.has(normalizeLabel(cleanSaleResult))) return "";
  return cleanSaleResult;
}

export function parseSpecialistReceptionSummary(
  commercialNotes: string | null | undefined,
  saleResult: string | null | undefined,
  fallback?: {
    document?: string | null;
    occupation?: string | null;
  }
): SpecialistReceptionSummary {
  const summaryText = getCommercialReceptionSummaryText(commercialNotes, saleResult);
  const parts = splitSummary(summaryText);

  const hasEps = extractByPrefixes(parts, ["Tiene EPS", "EPS"]);
  const affiliation = extractByPrefixes(parts, ["Afiliación", "Afiliacion"]);
  const age = extractByPrefixes(parts, ["Edad"]);
  const occupation =
    extractByPrefixes(parts, ["Ocupación", "Ocupacion"]) ||
    cleanText(fallback?.occupation);
  const document =
    extractByPrefixes(parts, ["Documento"]) || cleanText(fallback?.document);

  const historyParts = [
    extractByPrefixes(parts, ["Enfermedades"])
      ? `Enfermedades: ${extractByPrefixes(parts, ["Enfermedades"])}`
      : "",
    extractByPrefixes(parts, ["Enfermedades cuáles", "Enfermedades cuales"])
      ? `Detalle enfermedades: ${extractByPrefixes(parts, [
          "Enfermedades cuáles",
          "Enfermedades cuales",
        ])}`
      : "",
    extractByPrefixes(parts, ["Hipertenso"])
      ? `Hipertensión: ${extractByPrefixes(parts, ["Hipertenso"])}`
      : "",
    extractByPrefixes(parts, ["Diabético", "Diabetico"])
      ? `Diabetes: ${extractByPrefixes(parts, ["Diabético", "Diabetico"])}`
      : "",
    extractByPrefixes(parts, ["Cirugías", "Cirugias"])
      ? `Cirugías: ${extractByPrefixes(parts, ["Cirugías", "Cirugias"])}`
      : "",
    extractByPrefixes(parts, ["Cirugías cuáles", "Cirugias cuales"])
      ? `Detalle cirugías: ${extractByPrefixes(parts, [
          "Cirugías cuáles",
          "Cirugias cuales",
        ])}`
      : "",
    extractByPrefixes(parts, ["Medicamentos"])
      ? `Medicamentos: ${extractByPrefixes(parts, ["Medicamentos"])}`
      : "",
    extractByPrefixes(parts, ["Medicamentos cuáles", "Medicamentos cuales"])
      ? `Detalle medicamentos: ${extractByPrefixes(parts, [
          "Medicamentos cuáles",
          "Medicamentos cuales",
        ])}`
      : "",
  ].filter(Boolean);

  return {
    document,
    age,
    eps: buildEpsValue(hasEps, affiliation),
    occupation,
    basicHistory: historyParts.join(" | "),
  };
}

export function specialistPlanLabel(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  const map: Record<string, string> = {
    valoracion: "Valoración",
    detox: "Detox",
    sueroterapia: "Sueroterapia",
    nutricion: "Nutrición",
    medico: "Médico",
    fisioterapia: "Fisioterapia",
    tratamiento_integral: "Tratamiento integral",
    biompedancia: "Biompedancia",
  };

  if (!normalized) return "Sin plan definido";
  return map[normalized] || cleanText(value) || "Sin plan definido";
}
