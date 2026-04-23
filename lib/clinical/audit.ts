import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RecordClinicalAuditInput = {
  patientId?: string | null;
  encounterId?: string | null;
  actorUserId: string;
  actorRole: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordClinicalAuditEvent(input: RecordClinicalAuditInput) {
  const { error } = await supabaseAdmin.schema("clinical").from("audit_events").insert({
    patient_id: input.patientId || null,
    encounter_id: input.encounterId || null,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    action: input.action,
    target_table: input.targetTable,
    target_id: input.targetId || null,
    metadata: input.metadata || {},
  });

  if (error) {
    throw error;
  }
}
