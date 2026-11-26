import { sql } from "drizzle-orm";
import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  scenario: text("scenario").notNull(),
});

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("drafts_task_id_unique").on(table.taskId)],
);

export const srsDocuments = pgTable(
  "srs_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    templateVersion: text("template_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("srs_documents_task_id_unique").on(table.taskId)],
);

export const srsSectionResponses = pgTable(
  "srs_section_responses",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => srsDocuments.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    content: text("content").notNull().default(""),
    status: text("status").notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.sectionId] })],
);

export const srsRequirements = pgTable(
  "srs_requirements",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => srsDocuments.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    requirementCode: text("requirement_code").notNull(),
    content: text("content").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("srs_requirements_document_code_unique").on(
      table.documentId,
      sql`lower(${table.requirementCode})`,
    ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type SrsDocument = typeof srsDocuments.$inferSelect;
