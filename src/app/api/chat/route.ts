import librarySpec from "@/generated/spec.json";
import { findLatestPolicySnapshot } from "@/lib/policy";
import { promptOptions } from "@/lib/prompt-options";
import { createPolicyTools } from "@/lib/tools/policy-tools";
import { createOpenAI } from "@ai-sdk/openai";
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

const provider = createOpenAI({
  baseURL:
    process.env.GEMINI_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY,
});

const POLICY_INSTRUCTIONS = `
You are Aegis, a security identity policy onboarding assistant. Help the user create a realistic
security identity policy for an AI agent through a calm, efficient conversation.

Rules:
- This is a synthetic demo. Never request passwords, API keys, tokens, or real personal data.
- Policy tools are authoritative. Never claim a field was saved unless a tool returned it.
- Whenever the user provides or corrects policy facts, call update_policy_draft before replying.
- Never infer owners, contacts, security decisions, limits, or dates the user did not state.
- Ask focused questions about one policy section at a time. Prefer selectable OpenUI controls.
- After every update, state what changed, show progress, summarize the current section, and ask for
  the next most important missing information.
- Use OpenUI Lang for forms, option cards, steps, callouts, summaries, and review screens.
- Treat production write/delete/admin permissions, restricted data, or PII as elevated risk.
- Call create_policy only when the latest user message explicitly confirms creation.
- If creation is blocked, explain the exact missing fields or warnings returned by the tool.
- Keep responses concise. Do not dump every field after each turn.
`;

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
  const tools = createPolicyTools(previousSnapshot?.draft);
  const result = streamText({
    model: provider.chat(process.env.GEMINI_MODEL ?? process.env.OPENAI_MODEL ?? "gemini-3.8-flash"),
    system: `${generateSystemPrompt({ library: librarySpec, promptOptions })}\n${POLICY_INSTRUCTIONS}`,
    messages: await convertToModelMessages(payload.messages),
    tools,
    stopWhen: stepCountIs(6),
    abortSignal: req.signal,
  });

  // Preserve the AI SDK's native UIMessage stream. The frontend adapter uses
  // the AI SDK itself to decode it before mapping chunks into OpenUI events.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
