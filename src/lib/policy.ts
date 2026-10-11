import { z } from "zod";

export const connectedMcpCatalog = [
  { id: "github-enterprise", label: "GitHub Enterprise", tools: ["read_repository", "create_issue", "merge_pull_request"] },
  { id: "jira-cloud", label: "Jira Cloud", tools: ["search_issues", "create_ticket", "transition_issue"] },
  { id: "pagerduty", label: "PagerDuty", tools: ["read_incident", "trigger_incident", "resolve_incident"] },
  { id: "entra-id", label: "Microsoft Entra ID", tools: ["lookup_user", "revoke_sessions", "reset_mfa"] },
  { id: "aws-data", label: "AWS Data Platform", tools: ["query_athena", "read_s3_object", "inspect_iam_role"] },
] as const;

const toolDecisionSchema = z.object({
  serverId: z.string().trim().min(1),
  tool: z.string().trim().min(1),
  decision: z.enum(["allow", "deny", "flag", "log"]),
});

export const policyDraftSchema = z.object({
  identity: z.object({
    agentName: z.string().trim().min(1).optional(),
    purpose: z.string().trim().min(1).optional(),
    agentType: z.enum(["assistant", "automation", "autonomous"]).optional(),
    environment: z.enum(["development", "staging", "production"]).optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  }).default({}),
  ownership: z.object({
    businessOwner: z.string().trim().min(1).optional(),
    technicalOwner: z.string().trim().min(1).optional(),
    securityReviewer: z.string().trim().min(1).optional(),
    escalationContact: z.string().trim().min(1).optional(),
  }).default({}),
  runtime: z.object({
    provider: z.enum(["gcp_vertex_ai", "azure_ai_studio", "aws_bedrock", "openai_enterprise"]).optional(),
    accountOrProject: z.string().trim().min(1).optional(),
    modelDeployment: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
  }).default({}),
  mcp: z.object({
    serverId: z.string().trim().min(1).optional(),
    selectedTools: z.array(z.string().trim().min(1)).max(20).optional(),
    toolPolicies: z.array(toolDecisionSchema).max(40).optional(),
    defaultDecision: z.enum(["allow", "deny", "flag", "log"]).optional(),
    humanApproval: z.enum(["never", "flagged_only", "always"]).optional(),
  }).default({}),
  dataHandling: z.object({
    classifications: z.array(z.enum(["public", "internal", "confidential", "restricted"])).max(4).optional(),
    processesPii: z.boolean().optional(),
    residency: z.string().trim().min(1).optional(),
    retentionDays: z.number().int().nonnegative().max(3650).optional(),
    redactSensitiveLogs: z.boolean().optional(),
  }).default({}),
  guardrails: z.object({
    rateLimitPerHour: z.number().int().positive().max(100000).optional(),
    transactionLimit: z.number().nonnegative().optional(),
    emergencyShutdown: z.string().trim().min(1).optional(),
    productionApprovalRequired: z.boolean().optional(),
  }).default({}),
  monitoring: z.object({
    auditLogging: z.boolean().optional(),
    alertChannel: z.string().trim().min(1).optional(),
    reviewFrequencyDays: z.number().int().positive().max(365).optional(),
    expiresAt: z.string().trim().min(4).optional(),
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

export type SimulatedToolRisk = { tool: string; score: number; level: "low" | "medium" | "high" };

/** Demo-only heuristic for illustrating how decision support could appear in chat. */
export function calculateSimulatedToolRisk(draft: PolicyDraft): SimulatedToolRisk[] {
  const elevatedActions = /create|merge|transition|trigger|resolve|revoke|reset|write|delete|admin/i;
  const sensitiveActions = /user|identity|session|mfa|iam|s3|data/i;

  return (draft.mcp.selectedTools ?? []).map((tool) => {
    const decision = draft.mcp.toolPolicies?.find(
      (policy) => policy.serverId === draft.mcp.serverId && policy.tool === tool,
    )?.decision;
    let score = 24;
    if (elevatedActions.test(tool)) score += 34;
    if (sensitiveActions.test(tool)) score += 18;
    if (draft.identity.environment === "production") score += 12;
    if (decision === "allow") score += 8;
    if (decision === "flag") score -= 4;
    if (decision === "log") score -= 8;
    if (decision === "deny") score -= 24;
    score = Math.max(5, Math.min(95, score));
    return { tool, score, level: score >= 70 ? "high" : score >= 40 ? "medium" : "low" };
  });
}

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
  const toolPolicies = [...(draft.mcp.toolPolicies ?? [])];
  for (const incoming of update.mcp?.toolPolicies ?? []) {
    const existingIndex = toolPolicies.findIndex(
      (item) => item.serverId === incoming.serverId && item.tool === incoming.tool,
    );
    if (existingIndex >= 0) toolPolicies[existingIndex] = incoming;
    else toolPolicies.push(incoming);
  }

  return policyDraftSchema.parse({
    ...draft,
    identity: { ...draft.identity, ...update.identity },
    ownership: { ...draft.ownership, ...update.ownership },
    runtime: { ...draft.runtime, ...update.runtime },
    mcp: {
      ...draft.mcp,
      ...update.mcp,
      selectedTools: update.mcp?.selectedTools ?? draft.mcp.selectedTools,
      toolPolicies,
    },
    dataHandling: { ...draft.dataHandling, ...update.dataHandling },
    guardrails: { ...draft.guardrails, ...update.guardrails },
    monitoring: { ...draft.monitoring, ...update.monitoring },
  });
}

export function calculatePolicySnapshot(draftInput: PolicyDraft, lastAction = "Draft initialized"): PolicySnapshot {
  const draft = policyDraftSchema.parse(draftInput);
  const production = draft.identity.environment === "production";
  const sensitiveData = draft.dataHandling.classifications?.some((value) => ["confidential", "restricted"].includes(value));
  const selectedTools = draft.mcp.selectedTools ?? [];
  const toolPolicies = draft.mcp.toolPolicies ?? [];
  const hasUnclassifiedTool = selectedTools.some(
    (tool) => !toolPolicies.some((policy) => policy.tool === tool && policy.serverId === draft.mcp.serverId),
  );
  const results = [
    section("identity", "Agent setup", [
      { label: "Agent name", met: hasText(draft.identity.agentName) },
      { label: "Business purpose", met: hasText(draft.identity.purpose) },
      { label: "Environment", met: isSet(draft.identity.environment) },
      { label: "Business owner", met: hasText(draft.ownership.businessOwner) },
    ]),
    section("runtime", "Runtime & MCP", [
      { label: "AI provider", met: isSet(draft.runtime.provider) },
      { label: "Model deployment", met: hasText(draft.runtime.modelDeployment) },
      { label: "Connected MCP server", met: hasText(draft.mcp.serverId) },
      { label: "Tools selected", met: hasItems(selectedTools) },
      { label: "Tool decisions", met: toolPolicies.length > 0 && !hasUnclassifiedTool },
      { label: "Human approval rule", met: isSet(draft.mcp.humanApproval) },
    ]),
    section("safeguards", "Data & safeguards", [
      { label: "Data classifications", met: hasItems(draft.dataHandling.classifications) },
      { label: "PII decision", met: isSet(draft.dataHandling.processesPii) },
      { label: "Rate limit", met: isSet(draft.guardrails.rateLimitPerHour) },
      { label: "Emergency shutdown procedure", met: hasText(draft.guardrails.emergencyShutdown) },
    ]),
    section("monitoring", "Review & finish", [
      { label: "Audit logging decision", met: isSet(draft.monitoring.auditLogging) },
      { label: "Alert channel", met: hasText(draft.monitoring.alertChannel) },
      { label: "Review frequency", met: isSet(draft.monitoring.reviewFrequencyDays) },
    ]),
  ];
  const completed = results.reduce((sum, result) => sum + result.status.completed, 0);
  const total = results.reduce((sum, result) => sum + result.status.total, 0);
  const warnings: string[] = [];
  if (production && draft.mcp.defaultDecision === "allow" && draft.mcp.humanApproval === "never") warnings.push("Production MCP access should require approval for at least flagged tools.");
  if (hasUnclassifiedTool) warnings.push("Every selected MCP tool needs an allow, deny, flag, or log decision.");
  if (draft.mcp.serverId && !connectedMcpCatalog.some((server) => server.id === draft.mcp.serverId)) warnings.push("The selected MCP server is not in the connected catalog.");
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
