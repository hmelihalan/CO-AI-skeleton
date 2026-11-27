export type SectionKind = "narrative" | "requirements";

export type SrsTemplateSection = {
  sectionId: string;
  number: string;
  title: string;
  kind: SectionKind;
  help: string;
  example?: string;
};

export type SrsTemplate = {
  templateId: string;
  version: string;
  title: string;
  source: string;
  sections: readonly SrsTemplateSection[];
};

// Source: Figma file 319u5TOumHmdU38pceGrjp,
// frame "02 · Task instructions" (node 2:506), text node 2:523.
export const STUDENT_SRS_TEMPLATE = {
  templateId: "coai-campus-room-srs",
  version: "1.0.0",
  title: "Software Requirements Specification",
  source: "Figma 319u5TOumHmdU38pceGrjp / node 2:506",
  sections: [
    {
      sectionId: "introduction",
      number: "1",
      title: "Introduction",
      kind: "narrative",
      help: "Define the purpose and scope. Record explicit exclusions and avoid inventing stakeholder decisions.",
      example:
        "Example from the reference: explain what the system covers and state that payments and room maintenance are out of scope.",
    },
    {
      sectionId: "overall-description",
      number: "2",
      title: "Overall Description",
      kind: "narrative",
      help: "Describe users, operating context, major capabilities, constraints, dependencies, and assumptions.",
      example:
        "Example from the reference: students search and request rooms; facilities staff manage availability and approvals.",
    },
    {
      sectionId: "functional-requirements",
      number: "3",
      title: "Functional Requirements",
      kind: "requirements",
      help: "Add individually identifiable, testable system behaviors. Use verifiable language.",
      example:
        "Example pattern: FR-01 — The system shall allow authenticated students to search available rooms by date and time.",
    },
    {
      sectionId: "external-interfaces",
      number: "4",
      title: "External Interfaces",
      kind: "requirements",
      help: "Specify interfaces with external systems and services as identifiable, verifiable requirements.",
      example:
        "Example pattern: EI-01 — The system shall use university single sign-on for authentication.",
    },
    {
      sectionId: "nonfunctional-requirements",
      number: "5",
      title: "Nonfunctional Requirements",
      kind: "requirements",
      help: "State measurable quality criteria such as performance, accessibility, and security.",
      example:
        "Example pattern: NFR-01 — Search results shall appear within 2 seconds for 95% of requests under the stated load.",
    },
  ],
} as const satisfies SrsTemplate;

export const STUDENT_SRS_SECTION_IDS = new Set<string>(
  STUDENT_SRS_TEMPLATE.sections.map((section) => section.sectionId),
);

export const REQUIREMENT_SECTION_IDS = new Set<string>(
  STUDENT_SRS_TEMPLATE.sections
    .filter((section) => section.kind === "requirements")
    .map((section) => section.sectionId),
);
