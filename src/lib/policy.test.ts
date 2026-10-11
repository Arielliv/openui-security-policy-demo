import { describe, expect, it } from "vitest";
import {
  calculatePolicySnapshot,
  calculateSimulatedToolRisk,
  createEmptyPolicy,
  findLatestPolicySnapshot,
  mergePolicyUpdate,
  type PolicyDraft,
} from "./policy";

function completePolicy(): PolicyDraft {
  return {
    identity: {
      agentName: "Sentinel Responder",
      purpose: "Disable compromised workforce accounts after a confirmed security incident.",
      agentType: "automation",
      environment: "production",
      riskLevel: "high",
    },
    ownership: {
      businessOwner: "Security Operations",
      technicalOwner: "Identity Engineering",
      securityReviewer: "Security Architecture",
      escalationContact: "SOC on-call",
    },
    runtime: {
      provider: "gcp_vertex_ai",
      accountOrProject: "acme-security-prod",
      modelDeployment: "sentinel-responder-v3",
      region: "europe-west4",
    },
    mcp: {
      serverId: "entra-id",
      selectedTools: ["lookup_user", "revoke_sessions"],
      toolPolicies: [
        { serverId: "entra-id", tool: "lookup_user", decision: "allow" },
        { serverId: "entra-id", tool: "revoke_sessions", decision: "flag" },
      ],
      defaultDecision: "deny",
      humanApproval: "flagged_only",
    },
    dataHandling: {
      classifications: ["internal", "confidential"],
      processesPii: true,
      residency: "EU",
      retentionDays: 30,
      redactSensitiveLogs: true,
    },
    guardrails: {
      rateLimitPerHour: 100,
      emergencyShutdown: "Disable the workload identity and page the SOC on-call.",
      productionApprovalRequired: true,
    },
    monitoring: {
      auditLogging: true,
      alertChannel: "SOC alerts",
      reviewFrequencyDays: 90,
      expiresAt: "2027-12-31",
    },
    confirmed: false,
  };
}

describe("policy progress", () => {
  it("starts empty with every section visible", () => {
    const snapshot = calculatePolicySnapshot(createEmptyPolicy());
    expect(snapshot.progress).toBe(0);
    expect(snapshot.sections).toHaveLength(4);
    expect(snapshot.readyToCreate).toBe(false);
  });

  it("deep-merges a focused agent update", () => {
    const draft = mergePolicyUpdate(createEmptyPolicy(), {
      identity: { agentName: "Sentinel", purpose: "Respond to compromised workforce accounts." },
    });
    const updated = mergePolicyUpdate(draft, { identity: { environment: "production" } });
    expect(updated.identity.agentName).toBe("Sentinel");
    expect(updated.identity.environment).toBe("production");
  });

  it("blocks unsafe production MCP access", () => {
    const draft = completePolicy();
    draft.mcp.defaultDecision = "allow";
    draft.mcp.humanApproval = "never";
    const snapshot = calculatePolicySnapshot(draft);
    expect(snapshot.warnings).toContain("Production MCP access should require approval for at least flagged tools.");
    expect(snapshot.readyToCreate).toBe(false);
  });

  it("marks a complete warning-free policy ready", () => {
    const snapshot = calculatePolicySnapshot(completePolicy());
    expect(snapshot.progress).toBe(100);
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.readyToCreate).toBe(true);
  });

  it("derives clearly bounded demo risk scores from tool context", () => {
    const risks = calculateSimulatedToolRisk(completePolicy());
    expect(risks).toEqual([
      { tool: "lookup_user", score: 62, level: "medium" },
      { tool: "revoke_sessions", score: 84, level: "high" },
    ]);
    expect(risks.every(({ score }) => score >= 5 && score <= 95)).toBe(true);
  });

  it("recovers a validated snapshot from an OpenUI tool message", () => {
    const expected = calculatePolicySnapshot(completePolicy(), "Policy draft updated");
    expect(findLatestPolicySnapshot([
      { role: "user", content: JSON.stringify(expected) },
    ])).toBeNull();

    const recovered = findLatestPolicySnapshot([
      { role: "user", content: JSON.stringify(expected) },
      { role: "tool", content: JSON.stringify(expected), toolCallId: "call-1" },
    ]);

    expect(recovered?.progress).toBe(100);
    expect(recovered?.draft.identity.agentName).toBe("Sentinel Responder");
  });
});
