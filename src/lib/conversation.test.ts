import { describe, expect, it } from "vitest";
import { appendSubmittedFormValues, compactConversation, extractOpenUIHumanText, extractSubmittedFormValues } from "./conversation";

const submittedMessage = `]]>openui:content
Save identity details
]]>openui:context
["User clicked: Save identity details",{"identity":{"agentName":{"value":"Aegis Responder"},"agentType":{"value":"automation"},"riskLevel":{"value":"high"}}}]`;

describe("conversation compaction", () => {
  it("makes submitted OpenUI values explicit for the model", () => {
    const enriched = appendSubmittedFormValues(submittedMessage);
    expect(enriched).toContain('"agentName":"Aegis Responder"');
    expect(enriched).toContain('"agentType":"automation"');
    expect(enriched).toContain('"riskLevel":"high"');
  });

  it("separates the visible action label from actual submitted values", () => {
    expect(extractOpenUIHumanText(submittedMessage)).toBe("Save identity details");
    expect(extractSubmittedFormValues(submittedMessage)).toEqual({
      agentName: "Aegis Responder",
      agentType: "automation",
      riskLevel: "high",
    });
  });

  it("keeps user form context while removing historical assistant tool payloads", () => {
    const messages = compactConversation([
      { id: "user-1", role: "user", parts: [{ type: "text", text: submittedMessage }] },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "text", text: "root = TextContent(\"Saved\")" },
          { type: "dynamic-tool", toolName: "update_policy_draft", toolCallId: "call-1", state: "output-available", input: {}, output: {} },
        ],
      },
    ]);

    expect(messages[0]?.parts[0]).toMatchObject({ type: "text" });
    expect((messages[0]?.parts[0] as { text: string }).text).toContain("Aegis Responder");
    expect(messages[1]?.parts).toHaveLength(1);
  });
});
