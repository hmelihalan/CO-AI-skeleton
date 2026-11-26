import { NextResponse } from "next/server";

import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await getWorkspace();

    if (!workspace) {
      return NextResponse.json(
        { error: "No task is available. Run the database seed and try again." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      task: workspace.task,
      draft: workspace.draft
        ? {
            content: workspace.draft.content,
            updatedAt: workspace.draft.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Unable to load workspace", error);
    return NextResponse.json(
      { error: "The workspace could not be loaded. Check the database connection and retry." },
      { status: 503 },
    );
  }
}
