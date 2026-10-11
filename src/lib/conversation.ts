import type { UIMessage } from "ai";

const OPENUI_CONTEXT_MARKER = "]]>openui:context";

function collectFormValues(candidate: unknown, path: string[] = [], values: Record<string, unknown> = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return values;

  const record = candidate as Record<string, unknown>;
  if ("value" in record) {
    const value = record.value;
    if (value !== undefined && value !== null && value !== "") {
      values[path.at(-1) ?? "value"] = value;
    }
    return values;
  }

  for (const [key, value] of Object.entries(record)) {
    collectFormValues(value, [...path, key], values);
  }
  return values;
}

export function extractSubmittedFormValues(text: string) {
  const markerIndex = text.lastIndexOf(OPENUI_CONTEXT_MARKER);
  if (markerIndex < 0) return {};

  try {
    const context = JSON.parse(text.slice(markerIndex + OPENUI_CONTEXT_MARKER.length).trim()) as unknown;
    const candidates = Array.isArray(context) ? context : [context];
    const values = candidates.reduce<Record<string, unknown>>(
      (result, candidate) => collectFormValues(candidate, [], result),
      {},
    );
    return values;
  } catch {
    return {};
  }
}

export function extractOpenUIHumanText(text: string) {
  const markerIndex = text.lastIndexOf(OPENUI_CONTEXT_MARKER);
  const content = markerIndex < 0 ? text : text.slice(0, markerIndex);
  return content.replace(/^\]\]>openui:content\s*/, "").trim();
}

export function appendSubmittedFormValues(text: string) {
  const values = extractSubmittedFormValues(text);
  if (Object.keys(values).length === 0) return text;
  return `${text}\n\nSUBMITTED OPENUI FORM VALUES:\n${JSON.stringify(values)}`;
}

export function compactConversation(messages: UIMessage[]) {
  return messages
    .slice(-6)
    .map((message) => ({
      ...message,
      parts: message.role === "user"
        ? message.parts.map((part) => part.type === "text"
          ? { ...part, text: appendSubmittedFormValues(part.text) }
          : part)
        : message.parts.filter((part) => part.type === "text"),
    }))
    .filter((message) => message.parts.length > 0);
}
