# CO-AI running skeleton

This repository contains a working vertical slice of a template-based Software Requirements Specification (SRS) editor. It connects a Next.js App Router interface to route handlers and PostgreSQL, with schema validation and browser tests covering the core authoring flow.

The skeleton deliberately excludes AI calls, authentication, staff tools, analytics, grading, submission locking, and `localStorage` persistence.

## What is implemented

- Five ordered SRS sections defined by the versioned template in `src/lib/srs-template.ts`
- Independent section notes with Previous and Next navigation
- Requirement create, update, and delete operations in sections 3–5
- Document-wide, case-insensitive requirement-code uniqueness
- Explicit Not started, In progress, and Completed section states
- Server-calculated progress based on completed sections
- Atomic PostgreSQL saves and reload restoration
- UI and server validation for IDs, template versions, section sets, requirements, and state transitions
- End-to-end coverage with Playwright against a dedicated PostgreSQL test database

## Architecture

```mermaid
flowchart LR
    UI[Next.js section editor] -->|GET /api/workspace| API[App Router route handlers]
    UI -->|PUT /api/tasks/:id/document| API
    API --> VALIDATION[Zod validation]
    VALIDATION --> TX[Drizzle transaction]
    TX --> DB[(PostgreSQL)]
```

Only server-side modules access the PostgreSQL pool. A save commits the section responses, completion states, requirements, and document timestamp together, or rolls them all back.

## Progress rules

Each section has one state:

- **Not started:** no notes or requirements
- **In progress:** content exists, but the section is not explicitly complete
- **Completed:** content exists and the user selected **Mark as complete**

An empty section cannot be completed. Editing completed content reopens that section automatically. Progress is calculated as:

```text
completed sections / 5 sections
```

The percentage is document-completion progress, not a quality score or grade. The API does not accept a client-supplied percentage.

## Project structure

```text
src/app/                 Pages, layout, and API route handlers
src/components/          SRS workspace interface
src/db/                  Drizzle schema and PostgreSQL connection
src/lib/                 Template, validation, and workspace logic
drizzle/                 SQL migrations and migration metadata
scripts/                 Database migration, seed, and test preparation
tests/e2e/               Playwright browser tests
docs/evidence/           Browser-test screenshots
```

The normalized template identity is `coai-campus-room-srs@1.0.0`. Student responses are stored separately from that immutable template definition.

## Requirements

- Node.js 20.9 or newer
- npm
- Docker with Docker Compose, or a compatible PostgreSQL 17 instance

## Local setup

Install dependencies and create a local environment file:

```powershell
npm install
Copy-Item .env.example .env
```

Start PostgreSQL, then migrate and seed the database:

```powershell
docker compose up -d
$env:DATABASE_URL = "postgresql://coai:coai_local_password@localhost:5432/coai"
npm run db:migrate
npm run db:seed
```

Start the application:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Next.js loads `DATABASE_URL` from the root `.env` file for the application. The migration and seed commands are standalone scripts, so set `DATABASE_URL` in the shell before running them.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed the fixed skeleton task |
| `npm run db:test:prepare` | Recreate the dedicated test database |
| `npm run test:e2e` | Run the Playwright browser suite |

## Verification

Run the static and production checks:

```powershell
npm run lint
npm run typecheck
npm run build
```

Prepare the dedicated test database and run the browser suite:

```powershell
npm run db:test:prepare
$env:DATABASE_URL = "postgresql://coai:coai_local_password@localhost:5432/coai_test"
npm run db:migrate
npm run db:seed
npm run test:e2e
```

The test suite refuses to run against a database whose name is not `coai_test`. It covers section state and progress, save/reload restoration, unsaved navigation, requirement operations and validation, rejected invalid payloads, and failed-save recovery.

## API summary

- `GET /api/workspace` returns the fixed task, template definition, saved document, and server-calculated progress.
- `PUT /api/tasks/{taskId}/document` validates and atomically saves the full document.

## Current limitations

- One fixed synthetic task is shared by all users.
- The registry contains one template version.
- Section notes are plain text; rich-text formatting is not implemented.
- Template guidance replaces the design's AI panel because AI is outside this skeleton's scope.
- This is a course running skeleton, not a production research system.
