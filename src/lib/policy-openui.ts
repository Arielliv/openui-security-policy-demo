import librarySpec from "@/generated/spec.json";

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
    "Start streaming the heading and first control before defining the rest of the form.",
  ],
};
