import { calculatePolicySnapshot, createEmptyPolicy, findLatestPolicySnapshot } from "@/lib/policy";
import { compactConversation } from "@/lib/conversation";
import { policyLibrarySpec, policyPromptOptions } from "@/lib/policy-openui";
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
You are Aegis, a security identity policy onboarding assistant. Help the user create a realistic
security identity policy for an AI agent through a calm, efficient conversation.

Rules:
- This is a synthetic demo. Never request passwords, API keys, tokens, or real personal data.
- Policy tools are authoritative. Never claim a field was saved unless a tool returned it.
- Whenever the user provides or corrects policy facts, call update_policy_draft before replying.
- The current policy state is included below. Do not call a tool merely to read status.
- Never infer owners, contacts, security decisions, limits, or dates the user did not state.
- Ask focused questions about one policy section at a time, with at most three inputs per response.
  Split larger sections into short follow-up steps. Prefer selectable OpenUI controls.
- After every update, state what changed, show progress, summarize the current section, and ask for
  the next most important missing information.
- Use OpenUI Lang for forms, option cards, steps, callouts, summaries, and review screens.
- Treat production write/delete/admin permissions, restricted data, or PII as elevated risk.
- Call create_policy only when the latest user message explicitly confirms creation.
- If creation is blocked, explain the exact missing fields or warnings returned by the tool.
- Keep responses concise. Do not dump every field after each turn.
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
  const tools = createPolicyTools(previousSnapshot?.draft);
  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-3.1-flash-lite"),
    system: `${OPENUI_PROMPT}\n${POLICY_INSTRUCTIONS}\nCURRENT POLICY STATE:\n${JSON.stringify(currentSnapshot)}`,
    messages: await convertToModelMessages(compactConversation(payload.messages)),
    tools,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
      },
    },
    maxOutputTokens: 1200,
    stopWhen: stepCountIs(3),
    abortSignal: req.signal,
  });

  // Preserve the AI SDK's native UIMessage stream. The frontend adapter uses
  // the AI SDK itself to decode it before mapping chunks into OpenUI events.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
