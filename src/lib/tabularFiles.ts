import { readSheet } from "read-excel-file/node";

export type ParsedTable = {
  filename: string;
  sheetName: string;
  rows: string[][];
};

const MAX_IMPORT_BYTES = 2_000_000;
const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const XLSX_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

function extensionFor(filename: string) {
  return filename.toLowerCase().split(".").pop() ?? "";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (inQuotes) throw new Error("CSV has an unclosed quoted field");
  return rows;
}

function normalizeRows(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));
}

export async function parseTabularFile(file: File): Promise<ParsedTable> {
  if (!file.size) throw new Error("Choose a CSV or Excel file to import");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File too large (2MB max)");

  const ext = extensionFor(file.name);
  if (!SUPPORTED_EXTENSIONS.has(ext) && !CSV_MIME_TYPES.has(file.type) && !XLSX_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Upload .csv or .xlsx");
  }

  if (ext === "csv" || CSV_MIME_TYPES.has(file.type)) {
    return {
      filename: file.name.slice(0, 120),
      sheetName: "CSV",
      rows: parseCsv(await file.text()),
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = normalizeRows(await readSheet(buffer));
  if (!rows.length) throw new Error("No rows found in the uploaded file");

  return {
    filename: file.name.slice(0, 120),
    sheetName: "Sheet 1",
    rows,
  };
}
