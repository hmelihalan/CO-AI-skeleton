"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WorkspacePayload = {
  task: {
    id: string;
    title: string;
    scenario: string;
  };
  draft: {
    content: string;
    updatedAt: string;
  } | null;
};

type SaveState = "loading" | "ready" | "unsaved" | "saving" | "saved" | "error";
type NavigationView = "task" | "outline";

const sections = [
  "Introduction",
  "Overall Description",
  "Functional Requirements",
  "External Interfaces",
  "Nonfunctional Requirements",
];

const statusLabels: Record<SaveState, string> = {
  loading: "Loading draft…",
  ready: "No saved draft",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved to database",
  error: "Save failed",
};

async function requestWorkspace(signal?: AbortSignal) {
  const response = await fetch("/api/workspace", { cache: "no-store", signal });
  const data = (await response.json()) as WorkspacePayload | { error?: string };

  if (!response.ok || !("task" in data)) {
    throw new Error("error" in data && data.error ? data.error : "Unable to load the workspace.");
  }

  return data;
}

export function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [navigationView, setNavigationView] = useState<NavigationView>("outline");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setSaveState("loading");
    setErrorMessage(null);

    try {
      const data = await requestWorkspace();
      setWorkspace(data);
      setContent(data.draft?.content ?? "");
      setLastSavedAt(data.draft?.updatedAt ?? null);
      setSaveState(data.draft ? "saved" : "ready");
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the workspace.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    requestWorkspace(controller.signal)
      .then((data) => {
        setWorkspace(data);
        setContent(data.draft?.content ?? "");
        setLastSavedAt(data.draft?.updatedAt ?? null);
        setSaveState(data.draft ? "saved" : "ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setSaveState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the workspace.");
      });

    return () => controller.abort();
  }, []);

  const saveDraft = async () => {
    if (!workspace || saveState === "saving") {
      return;
    }

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/tasks/${workspace.task.id}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as {
        draft?: { content: string; updatedAt: string };
        error?: string;
      };

      if (!response.ok || !data.draft) {
        throw new Error(data.error ?? "The draft could not be saved.");
      }

      setContent(data.draft.content);
      setLastSavedAt(data.draft.updatedAt);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "The draft could not be saved.");
    }
  };

  const savedTime = useMemo(() => {
    if (!lastSavedAt) {
      return null;
    }

    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(lastSavedAt));
  }, [lastSavedAt]);

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-6">
        <section className="w-full max-w-md rounded-lg border border-[#e1e6ed] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#172f51]">
            {saveState === "loading" ? "Loading CO-AI workspace…" : "Workspace unavailable"}
          </p>
          {errorMessage ? <p className="mt-3 text-sm leading-6 text-[#b42318]">{errorMessage}</p> : null}
          {saveState === "error" ? (
            <button
              className="mt-5 rounded-md bg-[#172f51] px-5 py-2.5 text-sm font-medium text-white"
              onClick={() => void loadWorkspace()}
              type="button"
            >
              Retry
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#1d2939]">
      <header className="flex min-h-20 items-center gap-6 border-b border-[#e1e6ed] bg-white px-5 py-4 lg:px-7">
        <div className="text-2xl font-bold tracking-[-0.02em] text-[#172f51]">CO-AI</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{workspace.task.title}</h1>
          <p className="mt-0.5 text-xs text-[#667085]">SRS authoring session / Running skeleton</p>
        </div>
        <div className="hidden text-right sm:block" aria-live="polite">
          <p
            className={`text-xs font-medium ${saveState === "error" ? "text-[#b42318]" : "text-[#667085]"}`}
            data-testid="save-status"
          >
            {statusLabels[saveState]}
          </p>
          {saveState === "saved" && savedTime ? (
            <p className="mt-1 text-[11px] text-[#98a2b3]">Last saved at {savedTime}</p>
          ) : null}
        </div>
        <button
          className="min-w-32 rounded-md bg-[#172f51] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#203f6b] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saveState === "loading" || saveState === "saving"}
          onClick={() => void saveDraft()}
          type="button"
        >
          {saveState === "saving" ? "Saving…" : "Save draft"}
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] grid-cols-1 xl:grid-cols-[240px_minmax(500px,1fr)_360px]">
        <aside className="border-b border-[#e1e6ed] bg-white p-4 xl:border-r xl:border-b-0">
          <p className="px-1 text-[11px] font-semibold tracking-wide text-[#667085]">WORKSPACE</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["task", "outline"] as const).map((view) => (
              <button
                className={`rounded-md border px-3 py-2.5 text-xs font-medium capitalize ${
                  navigationView === view
                    ? "border-[#172f51] text-[#172f51]"
                    : "border-[#e1e6ed] text-[#667085]"
                }`}
                key={view}
                onClick={() => setNavigationView(view)}
                type="button"
              >
                {view === "task" ? "Task brief" : "Outline"}
              </button>
            ))}
          </div>

          {navigationView === "outline" ? (
            <nav className="mt-7" aria-label="SRS document sections">
              <p className="px-1 text-[11px] font-semibold tracking-wide text-[#667085]">DOCUMENT OUTLINE</p>
              <ol className="mt-4 space-y-1">
                {sections.map((section, index) => (
                  <li
                    className={`flex min-h-12 items-start gap-3 rounded-md px-2.5 py-2.5 text-[13px] ${
                      index === 0 ? "bg-[#ecf1f7] font-semibold text-[#172f51]" : "text-[#1d2939]"
                    }`}
                    key={section}
                  >
                    <span className="pt-0.5 text-xs text-[#667085]">{String(index + 1).padStart(2, "0")}</span>
                    <span>{section}</span>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <section className="mt-7" data-testid="task-brief">
              <p className="text-[11px] font-semibold tracking-wide text-[#667085]">TASK BRIEF</p>
              <h2 className="mt-4 text-lg font-semibold leading-6 text-[#172f51]">{workspace.task.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#667085]">{workspace.task.scenario}</p>
              <p className="mt-7 text-xs font-semibold text-[#1d2939]">Deliverable</p>
              <p className="mt-2 text-sm leading-6 text-[#667085]">A concise SRS draft with clear scope and testable requirements.</p>
            </section>
          )}

          <p className="mt-8 hidden text-xs leading-5 text-[#667085] xl:block">
            Drafts are persisted only when you choose Save draft.
          </p>
        </aside>

        <section className="min-w-0 bg-[#f6f8fb] p-4 sm:p-6" aria-label="SRS authoring area">
          <div className="mb-4 rounded-md border border-[#e1e6ed] bg-white px-4 py-3">
            <p className="text-xs font-semibold text-[#172f51]">Task scenario</p>
            <p className="mt-1 text-sm leading-6 text-[#667085]">{workspace.task.scenario}</p>
          </div>

          <div className="rounded-md border border-[#e1e6ed] bg-white">
            <div className="flex min-h-12 items-center gap-5 border-b border-[#e1e6ed] px-4 text-xs text-[#667085]" aria-hidden="true">
              <span className="font-medium text-[#1d2939]">Normal text</span>
              <span className="font-semibold text-[#1d2939]">B</span>
              <span className="italic text-[#1d2939]">I</span>
              <span className="underline text-[#1d2939]">U</span>
              <span>• List</span>
              <span>1. List</span>
            </div>
            <div className="px-5 py-6 sm:px-10 sm:py-8">
              <p className="text-[10px] font-semibold tracking-wide text-[#667085]">SOFTWARE REQUIREMENTS SPECIFICATION</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#172f51]">{workspace.task.title}</h2>
              <p className="mt-2 text-xs text-[#667085]">Working draft</p>
              <label className="mt-8 block text-sm font-semibold text-[#1d2939]" htmlFor="srs-draft">
                Draft content
              </label>
              <textarea
                className="mt-3 min-h-[510px] w-full resize-y rounded-md border border-[#e1e6ed] bg-white p-4 text-sm leading-7 text-[#1d2939] placeholder:text-[#98a2b3]"
                data-testid="draft-editor"
                id="srs-draft"
                maxLength={20_000}
                onChange={(event) => {
                  setContent(event.target.value);
                  setSaveState("unsaved");
                  setErrorMessage(null);
                }}
                placeholder={"1. Introduction\nDescribe the purpose and scope of the system.\n\n2. Functional Requirements\nFR-01: The system shall…"}
                value={content}
              />
              <div className="mt-3 flex items-start justify-between gap-4 text-xs text-[#667085]">
                <p>{content.length.toLocaleString("en-US")} / 20,000 characters</p>
                {errorMessage ? <p className="max-w-md text-right text-[#b42318]">{errorMessage}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-[#e1e6ed] bg-white px-5 py-6 xl:border-l xl:border-t-0" aria-label="AI assistant availability">
          <h2 className="text-lg font-semibold text-[#172f51]">AI Assistant</h2>
          <p className="mt-1 text-xs text-[#667085]">A thinking partner for your SRS</p>
          <div className="mt-7 rounded-md bg-[#f6f8fb] p-4">
            <p className="text-xs font-semibold text-[#172f51]">Not available in this skeleton</p>
            <p className="mt-2 text-xs leading-5 text-[#667085]">
              This panel preserves the reference layout. No chat, model call, or assistant response is implemented.
            </p>
          </div>
          <div className="mt-8 rounded-md border border-dashed border-[#cfd7e3] px-4 py-6 text-center">
            <p className="text-sm font-medium text-[#667085]">Assistant features are disabled</p>
            <p className="mt-2 text-xs leading-5 text-[#98a2b3]">Continue writing in the SRS editor and save the draft manually.</p>
          </div>
          <textarea
            aria-label="Disabled assistant input"
            className="mt-8 h-20 w-full resize-none rounded-md border border-[#e1e6ed] bg-[#f6f8fb] p-3 text-sm text-[#98a2b3]"
            disabled
            placeholder="Assistant input unavailable"
          />
          <button className="mt-3 w-full rounded-md bg-[#d7dee8] px-4 py-2.5 text-sm font-medium text-[#667085]" disabled type="button">
            Send unavailable
          </button>
        </aside>
      </div>
    </main>
  );
}
