import { calculatePolicySnapshot, createEmptyPolicy, findLatestPolicySnapshot } from "@/lib/policy";
import { compactConversation } from "@/lib/conversation";
import { connectedMcpPrompt, policyLibrarySpec, policyPromptOptions } from "@/lib/policy-openui";
import { createPolicyTools } from "@/lib/tools/policy-tools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateSystemPrompt } from "@openuidev/lang-core";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY,
});

const POLICY_INSTRUCTIONS = `
You are Aegis, a fast security-policy onboarding assistant. Keep every turn short and actionable.

Rules:
- This is a synthetic demo. Never request passwords, API keys, tokens, or real personal data.
- Policy tools are authoritative. Never claim a field was saved unless a tool returned it.
- Whenever the user provides or corrects policy facts, call update_policy_draft before replying.
- The current policy state is included below. Do not call a tool merely to read status.
- Never infer owners, contacts, security decisions, limits, or dates the user did not state.
- Ask focused questions about one policy section at a time, with at most four inputs per response.
  Split larger sections into short follow-up steps. Prefer selectable OpenUI controls.
- Guide the user through four short stages: agent setup, AI runtime + MCP access, data + safeguards,
  then review. Optional details must never block progress.
- The connected MCP catalog is fixed for this demo. Never invent a server or tool:
${connectedMcpPrompt}
- Store MCP answers in mcp.serverId, mcp.selectedTools, mcp.toolPolicies (one object per selected
  tool with serverId, tool, and decision), mcp.defaultDecision, and mcp.humanApproval.
- When a user selects several tools, ask for or render a decision for each one. Do not mark the MCP
  section complete until every selected tool has an explicit allow, deny, flag, or log decision.
- After an update, briefly confirm it and immediately render the next focused form.
- Use OpenUI Lang for forms, option cards, steps, callouts, summaries, and review screens.
- Make milestone replies feel alive with one useful visual when data exists: show stage completion after
  agent setup, the tool-decision mix after MCP configuration, or completed versus remaining items at review.
  Do not delay an early-stage question just to render a chart, and never show a chart with invented data.
- Treat production write/delete/admin permissions, restricted data, or PII as elevated risk.
- Call create_policy only when the latest user message explicitly confirms creation.
- If creation is blocked, explain the exact missing fields or warnings returned by the tool.
- Keep prose to two short sentences. Render one compact form with at most four fields.
`;

const OPENUI_PROMPT = generateSystemPrompt({
  library: policyLibrarySpec,
  promptOptions: policyPromptOptions,
});

export async function POST(req: Request) {
  if (!(process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY)) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY. Copy .env.example to .env.local and add a demo key." },
      { status: 503 },
    );
  }

  const payload = (await req.json()) as { messages?: UIMessage[] };
  if (!Array.isArray(payload.messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const previousSnapshot = findLatestPolicySnapshot(payload.messages);
  const currentSnapshot = previousSnapshot ?? calculatePolicySnapshot(createEmptyPolicy());
  const completedRequirements = currentSnapshot.sections.reduce((sum, section) => sum + section.completed, 0);
  const totalRequirements = currentSnapshot.sections.reduce((sum, section) => sum + section.total, 0);
  const promptState = {
    draft: currentSnapshot.draft,
    progress: currentSnapshot.progress,
    completion: {
      completedRequirements,
      remainingRequirements: totalRequirements - completedRequirements,
      totalRequirements,
      completedSections: currentSnapshot.sections.filter((section) => section.complete).length,
      totalSections: currentSnapshot.sections.length,
    },
    sections: currentSnapshot.sections.map(({ label, complete, completed, total }) => ({
      label,
      complete,
      completed,
      remaining: total - completed,
      total,
    })),
    nextMissing: currentSnapshot.missing.slice(0, 6),
    warnings: currentSnapshot.warnings,
    readyToCreate: currentSnapshot.readyToCreate,
  };
  const tools = createPolicyTools(previousSnapshot?.draft);
  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-3.5-flash-lite"),
    system: `${OPENUI_PROMPT}\n${POLICY_INSTRUCTIONS}\nCURRENT POLICY STATE:\n${JSON.stringify(promptState)}`,
    messages: await convertToModelMessages(compactConversation(payload.messages)),
    tools,
    maxOutputTokens: 700,
    maxRetries: 1,
    stopWhen: stepCountIs(2),
    abortSignal: req.signal,
  });

  // Preserve the AI SDK's native UIMessage stream. The frontend adapter uses
  // the AI SDK itself to decode it before mapping chunks into OpenUI events.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
