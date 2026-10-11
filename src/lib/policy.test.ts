import { describe, expect, it } from "vitest";
import {
  calculatePolicySnapshot,
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
    authentication: {
      mechanism: "workload_identity",
      identityProvider: "Example Workforce IAM",
      secretStore: "Example Secret Vault",
      tokenLifetimeMinutes: 15,
      rotationDays: 30,
    },
    permissions: {
      systems: ["Example Identity Provider"],
      actions: ["read", "write"],
      prohibitedActions: ["Delete users", "Grant administrator roles"],
      humanApproval: "high_risk_only",
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
    expect(snapshot.sections).toHaveLength(7);
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

  it("blocks unsafe production write access", () => {
    const draft = completePolicy();
    draft.permissions.humanApproval = "never";
    const snapshot = calculatePolicySnapshot(draft);
    expect(snapshot.warnings).toContain("Production write, delete, or admin access requires human approval.");
    expect(snapshot.readyToCreate).toBe(false);
  });

  it("marks a complete warning-free policy ready", () => {
    const snapshot = calculatePolicySnapshot(completePolicy());
    expect(snapshot.progress).toBe(100);
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.readyToCreate).toBe(true);
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
