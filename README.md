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
- A realistic AI runtime and MCP access workflow: choose the provider, deployment context, connected MCP server, and an explicit allow/deny/flag/log decision for every tool

## Why OpenUI changes the experience

A regular AI chat can understand a request and call an API, but the user still has to work through a transcript: read a question, type an answer, remember what was already decided, and trust that the assistant interpreted everything correctly. That pattern becomes fragile when the underlying workflow is a long, conditional enterprise form.

OpenUI lets the assistant respond with an interface, not only text. In this demo, the model can place a focused form, selection control, warning, or review card directly in the conversation. The UI can adapt to the current policy stage while still using components that the application has explicitly made available.

| Text-only AI chat | OpenUI-powered workflow |
| --- | --- |
| Every answer is typed as prose | The assistant can offer validated inputs, choices, switches, and forms |
| Progress is buried in conversation history | Completion and missing requirements remain visible beside the chat |
| Users must mentally reconstruct the current state | A live summary shows the authoritative policy data |
| The model describes what an API did | Tool results update deterministic application state and the UI reflects it |
| The same chat layout is used for every step | The interface adapts to the decision being made |
| Design and accessibility vary with generated markup | The model selects from an approved component library |

The important idea is that OpenUI does not replace the company application or give the model permission to generate arbitrary production UI. It adds a generative orchestration layer over a controlled set of components and actions. The company keeps ownership of validation, state, permissions, APIs, visual standards, and final writes.

### Where OpenUI is used in this project

1. `AgentInterface` provides the conversational shell, streaming states, starter actions, and responsive behavior.
2. The server gives Gemini a compact catalog of approved OpenUI components suitable for this policy workflow.
3. Gemini streams OpenUI language that becomes interactive React controls inside the chat.
4. Form actions return structured user choices to the conversation instead of forcing the user to describe every field in prose.
5. Policy tools validate and merge those choices into a canonical `PolicyDraft`.
6. The center progress view and right-hand summary are ordinary React UI derived from that validated state. They do not depend on the model being correct about progress.

This separation is deliberate: OpenUI owns the adaptive conversational surface, while application code owns business truth.

### The demo workflow

The example policy models an agent that responds to compromised employee accounts. The assistant first captures identity, then asks where the agent runs (GCP Vertex AI, Azure AI Studio, AWS Bedrock, or OpenAI Enterprise), which account/project, model deployment, and region it uses. Next it selects from a mock connected MCP catalog—such as Microsoft Entra ID, GitHub Enterprise, Jira Cloud, PagerDuty, or an AWS data platform—and records an explicit action for every selected tool: allow, deny, flag, or log. Ownership, data handling, guardrails, and monitoring complete the review. This mirrors the decisions a real security team must make without connecting the demo to production systems.

After MCP decisions are recorded, the chat can render a simulated risk-per-tool bar chart. Its percentages come from a deterministic demo heuristic based on action sensitivity, production usage, and the selected control—not from a real scan. The chart is deliberately labeled as illustrative and helps demonstrate the larger product idea: generated UI can turn structured context into decision support at exactly the moment the user chooses between allow, deny, flag, or log.

### Using the same approach with an existing company design system

An enterprise integration would expose a curated OpenUI library backed by the company’s existing React components—for example its `Select`, `DatePicker`, `ApprovalCard`, `RiskBanner`, and form controls. The model would see their supported signatures and intent, while employees would see the same branded, accessible, tested components already used elsewhere in the product.

The adoption path can be incremental:

- Start with one complicated workflow and a small approved component set.
- Map OpenUI components to existing design-system primitives rather than creating a second UI system.
- Connect model-visible actions to narrow, permission-checked application tools.
- Keep drafts, validation, audit events, and final submission in existing backend services.
- Add domain components over time, such as an identity picker, entitlement matrix, policy diff, or approval timeline.

This makes the assistant more than a chat window attached to APIs. It becomes a guided workflow that can ask the right question in the right UI, show the consequences immediately, and keep the user oriented from the first answer through final review.

### What this demo is proving

The policy domain is an example of a broader opportunity: complicated forms do not have to be presented as one large static document. The assistant can progressively reveal only the controls needed for the current decision, translate conversational answers into structured state, surface risk at the moment it matters, and finish with an inspectable summary before any final action.

The initial chat begins as the primary focus. After the first message, it transitions into a three-part workbench: conversation on the left, deterministic progress in the center, and the current policy summary on the right. During model work, the interface immediately shows staged activity so the user always has feedback even before the next generated control begins streaming.

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
       └── OpenUI response + live progress and summary workbench
```

The current draft is carried in validated tool results and mirrored in a short-lived in-memory demo session so successive generated forms cannot lose earlier answers. On every request, the server creates request-scoped policy tools from that canonical draft. Gemini can request changes, but only the application can validate, merge, score, or create a policy.

## Setup

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
```

Create a free API key in [Google AI Studio](https://aistudio.google.com/apikey), then set it in `.env.local`:

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.5-flash-lite
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
- `src/app/api/chat/route.ts` — Gemini transport, compact OpenUI prompt, and tool loop
- `src/lib/policy.ts` — policy schema, merge logic, scoring, and warnings
- `src/lib/policy-openui.ts` — approved component subset and workflow-specific OpenUI rules
- `src/lib/tools/policy-tools.ts` — controlled update and create operations
- `src/components/policy-workbench.tsx` — live progress, activity, and summary UI

## Demo limitations

- Conversation state is in memory and is lost on refresh.
- Policy creation returns a mock identifier; it does not call a company system.
- Authentication, a database, RBAC, and durable audit logs are deliberately out of scope.
- The demo is not approved for real security policy processing.
