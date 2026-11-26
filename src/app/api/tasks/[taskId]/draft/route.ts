import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { saveDraft } from "@/lib/workspace";
import {
  draftPayloadSchema,
  MAX_REQUEST_BYTES,
  taskIdSchema,
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The request is too large." }, { status: 413 });
  }

  try {
    const { taskId: rawTaskId } = await context.params;
    const taskId = taskIdSchema.parse(rawTaskId);
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    }

    const body = draftPayloadSchema.parse(JSON.parse(rawBody));
    const draft = await saveDraft(taskId, body.content);

    if (!draft) {
      return NextResponse.json({ error: "The requested task was not found." }, { status: 404 });
    }

    return NextResponse.json({
      draft: {
        content: draft.content,
        updatedAt: draft.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "The request is invalid." },
        { status: 400 },
      );
    }

    console.error("Unable to save draft", error);
    return NextResponse.json(
      { error: "The draft could not be saved. Check the database connection and retry." },
      { status: 503 },
    );
  }
}
