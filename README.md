# Aegis — OpenUI Security Policy Demo

A conversational demo for creating an AI agent security identity policy. The assistant gathers policy facts in chat, renders adaptive controls with [OpenUI](https://www.openui.com/), and updates a deterministic progress and summary panel after every accepted change.

This project is intentionally a synthetic, single-user demo. Do not enter credentials, personal information, or confidential company data.

## What it demonstrates

- OpenUI Agent Interface and streamed generative UI
- Gemini through Vercel AI SDK's native Google provider
- A structured, Zod-validated policy draft instead of LLM-owned state
- Deterministic completion scoring and conditional security warnings
- Explicit confirmation before a mock policy can be created
- Export of the current policy as JSON

## Architecture

```text
User conversation
       │
       ▼
Next.js /api/chat ──► Gemini
       │                 │
       │        proposes narrow tool calls
       ▼                 ▼
Validated policy tools + canonical PolicyDraft
       │
       ├── deterministic progress / warnings
       └── OpenUI response + live status sidebar
```

The current draft is carried in validated tool results in the conversation. On every request, the server recovers the latest valid snapshot and creates request-scoped policy tools. Gemini can request changes, but only the application can validate, merge, score, or create a policy.

## Setup

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
```

Create a free API key in [Google AI Studio](https://aistudio.google.com/apikey), then set it in `.env.local`:

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
```

Model availability and free-tier limits can change. Choose another Gemini model in `.env.local` if necessary. Free-tier prompts may be used by Google to improve its products, so only use synthetic demo data.

## Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). A useful demo prompt is:

> Help me create a production policy for an automation agent that disables compromised employee accounts.

## Quality checks

```bash
pnpm lint
pnpm test
pnpm build
# or all three
pnpm check
```

## Important files

- `src/app/page.tsx` — OpenUI Agent Interface and demo shell
- `src/app/api/chat/route.ts` — Gemini transport, system instructions, and tool loop
- `src/lib/policy.ts` — policy schema, merge logic, scoring, and warnings
- `src/lib/tools/policy-tools.ts` — controlled read, update, and create operations
- `src/components/policy-sidebar.tsx` — live progress and summary UI

## Demo limitations

- Conversation state is in memory and is lost on refresh.
- Policy creation returns a mock identifier; it does not call a company system.
- Authentication, a database, RBAC, and durable audit logs are deliberately out of scope.
- The demo is not approved for real security policy processing.
