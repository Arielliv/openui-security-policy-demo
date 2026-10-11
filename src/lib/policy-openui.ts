import librarySpec from "@/generated/spec.json";
import { connectedMcpCatalog } from "@/lib/policy";

const POLICY_COMPONENTS = new Set([
  "Stack",
  "Card",
  "CardHeader",
  "TextContent",
  "Form",
  "FormControl",
  "Label",
  "Input",
  "TextArea",
  "Select",
  "SelectItem",
  "CheckBoxGroup",
  "CheckBoxItem",
  "RadioGroup",
  "RadioItem",
  "SwitchGroup",
  "SwitchItem",
  "Button",
  "Buttons",
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
    "Ask for no more than four inputs per response; split only when the decision genuinely changes context.",
    "Prefer radio, checkbox, select, and switch controls over free text when possible.",
    "For this demo, never add validation rules to OpenUI controls. Keep forms permissive and let the policy tool validate submitted values.",
    "Every form must have a clear submit button that sends its values with @ToAssistant.",
    "Use a short static human-friendly message in @ToAssistant. Never concatenate form variables into that message; the complete form state is attached automatically.",
    "Start streaming the heading and first control immediately. Avoid decorative components and long explanatory text.",
    "Use Stack([children]) and Card([children]) with their default layout arguments. Do not emit positional align or justify arguments; in particular, never use stretch as a justify value.",
    "OpenUI Lang does not support named arguments. Never write placeholder =, rows =, rules =, value =, or similar assignments inside a component call.",
    "Use these exact positional forms for common controls: Input(name, placeholder), TextArea(name, placeholder, rows), Select(name, items, placeholder), RadioGroup(name, items), and FormControl(label, input, hint).",
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
