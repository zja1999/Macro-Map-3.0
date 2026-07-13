export type DesktopPairingStatus = "pending" | "approved" | "expired" | "consumed" | "invalid";

export function desktopPairingStatus(
  row: { approvedAt: Date | null; consumedAt: Date | null; expiresAt: Date } | undefined,
  now = new Date(),
): DesktopPairingStatus {
  if (!row) return "invalid";
  if (row.consumedAt) return "consumed";
  if (row.expiresAt <= now) return "expired";
  return row.approvedAt ? "approved" : "pending";
}
