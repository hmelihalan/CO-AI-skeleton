import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { drafts, tasks } from "@/db/schema";

export async function getWorkspace() {
  const taskRows = await db.select().from(tasks).orderBy(asc(tasks.title)).limit(1);
  const task = taskRows[0];

  if (!task) {
    return null;
  }

  const draftRows = await db
    .select()
    .from(drafts)
    .where(eq(drafts.taskId, task.id))
    .limit(1);

  return {
    task,
    draft: draftRows[0] ?? null,
  };
}

export async function saveDraft(taskId: string, content: string) {
  const taskRows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);

  if (!taskRows[0]) {
    return null;
  }

  const rows = await db
    .insert(drafts)
    .values({ taskId, content })
    .onConflictDoUpdate({
      target: drafts.taskId,
      set: { content, updatedAt: new Date() },
    })
    .returning();

  return rows[0];
}
