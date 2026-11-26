import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  srsDocuments,
  srsRequirements,
  srsSectionResponses,
  tasks,
} from "@/db/schema";
import { STUDENT_SRS_TEMPLATE } from "@/lib/srs-template";
import type { DocumentPayload } from "@/lib/validation";

type SectionStatus = "not_started" | "in_progress" | "completed";

function serializeSection(
  content: string,
  requirements: Array<{ internalId: string; code: string; content: string }>,
) {
  return JSON.stringify({ content, requirements });
}

export async function getWorkspace() {
  const taskRows = await db.select().from(tasks).orderBy(asc(tasks.title)).limit(1);
  const task = taskRows[0];

  if (!task) {
    return null;
  }

  const documentRows = await db
    .select()
    .from(srsDocuments)
    .where(eq(srsDocuments.taskId, task.id))
    .limit(1);
  const document = documentRows[0];

  if (!document) {
    return {
      task,
      template: STUDENT_SRS_TEMPLATE,
      document: null,
      progress: { completed: 0, total: STUDENT_SRS_TEMPLATE.sections.length, percentage: 0 },
    };
  }

  if (
    document.templateId !== STUDENT_SRS_TEMPLATE.templateId ||
    document.templateVersion !== STUDENT_SRS_TEMPLATE.version
  ) {
    throw new Error("The saved document references an unavailable template version.");
  }

  const [sectionRows, requirementRows] = await Promise.all([
    db
      .select()
      .from(srsSectionResponses)
      .where(eq(srsSectionResponses.documentId, document.id)),
    db
      .select()
      .from(srsRequirements)
      .where(eq(srsRequirements.documentId, document.id))
      .orderBy(asc(srsRequirements.position)),
  ]);
  const sectionMap = new Map(sectionRows.map((row) => [row.sectionId, row]));
  const sections = STUDENT_SRS_TEMPLATE.sections.map((definition) => {
    const row = sectionMap.get(definition.sectionId);
    return {
      sectionId: definition.sectionId,
      content: row?.content ?? "",
      status: (row?.status ?? "not_started") as SectionStatus,
    };
  });
  const completed = sections.filter((section) => section.status === "completed").length;

  return {
    task,
    template: STUDENT_SRS_TEMPLATE,
    document: {
      id: document.id,
      templateId: document.templateId,
      templateVersion: document.templateVersion,
      updatedAt: document.updatedAt,
      sections,
      requirements: requirementRows.map((requirement) => ({
        internalId: requirement.id,
        sectionId: requirement.sectionId,
        code: requirement.requirementCode,
        content: requirement.content,
      })),
    },
    progress: {
      completed,
      total: STUDENT_SRS_TEMPLATE.sections.length,
      percentage: Math.round((completed / STUDENT_SRS_TEMPLATE.sections.length) * 100),
    },
  };
}

export async function saveDocument(taskId: string, payload: DocumentPayload) {
  await db.transaction(async (tx) => {
    const taskRows = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!taskRows[0]) {
      throw new Error("TASK_NOT_FOUND");
    }

    let document = (
      await tx
        .select()
        .from(srsDocuments)
        .where(eq(srsDocuments.taskId, taskId))
        .limit(1)
    )[0];

    if (!document) {
      document = (
        await tx
          .insert(srsDocuments)
          .values({
            taskId,
            templateId: payload.templateId,
            templateVersion: payload.templateVersion,
          })
          .returning()
      )[0];
    }

    if (
      !document ||
      document.templateId !== payload.templateId ||
      document.templateVersion !== payload.templateVersion
    ) {
      throw new Error("TEMPLATE_VERSION_MISMATCH");
    }

    const [previousSections, previousRequirements] = await Promise.all([
      tx
        .select()
        .from(srsSectionResponses)
        .where(eq(srsSectionResponses.documentId, document.id)),
      tx
        .select()
        .from(srsRequirements)
        .where(eq(srsRequirements.documentId, document.id))
        .orderBy(asc(srsRequirements.position)),
    ]);
    const previousSectionMap = new Map(previousSections.map((row) => [row.sectionId, row]));

    for (const section of payload.sections) {
      const requirements = payload.requirements.filter(
        (requirement) => requirement.sectionId === section.sectionId,
      );
      const previous = previousSectionMap.get(section.sectionId);
      const previousRequirementData = previousRequirements
        .filter((requirement) => requirement.sectionId === section.sectionId)
        .map((requirement) => ({
          internalId: requirement.id,
          code: requirement.requirementCode,
          content: requirement.content,
        }));
      const changed =
        !previous ||
        serializeSection(previous.content, previousRequirementData) !==
          serializeSection(section.content, requirements);
      const hasContent = section.content.trim().length > 0 || requirements.length > 0;

      let status: SectionStatus = "in_progress";
      if (!hasContent) {
        status = "not_started";
      } else if (previous?.status === "completed" && changed) {
        status = "in_progress";
      } else if (section.status === "completed") {
        status = "completed";
      }

      const completedAt =
        status === "completed"
          ? previous?.status === "completed" && previous.completedAt
            ? previous.completedAt
            : new Date()
          : null;

      await tx
        .insert(srsSectionResponses)
        .values({
          documentId: document.id,
          sectionId: section.sectionId,
          content: section.content,
          status,
          completedAt,
        })
        .onConflictDoUpdate({
          target: [srsSectionResponses.documentId, srsSectionResponses.sectionId],
          set: { content: section.content, status, completedAt },
        });
    }

    await tx.delete(srsRequirements).where(eq(srsRequirements.documentId, document.id));
    if (payload.requirements.length > 0) {
      await tx.insert(srsRequirements).values(
        payload.requirements.map((requirement, position) => ({
          id: requirement.internalId,
          documentId: document.id,
          sectionId: requirement.sectionId,
          requirementCode: requirement.code,
          content: requirement.content,
          position,
        })),
      );
    }

    await tx
      .update(srsDocuments)
      .set({ updatedAt: new Date() })
      .where(eq(srsDocuments.id, document.id));
  });

  return getWorkspace();
}
