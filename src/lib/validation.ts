import { z } from "zod";

import {
  REQUIREMENT_SECTION_IDS,
  STUDENT_SRS_SECTION_IDS,
  STUDENT_SRS_TEMPLATE,
} from "@/lib/srs-template";

export const MAX_SECTION_CHARACTERS = 20_000;
export const MAX_REQUEST_BYTES = 256_000;

export const taskIdSchema = z.uuid();

const requirementSchema = z.object({
  internalId: z.uuid(),
  sectionId: z.string(),
  code: z.string().trim().min(1, "Requirement code is required.").max(40),
  content: z.string().trim().min(1, "Requirement text is required.").max(5_000),
});

const sectionSchema = z.object({
  sectionId: z.string(),
  content: z.string().max(
    MAX_SECTION_CHARACTERS,
    `Section content cannot exceed ${MAX_SECTION_CHARACTERS.toLocaleString("en-US")} characters.`,
  ),
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export const documentPayloadSchema = z
  .object({
    templateId: z.literal(STUDENT_SRS_TEMPLATE.templateId),
    templateVersion: z.literal(STUDENT_SRS_TEMPLATE.version),
    sections: z.array(sectionSchema).length(STUDENT_SRS_TEMPLATE.sections.length),
    requirements: z.array(requirementSchema).max(200),
  })
  .superRefine((value, context) => {
    const seenSections = new Set<string>();
    for (const section of value.sections) {
      if (!STUDENT_SRS_SECTION_IDS.has(section.sectionId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown sectionId: ${section.sectionId}`,
          path: ["sections"],
        });
      }
      if (seenSections.has(section.sectionId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate sectionId: ${section.sectionId}`,
          path: ["sections"],
        });
      }
      seenSections.add(section.sectionId);
    }

    const seenCodes = new Set<string>();
    const seenInternalIds = new Set<string>();
    for (const requirement of value.requirements) {
      if (!REQUIREMENT_SECTION_IDS.has(requirement.sectionId)) {
        context.addIssue({
          code: "custom",
          message: `Requirements are not allowed in sectionId: ${requirement.sectionId}`,
          path: ["requirements"],
        });
      }
      const normalizedCode = requirement.code.toLocaleLowerCase("en-US");
      if (seenCodes.has(normalizedCode)) {
        context.addIssue({
          code: "custom",
          message: `Requirement code ${requirement.code} is used more than once.`,
          path: ["requirements"],
        });
      }
      if (seenInternalIds.has(requirement.internalId)) {
        context.addIssue({
          code: "custom",
          message: "A requirement internal ID is used more than once.",
          path: ["requirements"],
        });
      }
      seenCodes.add(normalizedCode);
      seenInternalIds.add(requirement.internalId);
    }
  });

export type DocumentPayload = z.infer<typeof documentPayloadSchema>;
