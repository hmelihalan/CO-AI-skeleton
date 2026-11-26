import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.beforeEach(async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || new URL(databaseUrl).pathname !== "/coai_test") {
    throw new Error("The e2e test requires a dedicated coai_test database.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("DELETE FROM drafts");
  await client.end();
});

test("loads a task, saves a unique SRS draft, and restores it after reload", async ({ page }) => {
  const uniqueDraft = [
    "1. Introduction",
    `Persistence verification ${Date.now()}`,
    "",
    "2. Functional Requirements",
    "FR-01: The system shall allow a student to request an available university room.",
  ].join("\n");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Campus Room Booking System", exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("No saved draft");
  await page.screenshot({ path: "docs/evidence/01-task-loaded.png", fullPage: true });

  const editor = page.getByTestId("draft-editor");
  await editor.fill(uniqueDraft);
  await expect(page.getByTestId("save-status")).toContainText("Unsaved changes");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved to database");
  await page.screenshot({ path: "docs/evidence/02-draft-saved.png", fullPage: true });

  await page.reload();
  await expect(page.getByTestId("draft-editor")).toHaveValue(uniqueDraft);
  await expect(page.getByTestId("save-status")).toContainText("Saved to database");
  await page.screenshot({ path: "docs/evidence/03-draft-restored.png", fullPage: true });
});

test("rejects invalid and oversized draft requests", async ({ request }) => {
  const workspaceResponse = await request.get("/api/workspace");
  expect(workspaceResponse.ok()).toBeTruthy();
  const workspace = (await workspaceResponse.json()) as { task: { id: string } };

  const emptyResponse = await request.put(`/api/tasks/${workspace.task.id}/draft`, {
    data: { content: "   " },
  });
  expect(emptyResponse.status()).toBe(400);
  await expect(emptyResponse.json()).resolves.toMatchObject({ error: "Draft content cannot be empty." });

  const oversizedResponse = await request.put(`/api/tasks/${workspace.task.id}/draft`, {
    data: { content: "x".repeat(20_001) },
  });
  expect(oversizedResponse.status()).toBe(400);

  const invalidTaskResponse = await request.put("/api/tasks/not-a-uuid/draft", {
    data: { content: "Valid content" },
  });
  expect(invalidTaskResponse.status()).toBe(400);
});
