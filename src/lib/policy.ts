import { z } from "zod";

export const policyDraftSchema = z.object({
  identity: z.object({
    agentName: z.string().trim().min(2).optional(),
    purpose: z.string().trim().min(10).optional(),
    agentType: z.enum(["assistant", "automation", "autonomous"]).optional(),
    environment: z.enum(["development", "staging", "production"]).optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  }).default({}),
  ownership: z.object({
    businessOwner: z.string().trim().min(2).optional(),
    technicalOwner: z.string().trim().min(2).optional(),
    securityReviewer: z.string().trim().min(2).optional(),
    escalationContact: z.string().trim().min(2).optional(),
  }).default({}),
  authentication: z.object({
    mechanism: z.enum(["workload_identity", "oauth2", "service_account", "api_key"]).optional(),
    identityProvider: z.string().trim().min(2).optional(),
    secretStore: z.string().trim().min(2).optional(),
    tokenLifetimeMinutes: z.number().int().positive().max(1440).optional(),
    rotationDays: z.number().int().positive().max(365).optional(),
  }).default({}),
  permissions: z.object({
    systems: z.array(z.string().trim().min(1)).max(20).optional(),
    actions: z.array(z.enum(["read", "write", "delete", "admin"])).max(4).optional(),
    prohibitedActions: z.array(z.string().trim().min(2)).max(20).optional(),
    humanApproval: z.enum(["never", "high_risk_only", "always"]).optional(),
  }).default({}),
  dataHandling: z.object({
    classifications: z.array(z.enum(["public", "internal", "confidential", "restricted"])).max(4).optional(),
    processesPii: z.boolean().optional(),
    residency: z.string().trim().min(2).optional(),
    retentionDays: z.number().int().nonnegative().max(3650).optional(),
    redactSensitiveLogs: z.boolean().optional(),
  }).default({}),
  guardrails: z.object({
    rateLimitPerHour: z.number().int().positive().max(100000).optional(),
    transactionLimit: z.number().nonnegative().optional(),
    emergencyShutdown: z.string().trim().min(5).optional(),
    productionApprovalRequired: z.boolean().optional(),
  }).default({}),
  monitoring: z.object({
    auditLogging: z.boolean().optional(),
    alertChannel: z.string().trim().min(2).optional(),
    reviewFrequencyDays: z.number().int().positive().max(365).optional(),
    expiresAt: z.string().date().optional(),
  }).default({}),
  confirmed: z.boolean().default(false),
  createdPolicyId: z.string().optional(),
});

export const policyUpdateSchema = policyDraftSchema
  .omit({ confirmed: true, createdPolicyId: true })
  .partial();

export type PolicyDraft = z.infer<typeof policyDraftSchema>;
export type PolicyUpdate = z.infer<typeof policyUpdateSchema>;
export type PolicySectionStatus = { id: string; label: string; complete: boolean; completed: number; total: number };
export type PolicySnapshot = {
  kind: "policy_snapshot";
  draft: PolicyDraft;
  progress: number;
  sections: PolicySectionStatus[];
  missing: string[];
  warnings: string[];
  readyToCreate: boolean;
  lastAction: string;
};

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;
const isSet = (value: unknown) => value !== undefined && value !== null;
type Requirement = { label: string; met: boolean };

function section(id: string, label: string, requirements: Requirement[]) {
  const completed = requirements.filter((item) => item.met).length;
  return {
    status: { id, label, complete: completed === requirements.length, completed, total: requirements.length },
    missing: requirements.filter((item) => !item.met).map((item) => item.label),
  };
}

export function createEmptyPolicy(): PolicyDraft {
  return policyDraftSchema.parse({});
}

export function mergePolicyUpdate(draft: PolicyDraft, update: PolicyUpdate): PolicyDraft {
  return policyDraftSchema.parse({
    ...draft,
    identity: { ...draft.identity, ...update.identity },
    ownership: { ...draft.ownership, ...update.ownership },
    authentication: { ...draft.authentication, ...update.authentication },
    permissions: { ...draft.permissions, ...update.permissions },
    dataHandling: { ...draft.dataHandling, ...update.dataHandling },
    guardrails: { ...draft.guardrails, ...update.guardrails },
    monitoring: { ...draft.monitoring, ...update.monitoring },
  });
}

export function calculatePolicySnapshot(draftInput: PolicyDraft, lastAction = "Draft initialized"): PolicySnapshot {
  const draft = policyDraftSchema.parse(draftInput);
  const elevatedAccess = draft.permissions.actions?.some((action) => ["write", "delete", "admin"].includes(action));
  const production = draft.identity.environment === "production";
  const sensitiveData = draft.dataHandling.classifications?.some((value) => ["confidential", "restricted"].includes(value));
  const results = [
    section("identity", "Identity", [
      { label: "Agent name", met: hasText(draft.identity.agentName) },
      { label: "Business purpose", met: hasText(draft.identity.purpose) },
      { label: "Agent type", met: isSet(draft.identity.agentType) },
      { label: "Environment", met: isSet(draft.identity.environment) },
      { label: "Risk level", met: isSet(draft.identity.riskLevel) },
    ]),
    section("ownership", "Ownership", [
      { label: "Business owner", met: hasText(draft.ownership.businessOwner) },
      { label: "Technical owner", met: hasText(draft.ownership.technicalOwner) },
      { label: "Security reviewer", met: hasText(draft.ownership.securityReviewer) },
      { label: "Escalation contact", met: hasText(draft.ownership.escalationContact) },
    ]),
    section("authentication", "Authentication", [
      { label: "Authentication mechanism", met: isSet(draft.authentication.mechanism) },
      { label: "Identity provider", met: hasText(draft.authentication.identityProvider) },
      { label: "Secret store", met: hasText(draft.authentication.secretStore) },
      { label: "Token lifetime", met: isSet(draft.authentication.tokenLifetimeMinutes) },
      { label: "Credential rotation", met: isSet(draft.authentication.rotationDays) },
    ]),
    section("permissions", "Permissions", [
      { label: "Allowed systems", met: hasItems(draft.permissions.systems) },
      { label: "Allowed actions", met: hasItems(draft.permissions.actions) },
      { label: "Prohibited actions", met: hasItems(draft.permissions.prohibitedActions) },
      { label: "Human approval rule", met: isSet(draft.permissions.humanApproval) },
    ]),
    section("data", "Data handling", [
      { label: "Data classifications", met: hasItems(draft.dataHandling.classifications) },
      { label: "PII decision", met: isSet(draft.dataHandling.processesPii) },
      { label: "Data residency", met: hasText(draft.dataHandling.residency) },
      { label: "Retention period", met: isSet(draft.dataHandling.retentionDays) },
      { label: "Log redaction decision", met: isSet(draft.dataHandling.redactSensitiveLogs) },
    ]),
    section("guardrails", "Guardrails", [
      { label: "Rate limit", met: isSet(draft.guardrails.rateLimitPerHour) },
      { label: "Emergency shutdown procedure", met: hasText(draft.guardrails.emergencyShutdown) },
      ...(production
        ? [{ label: "Production approval decision", met: isSet(draft.guardrails.productionApprovalRequired) }]
        : []),
    ]),
    section("monitoring", "Monitoring & lifecycle", [
      { label: "Audit logging decision", met: isSet(draft.monitoring.auditLogging) },
      { label: "Alert channel", met: hasText(draft.monitoring.alertChannel) },
      { label: "Review frequency", met: isSet(draft.monitoring.reviewFrequencyDays) },
      { label: "Policy expiration", met: hasText(draft.monitoring.expiresAt) },
    ]),
  ];
  const completed = results.reduce((sum, result) => sum + result.status.completed, 0);
  const total = results.reduce((sum, result) => sum + result.status.total, 0);
  const warnings: string[] = [];
  if (production && elevatedAccess && draft.permissions.humanApproval === "never") warnings.push("Production write, delete, or admin access requires human approval.");
  if (sensitiveData && draft.dataHandling.redactSensitiveLogs === false) warnings.push("Sensitive data must be redacted from logs.");
  if (draft.dataHandling.processesPii && !hasText(draft.dataHandling.residency)) warnings.push("Data residency is required when the agent processes PII.");
  if (production && draft.monitoring.auditLogging === false) warnings.push("Production agents must have audit logging enabled.");
  const missing = results.flatMap((result) => result.missing);
  return {
    kind: "policy_snapshot",
    draft,
    progress: Math.round((completed / total) * 100),
    sections: results.map((result) => result.status),
    missing,
    warnings,
    readyToCreate: missing.length === 0 && warnings.length === 0,
    lastAction,
  };
}

export function findLatestPolicySnapshot(value: unknown): PolicySnapshot | null {
  let latest: PolicySnapshot | null = null;
  const seen = new WeakSet<object>();
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    const record = candidate as Record<string, unknown>;
    if (record.kind === "policy_snapshot") {
      const parsed = policyDraftSchema.safeParse(record.draft);
      if (parsed.success) latest = calculatePolicySnapshot(parsed.data, typeof record.lastAction === "string" ? record.lastAction : "Draft updated");
    }
    if (record.role === "tool" && typeof record.content === "string") {
      try {
        visit(JSON.parse(record.content));
      } catch {
        // Non-JSON tool output cannot contain a policy snapshot.
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return latest;
}
