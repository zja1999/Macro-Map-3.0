export function isMissingTableError(error: unknown, tableName: string): boolean {
  const err = error as { code?: string; message?: string; cause?: unknown };
  const message = String(err.message ?? "");
  if (err.code === "42P01") return true;
  if (message.toLowerCase().includes(`relation "${tableName}" does not exist`)) return true;
  if (message.toLowerCase().includes(`table "${tableName}" does not exist`)) return true;
  return err.cause ? isMissingTableError(err.cause, tableName) : false;
}
