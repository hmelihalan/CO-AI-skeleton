import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { saveDocument } from "@/lib/workspace";
import {
  documentPayloadSchema,
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

    const payload = documentPayloadSchema.parse(JSON.parse(rawBody));
    const workspace = await saveDocument(taskId, payload);

    return NextResponse.json({
      document: workspace?.document
        ? {
            ...workspace.document,
            updatedAt: workspace.document.updatedAt.toISOString(),
          }
        : null,
      progress: workspace?.progress,
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

    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "The requested task was not found." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "TEMPLATE_VERSION_MISMATCH") {
      return NextResponse.json(
        { error: "This document is tied to a different template version." },
        { status: 409 },
      );
    }

    console.error("Unable to save SRS document", error);
    return NextResponse.json(
      { error: "The document could not be saved. Your unsaved changes are still in the editor." },
      { status: 503 },
    );
  }
}
