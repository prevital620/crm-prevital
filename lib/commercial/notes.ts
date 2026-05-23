const RECEPTION_SUMMARY_MARKER = "__RECEPCION__::";
const COMMERCIAL_NOTES_MARKER = "__COMERCIAL__::";

function normalizeBlock(value: string | null | undefined) {
  return (value || "").trim();
}

export function parseStoredCommercialNotes(value: string | null | undefined) {
  const raw = normalizeBlock(value);

  if (!raw) {
    return {
      receptionSummary: "",
      commercialNotes: "",
    };
  }

  if (!raw.includes(RECEPTION_SUMMARY_MARKER)) {
    return {
      receptionSummary: raw,
      commercialNotes: "",
    };
  }

  const receptionPart = raw.match(
    /__RECEPCION__::([\s\S]*?)(?:\n\n__COMERCIAL__::|$)/
  )?.[1];
  const commercialPart = raw.match(/__COMERCIAL__::([\s\S]*)$/)?.[1];

  return {
    receptionSummary: normalizeBlock(receptionPart),
    commercialNotes: normalizeBlock(commercialPart),
  };
}

export function buildStoredCommercialNotes(
  receptionSummary: string | null | undefined,
  commercialNotes: string | null | undefined
) {
  const summary = normalizeBlock(receptionSummary);
  const notes = normalizeBlock(commercialNotes);

  if (!summary && !notes) return null;
  if (summary && !notes) return `${RECEPTION_SUMMARY_MARKER}${summary}`;
  if (!summary && notes) return `${COMMERCIAL_NOTES_MARKER}${notes}`;

  return `${RECEPTION_SUMMARY_MARKER}${summary}\n\n${COMMERCIAL_NOTES_MARKER}${notes}`;
}

export function updateReceptionInitialClassification(
  value: string | null | undefined,
  classification: "Q" | "No Q",
  reason?: string | null
) {
  const parsed = parseStoredCommercialNotes(value);
  const lines = (parsed.receptionSummary || "")
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
  const nextClassificationLine = `Clasificación inicial: ${classification}`;
  const classificationIndex = lines.findIndex((line) =>
    line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .startsWith("clasificacion inicial:")
  );

  if (classificationIndex >= 0) {
    lines[classificationIndex] = nextClassificationLine;
  } else {
    lines.unshift(nextClassificationLine);
  }

  if (reason !== undefined) {
    const nextReason = (reason || "").trim();
    const reasonIndex = lines.findIndex((line) =>
      line
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .startsWith("motivo clasificacion:")
    );

    if (nextReason) {
      const nextReasonLine = `Motivo clasificación: ${nextReason}`;
      if (reasonIndex >= 0) {
        lines[reasonIndex] = nextReasonLine;
      } else {
        lines.splice(classificationIndex >= 0 ? classificationIndex + 1 : 1, 0, nextReasonLine);
      }
    } else if (reasonIndex >= 0) {
      lines.splice(reasonIndex, 1);
    }
  }

  return buildStoredCommercialNotes(lines.join(" | "), parsed.commercialNotes);
}
