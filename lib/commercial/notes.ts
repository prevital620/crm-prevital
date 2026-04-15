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
