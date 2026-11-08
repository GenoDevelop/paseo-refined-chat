import { defineSettings, settingsRpc } from "@getpaseo/plugin";
import { z } from "zod";

// Only question definitions are archived; answers remain in the host timeline.
export const archivedQuestionsSchema = z.array(z.object({
  question: z.string(),
  header: z.string().optional(),
  multiple: z.boolean(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    recommended: z.boolean().optional(),
  })),
  answers: z.array(z.string()).max(0).default([]),
}));

export const questionArchiveSchema = z.object({
  calls: z.record(z.string(), archivedQuestionsSchema).default({}),
});
export const questionSettings = defineSettings({
  id: "question-archive", scope: "host", version: 1, schema: questionArchiveSchema,
});
export const questionSettingsRpc = settingsRpc(questionSettings.id);
