import * as XLSX from "xlsx";

export type ImportParsedRow = {
  rowNumber: number;
  nombre: string;
  telefono: string;
  ciudad: string;
  observaciones: string;
};

export type ImportDetectedColumns = {
  headers: string[];
  nameHeader: string | null;
  phoneHeader: string | null;
  cityHeader: string | null;
  notesHeader: string | null;
};

export type ImportParseResult = {
  format: "csv" | "xlsx";
  rows: ImportParsedRow[];
  columns: ImportDetectedColumns;
};

const NAME_ALIASES = [
  "nombre",
  "nombres",
  "nombre_completo",
  "nombre_y_apellido",
  "full_name",
  "fullname",
  "lead_name",
  "cliente",
  "contact_name",
];

const PHONE_ALIASES = [
  "telefono",
  "telefonos",
  "telefono_celular",
  "telefono_movil",
  "celular",
  "movil",
  "whatsapp",
  "phone",
  "phone_number",
  "telefono_whatsapp",
  "numero_de_telefono",
  "numero_telefono",
  "numero_de_celular",
  "numero_celular",
];

const CITY_ALIASES = ["ciudad", "city", "municipio"];
const NOTES_ALIASES = ["observaciones", "observacion", "obs", "notas", "notes", "comentarios"];

export async function parseLeadImportFile(file: File): Promise<ImportParseResult> {
  const extension = getFileExtension(file.name);

  if (extension === "xlsx") {
    return parseXlsxFile(file);
  }

  return parseCsvFile(file);
}

function getFileExtension(fileName: string) {
  const normalized = String(fileName || "").trim().toLowerCase();
  const parts = normalized.split(".");
  return parts.length > 1 ? parts.at(-1) || "" : "";
}

async function parseCsvFile(file: File): Promise<ImportParseResult> {
  const rawText = await file.text();
  const matrix = parseDelimitedMatrix(rawText);
  const { headers, rows } = normalizeMatrix(matrix);

  return {
    format: "csv",
    columns: detectColumns(headers),
    rows: mapRows(headers, rows),
  };
}

async function parseXlsxFile(file: File): Promise<ImportParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      format: "xlsx",
      columns: detectColumns([]),
      rows: [],
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const normalizedMatrix = matrix.map((row) =>
    row.map((cell) => String(cell ?? "").trim())
  );
  const { headers, rows } = normalizeMatrix(normalizedMatrix);

  return {
    format: "xlsx",
    columns: detectColumns(headers),
    rows: mapRows(headers, rows),
  };
}

function parseDelimitedMatrix(content: string) {
  const cleaned = content.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [] as string[][];

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/\u0000/g, ""))
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return [] as string[][];

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => splitCsvLine(line, delimiter));
}

function normalizeMatrix(matrix: string[][]) {
  const firstNonEmptyIndex = matrix.findIndex((row) => row.some((cell) => String(cell || "").trim() !== ""));

  if (firstNonEmptyIndex < 0) {
    return {
      headers: [] as string[],
      rows: [] as string[][],
    };
  }

  const headers = matrix[firstNonEmptyIndex].map((cell) => String(cell || "").trim());
  const rows = matrix
    .slice(firstNonEmptyIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""));

  return { headers, rows };
}

function detectColumns(headers: string[]): ImportDetectedColumns {
  const normalizedHeaders = headers.map(normalizeHeader);

  const nameIndex = findFirstMatchingIndex(normalizedHeaders, NAME_ALIASES);
  const phoneIndex = findFirstMatchingIndex(normalizedHeaders, PHONE_ALIASES);
  const cityIndex = findFirstMatchingIndex(normalizedHeaders, CITY_ALIASES);
  const notesIndex = findFirstMatchingIndex(normalizedHeaders, NOTES_ALIASES);

  return {
    headers,
    nameHeader: nameIndex >= 0 ? headers[nameIndex] || null : null,
    phoneHeader: phoneIndex >= 0 ? headers[phoneIndex] || null : null,
    cityHeader: cityIndex >= 0 ? headers[cityIndex] || null : null,
    notesHeader: notesIndex >= 0 ? headers[notesIndex] || null : null,
  };
}

function mapRows(headers: string[], rows: string[][]): ImportParsedRow[] {
  const normalizedHeaders = headers.map(normalizeHeader);
  const nameIndex = findFirstMatchingIndex(normalizedHeaders, NAME_ALIASES);
  const phoneIndex = findFirstMatchingIndex(normalizedHeaders, PHONE_ALIASES);
  const cityIndex = findFirstMatchingIndex(normalizedHeaders, CITY_ALIASES);
  const notesIndex = findFirstMatchingIndex(normalizedHeaders, NOTES_ALIASES);

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    nombre: nameIndex >= 0 ? String(row[nameIndex] || "").trim() : "",
    telefono: phoneIndex >= 0 ? String(row[phoneIndex] || "").trim() : "",
    ciudad: cityIndex >= 0 ? String(row[cityIndex] || "").trim() : "",
    observaciones: notesIndex >= 0 ? String(row[notesIndex] || "").trim() : "",
  }));
}

function detectDelimiter(headerLine: string) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((item) => item.trim());
}

function normalizeHeader(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, "_")
    .trim();
}

function findFirstMatchingIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}
