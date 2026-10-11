"use client";

import { extractOpenUIHumanText, extractSubmittedFormValues } from "@/lib/conversation";
import type { UserMessageComponent } from "@openuidev/react-ui";

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function displayLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export const PolicyUserMessage: UserMessageComponent = ({ message }) => {
  const content = typeof message.content === "string" ? message.content : "";
  const submittedValues = extractSubmittedFormValues(content);
  const entries = Object.entries(submittedValues);

  return (
    <div className="openui-shell-thread-message-user">
      {entries.length > 0 ? (
        <div className="policy-submission-message">
          <div className="policy-submission-heading"><span aria-hidden="true">✓</span> Submitted form values</div>
          <dl>
            {entries.map(([label, value]) => (
              <div key={label}>
                <dt>{displayLabel(label)}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="policy-plain-user-message">{extractOpenUIHumanText(content)}</div>
      )}
    </div>
  );
};
