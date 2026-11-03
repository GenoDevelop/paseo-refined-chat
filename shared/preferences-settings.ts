import { defineSettings, settingsRpc } from "@getpaseo/plugin";
import { z } from "zod";

/**
 * Where a device with no browser storage keeps its preferences. An Android
 * client has no `localStorage`, so the daemon holds them instead. Each device
 * gets a profile of its own, keyed by the platform and model, because a phone
 * wants other settings than a computer. A profile is the same JSON the
 * browser stores, kept as a string so the client reads it the same way.
 */
export const PREFERENCES_SETTINGS_ID = "device-preferences";

export const preferencesSettings = defineSettings({
  id: PREFERENCES_SETTINGS_ID,
  scope: "host",
  version: 1,
  // Nothing is stored until a device saves, and an empty store must still read
  // as valid, or the first save never happens.
  schema: z.object({ profiles: z.record(z.string(), z.string()).default({}) }),
});

export const preferencesRpc = settingsRpc(PREFERENCES_SETTINGS_ID);
