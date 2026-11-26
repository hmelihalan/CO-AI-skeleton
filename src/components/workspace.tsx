"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SectionStatus = "not_started" | "in_progress" | "completed";
type SaveState = "loading" | "ready" | "unsaved" | "saving" | "saved" | "error";
type NavigationView = "task" | "outline";

type TemplateSection = {
  sectionId: string;
  number: string;
  title: string;
  kind: "narrative" | "requirements";
  help: string;
  example?: string;
};

type SectionResponse = {
  sectionId: string;
  content: string;
  status: SectionStatus;
};

type Requirement = {
  internalId: string;
  sectionId: string;
  code: string;
  content: string;
};

type WorkspacePayload = {
  task: { id: string; title: string; scenario: string };
  template: {
    templateId: string;
    version: string;
    title: string;
    source: string;
    sections: TemplateSection[];
  };
  document: {
    id: string;
    templateId: string;
    templateVersion: string;
    updatedAt: string;
    sections: SectionResponse[];
    requirements: Requirement[];
  } | null;
  progress: { completed: number; total: number; percentage: number };
};

const statusLabels: Record<SectionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const saveLabels: Record<SaveState, string> = {
  loading: "Loading document…",
  ready: "No saved document",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved to database",
  error: "Save failed",
};

function hasSectionContent(
  section: SectionResponse,
  requirements: Requirement[],
) {
  return (
    section.content.trim().length > 0 ||
    requirements.some(
      (requirement) =>
        requirement.sectionId === section.sectionId &&
        (requirement.code.trim().length > 0 || requirement.content.trim().length > 0),
    )
  );
}

async function requestWorkspace(signal?: AbortSignal) {
  const response = await fetch("/api/workspace", { cache: "no-store", signal });
  const data = (await response.json()) as WorkspacePayload | { error?: string };
  if (!response.ok || !("task" in data)) {
    throw new Error("error" in data && data.error ? data.error : "Unable to load the workspace.");
  }
  return data;
}

function StatusDot({ status }: { status: SectionStatus }) {
  const color =
    status === "completed"
      ? "bg-[#067647]"
      : status === "in_progress"
        ? "bg-[#dc6803]"
        : "bg-[#98a2b3]";
  return <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${color}`} />;
}

export function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [sections, setSections] = useState<SectionResponse[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [navigationView, setNavigationView] = useState<NavigationView>("outline");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const revisionRef = useRef(0);

  const applyWorkspace = useCallback((data: WorkspacePayload) => {
    const initialSections =
      data.document?.sections ??
      data.template.sections.map((section) => ({
        sectionId: section.sectionId,
        content: "",
        status: "not_started" as const,
      }));
    setWorkspace(data);
    setSections(initialSections);
    setRequirements(data.document?.requirements ?? []);
    setActiveSectionId((current) => current || data.template.sections[0]?.sectionId || "");
    setLastSavedAt(data.document?.updatedAt ?? null);
    setSaveState(data.document ? "saved" : "ready");
    setErrorMessage(null);
    revisionRef.current = 0;
  }, []);

  const loadWorkspace = useCallback(async () => {
    setSaveState("loading");
    setErrorMessage(null);
    try {
      applyWorkspace(await requestWorkspace());
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the workspace.");
    }
  }, [applyWorkspace]);

  useEffect(() => {
    const controller = new AbortController();
    requestWorkspace(controller.signal)
      .then(applyWorkspace)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSaveState("error");
          setErrorMessage(error instanceof Error ? error.message : "Unable to load the workspace.");
        }
      });
    return () => controller.abort();
  }, [applyWorkspace]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === "unsaved" || saveState === "error") {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [saveState]);

  const markDirty = () => {
    revisionRef.current += 1;
    setSaveState("unsaved");
    setErrorMessage(null);
  };

  const activeIndex =
    workspace?.template.sections.findIndex((section) => section.sectionId === activeSectionId) ?? 0;
  const activeDefinition = workspace?.template.sections[activeIndex];
  const activeResponse = sections.find((section) => section.sectionId === activeSectionId);
  const activeRequirements = requirements.filter(
    (requirement) => requirement.sectionId === activeSectionId,
  );

  const duplicateCodes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const requirement of requirements) {
      const normalized = requirement.code.trim().toLocaleLowerCase("en-US");
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code),
    );
  }, [requirements]);

  const invalidRequirements = requirements.some(
    (requirement) =>
      !requirement.code.trim() ||
      !requirement.content.trim() ||
      duplicateCodes.has(requirement.code.trim().toLocaleLowerCase("en-US")),
  );
  const completedCount = sections.filter((section) => section.status === "completed").length;
  const totalCount = workspace?.template.sections.length ?? 0;
  const percentage = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const updateSectionContent = (content: string) => {
    setSections((current) =>
      current.map((section) =>
        section.sectionId === activeSectionId
          ? {
              ...section,
              content,
              status:
                content.trim() ||
                requirements.some(
                  (requirement) =>
                    requirement.sectionId === activeSectionId &&
                    (requirement.code.trim() || requirement.content.trim()),
                )
                  ? "in_progress"
                  : "not_started",
            }
          : section,
      ),
    );
    markDirty();
  };

  const updateRequirement = (
    internalId: string,
    field: "code" | "content",
    value: string,
  ) => {
    const nextRequirements = requirements.map((requirement) =>
      requirement.internalId === internalId ? { ...requirement, [field]: value } : requirement,
    );
    setRequirements(nextRequirements);
    setSections((current) =>
      current.map((section) =>
        section.sectionId === activeSectionId
          ? {
              ...section,
              status: hasSectionContent(section, nextRequirements)
                ? "in_progress"
                : "not_started",
            }
          : section,
      ),
    );
    markDirty();
  };

  const addRequirement = () => {
    if (!activeDefinition) return;
    const prefix =
      activeDefinition.sectionId === "functional-requirements"
        ? "FR"
        : activeDefinition.sectionId === "external-interfaces"
          ? "EI"
          : "NFR";
    let number = activeRequirements.length + 1;
    let code = `${prefix}-${String(number).padStart(2, "0")}`;
    const used = new Set(requirements.map((requirement) => requirement.code.toLocaleLowerCase("en-US")));
    while (used.has(code.toLocaleLowerCase("en-US"))) {
      number += 1;
      code = `${prefix}-${String(number).padStart(2, "0")}`;
    }
    setRequirements((current) => [
      ...current,
      { internalId: crypto.randomUUID(), sectionId: activeSectionId, code, content: "" },
    ]);
    setSections((current) =>
      current.map((section) =>
        section.sectionId === activeSectionId
          ? { ...section, status: "in_progress" }
          : section,
      ),
    );
    markDirty();
  };

  const deleteRequirement = (internalId: string) => {
    const nextRequirements = requirements.filter(
      (requirement) => requirement.internalId !== internalId,
    );
    setRequirements(nextRequirements);
    setSections((current) =>
      current.map((section) =>
        section.sectionId === activeSectionId
          ? {
              ...section,
              status: hasSectionContent(section, nextRequirements)
                ? "in_progress"
                : "not_started",
            }
          : section,
      ),
    );
    markDirty();
  };

  const changeCompletion = (status: "completed" | "in_progress") => {
    if (!activeResponse || !hasSectionContent(activeResponse, requirements)) return;
    setSections((current) =>
      current.map((section) =>
        section.sectionId === activeSectionId ? { ...section, status } : section,
      ),
    );
    markDirty();
  };

  const saveDocument = async () => {
    if (!workspace || saveState === "saving" || invalidRequirements) return;
    const saveRevision = revisionRef.current;
    setSaveState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/tasks/${workspace.task.id}/document`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: workspace.template.templateId,
          templateVersion: workspace.template.version,
          sections,
          requirements,
        }),
      });
      const data = (await response.json()) as {
        document?: WorkspacePayload["document"];
        error?: string;
      };
      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "The document could not be saved.");
      }
      setLastSavedAt(data.document.updatedAt);
      if (revisionRef.current === saveRevision) {
        setSections(data.document.sections);
        setRequirements(data.document.requirements);
        setSaveState("saved");
      } else {
        setSaveState("unsaved");
      }
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "The document could not be saved.");
    }
  };

  const savedTime = useMemo(() => {
    if (!lastSavedAt) return null;
    return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(lastSavedAt),
    );
  }, [lastSavedAt]);

  if (!workspace || !activeDefinition || !activeResponse) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-6">
        <section className="w-full max-w-md rounded-lg border border-[#e1e6ed] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#172f51]">
            {saveState === "loading" ? "Loading CO-AI workspace…" : "Workspace unavailable"}
          </p>
          {errorMessage ? <p className="mt-3 text-sm leading-6 text-[#b42318]">{errorMessage}</p> : null}
          {saveState === "error" ? (
            <button className="mt-5 rounded-md bg-[#172f51] px-5 py-2.5 text-sm font-medium text-white" onClick={() => void loadWorkspace()} type="button">
              Retry
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const activeHasContent = hasSectionContent(activeResponse, requirements);
  const activeHasInvalidRequirement = activeRequirements.some(
    (requirement) =>
      !requirement.code.trim() ||
      !requirement.content.trim() ||
      duplicateCodes.has(requirement.code.trim().toLocaleLowerCase("en-US")),
  );

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#1d2939]">
      <header className="flex min-h-20 items-center gap-5 border-b border-[#e1e6ed] bg-white px-5 py-4 lg:px-7">
        <div className="text-2xl font-bold tracking-[-0.02em] text-[#172f51]">CO-AI</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{workspace.task.title}</h1>
          <p className="mt-0.5 text-xs text-[#667085]">
            SRS authoring session / Template {workspace.template.version}
          </p>
        </div>
        <div className="hidden text-right sm:block" aria-live="polite">
          <p className={`text-xs font-medium ${saveState === "error" ? "text-[#b42318]" : saveState === "unsaved" ? "text-[#dc6803]" : "text-[#667085]"}`} data-testid="save-status">
            {saveLabels[saveState]}
          </p>
          {saveState === "saved" && savedTime ? <p className="mt-1 text-[11px] text-[#98a2b3]">Last saved at {savedTime}</p> : null}
        </div>
        <button
          className="min-w-32 rounded-md bg-[#172f51] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#203f6b] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={saveState === "loading" || saveState === "saving" || invalidRequirements}
          onClick={() => void saveDocument()}
          type="button"
        >
          {saveState === "saving" ? "Saving…" : "Save document"}
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] grid-cols-1 xl:grid-cols-[290px_minmax(500px,1fr)_320px]">
        <aside className="border-b border-[#e1e6ed] bg-white p-4 xl:border-r xl:border-b-0">
          <p className="px-1 text-[11px] font-semibold tracking-wide text-[#667085]">WORKSPACE</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["task", "outline"] as const).map((view) => (
              <button className={`rounded-md border px-3 py-2.5 text-xs font-medium ${navigationView === view ? "border-[#172f51] text-[#172f51]" : "border-[#e1e6ed] text-[#667085]"}`} key={view} onClick={() => setNavigationView(view)} type="button">
                {view === "task" ? "Task brief" : "Outline"}
              </button>
            ))}
          </div>

          {navigationView === "outline" ? (
            <>
              <nav className="mt-6" aria-label="SRS document sections">
                <p className="px-1 text-[11px] font-semibold tracking-wide text-[#667085]">DOCUMENT OUTLINE</p>
                <div className="mt-4 rounded-md border border-[#e1e6ed] p-2" role="tree" aria-label="Template section tree">
                  <div className="px-2 py-2 text-xs font-semibold text-[#172f51]" role="treeitem" aria-expanded="true" aria-selected="false">
                    {workspace.template.title}
                  </div>
                  <ol className="border-l border-[#d7dee8] pl-2" role="group">
                    {workspace.template.sections.map((definition) => {
                      const response = sections.find((section) => section.sectionId === definition.sectionId)!;
                      const active = definition.sectionId === activeSectionId;
                      return (
                        <li key={definition.sectionId} role="none">
                          <button
                            className={`flex w-full items-start gap-2 rounded-md px-2 py-2.5 text-left ${active ? "bg-[#ecf1f7] text-[#172f51]" : "text-[#1d2939] hover:bg-[#f6f8fb]"}`}
                            data-testid={`section-nav-${definition.sectionId}`}
                            onClick={() => setActiveSectionId(definition.sectionId)}
                            role="treeitem"
                            aria-selected={active}
                            type="button"
                          >
                            <StatusDot status={response.status} />
                            <span className="min-w-0">
                              <span className="block text-xs font-medium">{definition.number}. {definition.title}</span>
                              <span className="mt-0.5 block text-[10px] text-[#667085]">{statusLabels[response.status]}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </nav>
              <section className="mt-6 rounded-md bg-[#f6f8fb] p-3" aria-label="Document completion progress">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-[#172f51]">Document progress</p>
                  <p className="text-lg font-semibold text-[#172f51]" data-testid="progress-percentage">{percentage}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe5ed]">
                  <div className="h-full rounded-full bg-[#172f51] transition-[width]" style={{ width: `${percentage}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-[#667085]" data-testid="progress-count">{completedCount} / {totalCount} sections completed</p>
                <p className="mt-1 text-[10px] leading-4 text-[#98a2b3]">Completion progress, not a quality score or grade.</p>
              </section>
            </>
          ) : (
            <section className="mt-7" data-testid="task-brief">
              <p className="text-[11px] font-semibold tracking-wide text-[#667085]">TASK BRIEF</p>
              <h2 className="mt-4 text-lg font-semibold leading-6 text-[#172f51]">{workspace.task.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#667085]">{workspace.task.scenario}</p>
              <p className="mt-7 text-xs font-semibold">Deliverable</p>
              <p className="mt-2 text-sm leading-6 text-[#667085]">An SRS with the five sections defined by template {workspace.template.version}.</p>
            </section>
          )}
        </aside>

        <section className="min-w-0 bg-[#f6f8fb] p-4 sm:p-6" aria-label="SRS authoring area">
          <div className="rounded-md border border-[#e1e6ed] bg-white">
            <div className="border-b border-[#e1e6ed] px-5 py-4 sm:px-8">
              <p className="text-[10px] font-semibold tracking-wide text-[#667085]">SOFTWARE REQUIREMENTS SPECIFICATION</p>
              <h2 className="mt-2 text-xl font-semibold text-[#172f51]">{workspace.task.title}</h2>
              <p className="mt-1 text-xs text-[#667085]">Template {workspace.template.version} · Working document</p>
            </div>
            <div className="px-5 py-6 sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#667085]">SECTION {activeDefinition.number} OF {totalCount}</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#172f51]">{activeDefinition.number}. {activeDefinition.title}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${activeResponse.status === "completed" ? "bg-[#ecfdf3] text-[#067647]" : activeResponse.status === "in_progress" ? "bg-[#fff6ed] text-[#b54708]" : "bg-[#f2f4f7] text-[#667085]"}`} data-testid="section-status">
                  {statusLabels[activeResponse.status]}
                </span>
              </div>

              <label className="mt-7 block text-sm font-semibold" htmlFor="section-content">Section notes</label>
              <textarea
                className="mt-2 min-h-48 w-full resize-y rounded-md border border-[#d7dee8] p-4 text-sm leading-6 outline-none focus:border-[#172f51]"
                data-testid="section-editor"
                id="section-content"
                maxLength={20_000}
                onChange={(event) => updateSectionContent(event.target.value)}
                placeholder="Write your response for this section…"
                value={activeResponse.content}
              />
              <p className="mt-1 text-right text-[11px] text-[#98a2b3]">{activeResponse.content.length.toLocaleString("en-US")} / 20,000</p>

              {activeDefinition.kind === "requirements" ? (
                <section className="mt-7" aria-labelledby="requirements-heading">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold" id="requirements-heading">Requirements</h4>
                      <p className="mt-1 text-xs text-[#667085]">Codes must be unique throughout this document.</p>
                    </div>
                    <button className="rounded-md border border-[#172f51] px-3 py-2 text-xs font-medium text-[#172f51]" data-testid="add-requirement" onClick={addRequirement} type="button">+ Add requirement</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {activeRequirements.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[#cfd7e3] p-5 text-center text-xs text-[#667085]">No requirements added yet.</div>
                    ) : activeRequirements.map((requirement) => {
                      const duplicate = duplicateCodes.has(requirement.code.trim().toLocaleLowerCase("en-US"));
                      return (
                        <article className="rounded-md bg-[#f6f8fb] p-4" data-testid="requirement-row" key={requirement.internalId}>
                          <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
                            <div>
                              <label className="text-[11px] font-semibold text-[#667085]" htmlFor={`code-${requirement.internalId}`}>Requirement code</label>
                              <input className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ${duplicate ? "border-[#d92d20]" : "border-[#d7dee8]"}`} id={`code-${requirement.internalId}`} onChange={(event) => updateRequirement(requirement.internalId, "code", event.target.value)} value={requirement.code} />
                              {duplicate ? <p className="mt-1 text-[10px] text-[#b42318]">Code already used.</p> : null}
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-[#667085]" htmlFor={`requirement-${requirement.internalId}`}>Requirement text</label>
                              <textarea className="mt-1 min-h-20 w-full resize-y rounded-md border border-[#d7dee8] bg-white px-3 py-2 text-sm leading-5 outline-none" id={`requirement-${requirement.internalId}`} onChange={(event) => updateRequirement(requirement.internalId, "content", event.target.value)} placeholder="The system shall…" value={requirement.content} />
                            </div>
                            <button aria-label={`Delete ${requirement.code || "requirement"}`} className="self-end rounded-md border border-[#fecdca] px-3 py-2 text-xs font-medium text-[#b42318]" onClick={() => deleteRequirement(requirement.internalId)} type="button">Delete</button>
                          </div>
                          <p className="mt-2 text-[10px] text-[#98a2b3]">Internal ID: {requirement.internalId}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {activeHasInvalidRequirement ? <p className="mt-4 rounded-md bg-[#fef3f2] px-4 py-3 text-xs text-[#b42318]">Complete every requirement code and text, and resolve duplicate codes before completing or saving.</p> : null}
              {errorMessage ? <p className="mt-4 rounded-md bg-[#fef3f2] px-4 py-3 text-xs text-[#b42318]" role="alert">{errorMessage}</p> : null}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e6ed] pt-5">
                <div className="flex gap-2">
                  <button className="rounded-md border border-[#d7dee8] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40" disabled={activeIndex === 0} onClick={() => setActiveSectionId(workspace.template.sections[activeIndex - 1]!.sectionId)} type="button">← Previous</button>
                  <button className="rounded-md border border-[#d7dee8] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40" disabled={activeIndex === totalCount - 1} onClick={() => setActiveSectionId(workspace.template.sections[activeIndex + 1]!.sectionId)} type="button">Next →</button>
                </div>
                {activeResponse.status === "completed" ? (
                  <button className="rounded-md border border-[#172f51] px-4 py-2 text-sm font-medium text-[#172f51]" data-testid="reopen-section" onClick={() => changeCompletion("in_progress")} type="button">Reopen section</button>
                ) : (
                  <button className="rounded-md bg-[#172f51] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="mark-complete" disabled={!activeHasContent || activeHasInvalidRequirement} onClick={() => changeCompletion("completed")} type="button">Mark as complete</button>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-[#e1e6ed] bg-white px-5 py-6 xl:border-l xl:border-t-0" aria-label="Template guidance">
          <h2 className="text-lg font-semibold text-[#172f51]">Template guidance</h2>
          <p className="mt-1 text-xs text-[#667085]">Help for {activeDefinition.number}. {activeDefinition.title}</p>
          <div className="mt-7 rounded-md bg-[#f6f8fb] p-4">
            <p className="text-xs font-semibold text-[#172f51]">What belongs here</p>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{activeDefinition.help}</p>
          </div>
          {activeDefinition.example ? (
            <div className="mt-4 rounded-md border border-[#d7dee8] p-4">
              <p className="text-xs font-semibold text-[#172f51]">Reference example</p>
              <p className="mt-2 text-xs leading-5 text-[#667085]">{activeDefinition.example}</p>
              <p className="mt-3 text-[10px] leading-4 text-[#98a2b3]">Shown as help only. It is not inserted into your response.</p>
            </div>
          ) : null}
          <div className="mt-6 border-t border-[#e1e6ed] pt-5">
            <p className="text-xs font-semibold text-[#172f51]">Template provenance</p>
            <p className="mt-2 text-[11px] leading-5 text-[#667085]">Student template: {workspace.template.source}</p>
            <p className="mt-2 text-[11px] leading-5 text-[#98a2b3]">The repository SDD describes CO-AI itself and is not used as the student SRS template.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
