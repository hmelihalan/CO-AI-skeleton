import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.beforeEach(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || new URL(databaseUrl).pathname !== "/coai_test") {
    throw new Error("The e2e test requires a dedicated coai_test database.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("DROP TRIGGER IF EXISTS e2e_fail_srs_save ON srs_documents");
  await client.query("DROP FUNCTION IF EXISTS e2e_fail_srs_save()");
  await client.query("DELETE FROM srs_documents");
  await client.end();
});

test("tracks real section progress and restores the saved document", async ({ page }) => {
  const introduction = `Persistence verification ${Date.now()}: scope and exclusions.`;

  await page.goto("/");
  await expect(page.getByTestId("progress-percentage")).toHaveText("0%");
  await expect(page.getByTestId("progress-count")).toHaveText("0 / 5 sections completed");
  await expect(page.getByTestId("section-status")).toHaveText("Not started");
  await expect(page.getByTestId("mark-complete")).toBeDisabled();
  await page.screenshot({ path: "docs/evidence/01-empty-template.png", fullPage: true });

  await page.getByTestId("section-editor").fill(introduction);
  await expect(page.getByTestId("section-status")).toHaveText("In progress");
  await expect(page.getByTestId("save-status")).toHaveText("Unsaved changes");

  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByRole("heading", { name: "2. Overall Description" })).toBeVisible();
  await page.getByTestId("section-nav-introduction").click();
  await expect(page.getByTestId("section-editor")).toHaveValue(introduction);

  await page.getByTestId("mark-complete").click();
  await expect(page.getByTestId("section-status")).toHaveText("Completed");
  await expect(page.getByTestId("progress-percentage")).toHaveText("20%");
  await expect(page.getByTestId("progress-count")).toHaveText("1 / 5 sections completed");

  await page.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved to database");
  await page.screenshot({ path: "docs/evidence/02-section-completed.png", fullPage: true });

  await page.reload();
  await expect(page.getByTestId("section-editor")).toHaveValue(introduction);
  await expect(page.getByTestId("section-status")).toHaveText("Completed");
  await expect(page.getByTestId("progress-percentage")).toHaveText("20%");
  await page.screenshot({ path: "docs/evidence/03-saved-document-restored.png", fullPage: true });

  await page.getByTestId("section-editor").fill(`${introduction} Updated.`);
  await expect(page.getByTestId("section-status")).toHaveText("In progress");
  await expect(page.getByTestId("progress-percentage")).toHaveText("0%");
});

test("adds, edits, deletes, and validates requirements by code", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("section-nav-functional-requirements").click();
  await page.getByTestId("add-requirement").click();
  await page.getByTestId("add-requirement").click();

  const rows = page.getByTestId("requirement-row");
  await rows.nth(0).getByLabel("Requirement text").fill("The system shall allow students to search available rooms.");
  await rows.nth(1).getByLabel("Requirement text").fill("The system shall reject overlapping confirmed bookings.");
  await rows.nth(1).getByLabel("Requirement code").fill("FR-01");

  await expect(page.getByText("Code already used.")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Save document" })).toBeDisabled();
  await expect(page.getByTestId("mark-complete")).toBeDisabled();

  await rows.nth(1).getByLabel("Requirement code").fill("FR-02");
  await expect(page.getByText("Code already used.")).toHaveCount(0);
  await page.getByTestId("mark-complete").click();
  await expect(page.getByTestId("progress-percentage")).toHaveText("20%");

  await rows.nth(1).getByRole("button", { name: "Delete FR-02" }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("section-status")).toHaveText("In progress");
});

test("keeps unsaved content visible when saving fails", async ({ page }) => {
  const databaseUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(`
    CREATE FUNCTION e2e_fail_srs_save() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'intentional e2e database failure';
    END;
    $$
  `);
  await client.query(`
    CREATE TRIGGER e2e_fail_srs_save
    BEFORE INSERT OR UPDATE ON srs_documents
    FOR EACH ROW EXECUTE FUNCTION e2e_fail_srs_save()
  `);

  await page.goto("/");
  const unsaved = `Unsaved after failure ${Date.now()}`;
  await page.getByTestId("section-editor").fill(unsaved);

  try {
    await page.getByRole("button", { name: "Save document" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Save failed");
    await expect(
      page.getByText("The document could not be saved. Your unsaved changes are still in the editor."),
    ).toBeVisible();
    await expect(page.getByTestId("section-editor")).toHaveValue(unsaved);
    await page.screenshot({ path: "docs/evidence/04-save-error-preserves-content.png", fullPage: true });
  } finally {
    await client.query("DROP TRIGGER IF EXISTS e2e_fail_srs_save ON srs_documents");
    await client.query("DROP FUNCTION IF EXISTS e2e_fail_srs_save()");
    await client.end();
  }
});

test("server rejects duplicate codes and unknown section IDs", async ({ request }) => {
  const workspaceResponse = await request.get("/api/workspace");
  expect(workspaceResponse.ok()).toBeTruthy();
  const workspace = (await workspaceResponse.json()) as {
    task: { id: string };
    template: {
      templateId: string;
      version: string;
      sections: Array<{ sectionId: string }>;
    };
  };
  const sections = workspace.template.sections.map((section) => ({
    sectionId: section.sectionId,
    content: "",
    status: "not_started",
  }));

  const duplicateResponse = await request.put(
    `/api/tasks/${workspace.task.id}/document`,
    {
      data: {
        templateId: workspace.template.templateId,
        templateVersion: workspace.template.version,
        sections,
        requirements: [
          {
            internalId: crypto.randomUUID(),
            sectionId: "functional-requirements",
            code: "FR-01",
            content: "First requirement",
          },
          {
            internalId: crypto.randomUUID(),
            sectionId: "external-interfaces",
            code: "fr-01",
            content: "Second requirement",
          },
        ],
      },
    },
  );
  expect(duplicateResponse.status()).toBe(400);
  await expect(duplicateResponse.json()).resolves.toMatchObject({
    error: "Requirement code fr-01 is used more than once.",
  });

  sections[0] = { ...sections[0]!, sectionId: "invented-section" };
  const unknownSectionResponse = await request.put(
    `/api/tasks/${workspace.task.id}/document`,
    {
      data: {
        templateId: workspace.template.templateId,
        templateVersion: workspace.template.version,
        sections,
        requirements: [],
      },
    },
  );
  expect(unknownSectionResponse.status()).toBe(400);
  await expect(unknownSectionResponse.json()).resolves.toMatchObject({
    error: "Unknown sectionId: invented-section",
  });
});

test("server reopens changed completed content even when the client claims completed", async ({ request }) => {
  const workspace = (await (await request.get("/api/workspace")).json()) as {
    task: { id: string };
    template: {
      templateId: string;
      version: string;
      sections: Array<{ sectionId: string }>;
    };
  };
  const makeSections = (introduction: string) =>
    workspace.template.sections.map((section) => ({
      sectionId: section.sectionId,
      content: section.sectionId === "introduction" ? introduction : "",
      status: section.sectionId === "introduction" ? "completed" : "not_started",
    }));
  const endpoint = `/api/tasks/${workspace.task.id}/document`;
  const common = {
    templateId: workspace.template.templateId,
    templateVersion: workspace.template.version,
    requirements: [],
  };

  const firstSave = await request.put(endpoint, {
    data: { ...common, sections: makeSections("Original completed content") },
  });
  expect(firstSave.ok()).toBeTruthy();
  await expect(firstSave.json()).resolves.toMatchObject({
    document: {
      sections: expect.arrayContaining([
        expect.objectContaining({ sectionId: "introduction", status: "completed" }),
      ]),
    },
    progress: { completed: 1, total: 5, percentage: 20 },
  });

  const changedSave = await request.put(endpoint, {
    data: { ...common, sections: makeSections("Changed but falsely claimed complete") },
  });
  expect(changedSave.ok()).toBeTruthy();
  await expect(changedSave.json()).resolves.toMatchObject({
    document: {
      sections: expect.arrayContaining([
        expect.objectContaining({ sectionId: "introduction", status: "in_progress" }),
      ]),
    },
    progress: { completed: 0, total: 5, percentage: 0 },
  });
});
