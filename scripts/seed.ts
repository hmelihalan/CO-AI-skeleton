import { sql } from "drizzle-orm";

import { db, pool } from "../src/db";
import { tasks } from "../src/db/schema";

const SYNTHETIC_TASK_ID = "8e0a2db8-e967-4dc5-b5bd-9fd87403408e";

async function main() {
  try {
    await db
      .insert(tasks)
      .values({
        id: SYNTHETIC_TASK_ID,
        title: "Campus Room Booking System",
        scenario:
          "Specify a shared booking system where students can find and request university rooms, while facilities staff manage availability and approve requests.",
      })
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: sql`excluded.title`,
          scenario: sql`excluded.scenario`,
        },
      });

    console.log(`Synthetic task ${SYNTHETIC_TASK_ID} is ready.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
