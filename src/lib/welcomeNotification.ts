import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { isMissingTableError } from "@/lib/dbErrors";
import { createNotifications } from "@/lib/notify";

export const WELCOME_DEFAULTS = {
  enabled: true,
  title: "Welcome to MacroVerse",
  message: "Your account is ready. Start by completing your profile and setting your goals.",
  href: "/onboarding",
};

const KEYS = {
  enabled: "welcome_notification_enabled",
  title: "welcome_notification_title",
  message: "welcome_notification_message",
  href: "welcome_notification_href",
} as const;

export async function getWelcomeNotificationSettings() {
  try {
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, Object.values(KEYS)));
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      enabled: values.get(KEYS.enabled) !== "false",
      title: values.get(KEYS.title) ?? WELCOME_DEFAULTS.title,
      message: values.get(KEYS.message) ?? WELCOME_DEFAULTS.message,
      href: values.get(KEYS.href) ?? WELCOME_DEFAULTS.href,
    };
  } catch (error) {
    if (isMissingTableError(error, "app_settings")) return WELCOME_DEFAULTS;
    throw error;
  }
}

export async function createWelcomeNotification(userId: string) {
  const settings = await getWelcomeNotificationSettings();
  if (!settings.enabled) return;
  await createNotifications({
    userId,
    actorId: null,
    kind: "welcome",
    message: `${settings.title}: ${settings.message}`,
    href: settings.href,
  });
}

export { KEYS as WELCOME_SETTING_KEYS };
