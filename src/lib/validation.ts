import { z } from "zod";

export const MAX_DRAFT_CHARACTERS = 20_000;
export const MAX_REQUEST_BYTES = 32_000;

export const taskIdSchema = z.uuid();

export const draftPayloadSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Draft content cannot be empty.")
    .max(
      MAX_DRAFT_CHARACTERS,
      `Draft content cannot exceed ${MAX_DRAFT_CHARACTERS.toLocaleString("en-US")} characters.`,
    ),
});
