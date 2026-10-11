import { calculatePolicySnapshot, createEmptyPolicy, mergePolicyUpdate, policyUpdateSchema, type PolicyDraft } from "@/lib/policy";
import { tool } from "ai";
import { z } from "zod";

export function createPolicyTools(initialDraft?: PolicyDraft) {
  let draft = initialDraft ?? createEmptyPolicy();
  return {
    get_policy_status: tool({
      description: "Read the authoritative policy draft, progress, missing fields, and warnings.",
      inputSchema: z.object({}),
      execute: () => calculatePolicySnapshot(draft, "Policy status reviewed"),
    }),
    update_policy_draft: tool({
      description: "Apply only policy facts explicitly provided or confirmed by the user. Send only changed fields and never invent values.",
      inputSchema: policyUpdateSchema,
      execute: (update) => {
        draft = mergePolicyUpdate(draft, update);
        return calculatePolicySnapshot(draft, "Policy draft updated");
      },
    }),
    create_policy: tool({
      description: "Create the final mock policy only after the user explicitly confirms and the draft is valid.",
      inputSchema: z.object({ confirmedByUser: z.literal(true) }),
      execute: () => {
        const status = calculatePolicySnapshot(draft, "Creation requested");
        if (!status.readyToCreate) return { ...status, creationError: "Resolve every missing field and warning first." };
        const id = `AISP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        draft = { ...draft, confirmed: true, createdPolicyId: id };
        return calculatePolicySnapshot(draft, `Policy ${id} created`);
      },
    }),
  };
}
