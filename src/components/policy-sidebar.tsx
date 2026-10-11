"use client";

import { useThread } from "@openuidev/react-headless";
import {
  calculatePolicySnapshot,
  createEmptyPolicy,
  findLatestPolicySnapshot,
  type PolicyDraft,
} from "@/lib/policy";

const initialSnapshot = calculatePolicySnapshot(createEmptyPolicy());

function downloadPolicy(draft: PolicyDraft) {
  const file = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${draft.createdPolicyId ?? "ai-security-policy-draft"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PolicySidebar() {
  const messages = useThread((state) => state.messages);
  const snapshot = findLatestPolicySnapshot(messages) ?? initialSnapshot;
  const nextMissing = snapshot.missing.slice(0, 3);
  const { draft } = snapshot;

  return (
    <div className="policy-sidebar" aria-live="polite">
      <section className="policy-progress-card">
        <div className="policy-eyebrow">
          <span className="policy-live-dot" /> Live policy draft
        </div>
        <div className="policy-progress-heading">
          <strong>{snapshot.progress}%</strong>
          <span>{snapshot.readyToCreate ? "Ready to create" : "Complete"}</span>
        </div>
        <div
          className="policy-progress-track"
          role="progressbar"
          aria-valuenow={snapshot.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Policy completion"
        >
          <span style={{ width: `${snapshot.progress}%` }} />
        </div>
        <p className="policy-last-action">{snapshot.lastAction}</p>
      </section>

      <section className="policy-sidebar-section">
        <h2>Sections</h2>
        <div className="policy-section-list">
          {snapshot.sections.map((item) => (
            <div className="policy-section-row" key={item.id}>
              <span className={item.complete ? "policy-check complete" : "policy-check"}>
                {item.complete ? "✓" : item.completed}
              </span>
              <span>{item.label}</span>
              <small>{item.completed}/{item.total}</small>
            </div>
          ))}
        </div>
      </section>

      {snapshot.warnings.length > 0 && (
        <section className="policy-warning-card">
          <div className="policy-warning-title">Needs attention</div>
          {snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </section>
      )}

      <section className="policy-sidebar-section">
        <h2>Current summary</h2>
        <dl className="policy-summary-list">
          <div><dt>Agent</dt><dd>{draft.identity.agentName ?? "Not named"}</dd></div>
          <div><dt>Environment</dt><dd>{draft.identity.environment ?? "Not selected"}</dd></div>
          <div><dt>Risk</dt><dd>{draft.identity.riskLevel ?? "Not assessed"}</dd></div>
          <div><dt>Systems</dt><dd>{draft.permissions.systems?.join(", ") ?? "None yet"}</dd></div>
        </dl>
      </section>

      {!snapshot.readyToCreate && nextMissing.length > 0 && (
        <section className="policy-sidebar-section">
          <h2>Up next</h2>
          <ul className="policy-missing-list">
            {nextMissing.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {snapshot.missing.length > nextMissing.length && (
            <p className="policy-more-missing">+{snapshot.missing.length - nextMissing.length} more requirements</p>
          )}
        </section>
      )}

      <button className="policy-export-button" onClick={() => downloadPolicy(draft)}>
        Export current JSON
      </button>
      <p className="policy-demo-note">Synthetic demo data only. Do not enter credentials or real personal data.</p>
    </div>
  );
}
