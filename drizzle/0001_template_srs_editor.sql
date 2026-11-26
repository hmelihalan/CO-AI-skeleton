CREATE TABLE "srs_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"template_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_section_responses" (
	"document_id" uuid NOT NULL,
	"section_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "srs_section_responses_document_id_section_id_pk" PRIMARY KEY("document_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "srs_requirements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"section_id" text NOT NULL,
	"requirement_code" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "srs_documents" ADD CONSTRAINT "srs_documents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "srs_section_responses" ADD CONSTRAINT "srs_section_responses_document_id_srs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."srs_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "srs_requirements" ADD CONSTRAINT "srs_requirements_document_id_srs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."srs_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "srs_documents_task_id_unique" ON "srs_documents" USING btree ("task_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "srs_requirements_document_code_unique" ON "srs_requirements" USING btree ("document_id", lower("requirement_code"));
