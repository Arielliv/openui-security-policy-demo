import librarySpec from "@/generated/spec.json";
import { connectedMcpCatalog } from "@/lib/policy";

const POLICY_COMPONENTS = new Set([
  "Stack",
  "Card",
  "CardHeader",
  "TextContent",
  "TextCallout",
  "Form",
  "FormControl",
  "Label",
  "Input",
  "TextArea",
  "Select",
  "SelectItem",
  "DatePicker",
  "CheckBoxGroup",
  "CheckBoxItem",
  "RadioGroup",
  "RadioItem",
  "SwitchGroup",
  "SwitchItem",
  "Button",
  "Buttons",
  "Steps",
  "StepsItem",
  "TagBlock",
  "Tag",
]);

export const policyLibrarySpec = {
  ...librarySpec,
  components: Object.fromEntries(
    Object.entries(librarySpec.components).filter(([name]) => POLICY_COMPONENTS.has(name)),
  ),
  componentGroups: librarySpec.componentGroups
    .map((group) => ({
      ...group,
      components: group.components.filter((name) => POLICY_COMPONENTS.has(name)),
    }))
    .filter((group) => group.components.length > 0),
};

export const policyPromptOptions = {
  additionalRules: [
    "Keep each response compact: render one focused card or form, not a dashboard.",
    "Ask for no more than three inputs per response; split longer sections into follow-up steps.",
    "Prefer radio, checkbox, select, and switch controls over free text when possible.",
    "Every form must have a clear submit button that sends its values with @ToAssistant.",
    "Use a short static human-friendly message in @ToAssistant. Never concatenate form variables into that message; the complete form state is attached automatically.",
    "Start streaming the heading and first control before defining the rest of the form.",
    "For AI provider selection, use only GCP Vertex AI, Azure AI Studio, AWS Bedrock, or OpenAI Enterprise.",
    "For MCP selection, use only the connected demo servers and tools listed in the assistant instructions.",
    "When asking about MCP tools, capture a decision for every selected tool: allow, deny, flag, or log.",
    "Use a review card after each MCP tool decision so the user can see the exact server, tool, and action recorded.",
    "Never rely on RadioGroup defaultValue for a policy fact: untouched radio defaults are only visual in the current OpenUI runtime and may not be submitted. Use a Select without a preselected value, or require an explicit user choice.",
    "Never treat a placeholder, first option, or helper text as a submitted value. Every policy fact must be present in the submitted form state or remain visibly incomplete.",
  ],
};

export const connectedMcpPrompt = connectedMcpCatalog
  .map((server) => `- ${server.id} (${server.label}): ${server.tools.join(", ")}`)
  .join("\n");
