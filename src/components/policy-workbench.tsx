"use client";

import { useThread } from "@openuidev/react-headless";
import { useEffect, useState } from "react";
import {
  calculatePolicySnapshot,
  createEmptyPolicy,
  findLatestPolicySnapshot,
  connectedMcpCatalog,
  type PolicyDraft,
  type PolicySnapshot,
} from "@/lib/policy";

const initialSnapshot = calculatePolicySnapshot(createEmptyPolicy());
const activityStages = [
  "Reading your response",
  "Checking policy requirements",
  "Preparing the next step",
];

function usePolicySnapshot() {
  const messages = useThread((state) => state.messages);
  return findLatestPolicySnapshot(messages) ?? initialSnapshot;
}

function useAgentActivity() {
  const isRunning = useThread((state) => state.isRunning);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      setStage((current) => (current + 1) % activityStages.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  return { isRunning, label: activityStages[stage] };
}

function downloadPolicy(draft: PolicyDraft) {
  const file = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${draft.createdPolicyId ?? "ai-security-policy-draft"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function titleCase(value?: string) {
  if (!value) return "Not defined";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SummaryContent({ snapshot, compact = false }: { snapshot: PolicySnapshot; compact?: boolean }) {
  const { draft } = snapshot;
  const groups = [
    {
      title: "Agent identity",
      rows: [
        ["Name", draft.identity.agentName],
        ["Purpose", draft.identity.purpose],
        ["Type", titleCase(draft.identity.agentType)],
        ["Environment", titleCase(draft.identity.environment)],
        ["Risk", titleCase(draft.identity.riskLevel)],
      ],
    },
    {
      title: "Ownership",
      rows: [
        ["Business", draft.ownership.businessOwner],
        ["Technical", draft.ownership.technicalOwner],
        ["Security", draft.ownership.securityReviewer],
        ["Escalation", draft.ownership.escalationContact],
      ],
    },
    {
      title: "AI runtime",
      rows: [
        ["Provider", titleCase(draft.runtime.provider)],
        ["Account / project", draft.runtime.accountOrProject],
        ["Deployment", draft.runtime.modelDeployment],
        ["Region", draft.runtime.region],
      ],
    },
    {
      title: "MCP access",
      rows: [
        ["Connected server", connectedMcpCatalog.find((server) => server.id === draft.mcp.serverId)?.label ?? draft.mcp.serverId],
        ["Selected tools", draft.mcp.selectedTools?.join(", ")],
        ["Tool decisions", draft.mcp.toolPolicies?.map((item) => `${item.tool}: ${titleCase(item.decision)}`).join(", ")],
        ["Default action", titleCase(draft.mcp.defaultDecision)],
        ["Human approval", titleCase(draft.mcp.humanApproval)],
        ["Data", draft.dataHandling.classifications?.map(titleCase).join(", ")],
      ],
    },
    {
      title: "Guardrails & data",
      rows: [
        ["PII", draft.dataHandling.processesPii === undefined ? undefined : draft.dataHandling.processesPii ? "Processed" : "Not processed"],
        ["Residency", draft.dataHandling.residency],
        ["Retention", draft.dataHandling.retentionDays === undefined ? undefined : `${draft.dataHandling.retentionDays} days`],
        ["Rate limit", draft.guardrails.rateLimitPerHour === undefined ? undefined : `${draft.guardrails.rateLimitPerHour}/hour`],
        ["Shutdown", draft.guardrails.emergencyShutdown],
      ],
    },
    {
      title: "Governance",
      rows: [
        ["Audit logs", draft.monitoring.auditLogging === undefined ? undefined : draft.monitoring.auditLogging ? "Enabled" : "Disabled"],
        ["Review cycle", draft.monitoring.reviewFrequencyDays ? `Every ${draft.monitoring.reviewFrequencyDays} days` : undefined],
        ["Expires", draft.monitoring.expiresAt],
        ["Alert channel", draft.monitoring.alertChannel],
      ],
    },
  ];

  return (
    <div className={compact ? "policy-summary-content compact" : "policy-summary-content"}>
      {groups.map((group) => {
        const definedRows = group.rows.filter(([, value]) => value && value !== "Not defined");
        if (compact && definedRows.length === 0) return null;
        return (
          <section className="policy-summary-group" key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {(compact ? definedRows : group.rows).map(([label, value]) => (
                <div key={label} className={value && value !== "Not defined" ? "is-defined" : ""}>
                  <dt>{label}</dt>
                  <dd>{value || "Not defined"}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {compact && groups.every((group) => group.rows.every(([, value]) => !value || value === "Not defined")) && (
        <p className="policy-empty-summary">Your confirmed answers will appear here as the conversation progresses.</p>
      )}
    </div>
  );
}

export function PolicyProgressPanel() {
  const snapshot = usePolicySnapshot();
  const activity = useAgentActivity();
  const nextMissing = snapshot.missing.slice(0, 4);
  const activeSection = snapshot.sections.find((section) => !section.complete);

  return (
    <div className="policy-progress-panel" aria-live="polite">
      <section className={`policy-progress-hero ${activity.isRunning ? "is-processing" : ""}`}>
        <div
          className="policy-progress-ring"
          style={{ "--policy-progress": `${snapshot.progress * 3.6}deg` } as React.CSSProperties}
          role="progressbar"
          aria-valuenow={snapshot.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Policy completion"
        >
          <div><strong>{snapshot.progress}%</strong><span>complete</span></div>
        </div>
        <div className="policy-stage-copy">
          <span className="policy-kicker">Current stage</span>
          <h2>{snapshot.readyToCreate ? "Ready for review" : activeSection?.label ?? "Final review"}</h2>
          <p className={activity.isRunning ? "policy-activity-label" : ""}>
            {activity.isRunning && <span className="policy-activity-dot" aria-hidden="true" />}
            {activity.isRunning ? activity.label : snapshot.lastAction}
          </p>
          {activity.isRunning && <div className="policy-activity-track" aria-hidden="true"><i /></div>}
        </div>
      </section>

      <section className="policy-workbench-section">
        <div className="policy-section-heading"><h2>Policy progress</h2><span>{snapshot.sections.filter((item) => item.complete).length} of {snapshot.sections.length} sections</span></div>
        <div className="policy-stage-list">
          {snapshot.sections.map((item, index) => (
            <div className={`policy-stage-row ${item.complete ? "complete" : ""} ${item.id === activeSection?.id ? "active" : ""}`} key={item.id}>
              <span className="policy-stage-number">{item.complete ? "✓" : index + 1}</span>
              <div><strong>{item.label}</strong><small>{item.completed} of {item.total} requirements</small></div>
              <span className="policy-stage-bar"><i style={{ width: `${(item.completed / item.total) * 100}%` }} /></span>
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

      {!snapshot.readyToCreate && nextMissing.length > 0 && (
        <section className="policy-workbench-section policy-next-section">
          <div className="policy-section-heading"><h2>Coming up</h2><span>{snapshot.missing.length} remaining</span></div>
          <ul>{nextMissing.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      <section className="policy-mobile-summary">
        <div className="policy-section-heading"><h2>Captured data</h2><span>Live</span></div>
        <SummaryContent snapshot={snapshot} compact />
      </section>
    </div>
  );
}

export function PolicySummaryPanel() {
  const snapshot = usePolicySnapshot();
  const activity = useAgentActivity();
  const draftName = snapshot.draft.identity.agentName ?? "Untitled agent";

  return (
    <aside className="policy-summary-rail" aria-label="Current policy summary" aria-live="polite">
      <header className="policy-summary-header">
        <div>
          <span className="policy-kicker">Policy draft</span>
          <h2>{draftName}</h2>
        </div>
        <span className={activity.isRunning ? "policy-status working" : snapshot.readyToCreate ? "policy-status ready" : "policy-status"}>
          <i /> {activity.isRunning ? "AI working" : snapshot.readyToCreate ? "Ready" : "In progress"}
        </span>
      </header>
      <div className="policy-summary-scroll">
        <SummaryContent snapshot={snapshot} />
      </div>
      <footer className="policy-summary-footer">
        <button className="policy-export-button" onClick={() => downloadPolicy(snapshot.draft)}>Export current JSON</button>
        <p>Synthetic demo data only. Never enter credentials or real personal data.</p>
      </footer>
    </aside>
  );
}
