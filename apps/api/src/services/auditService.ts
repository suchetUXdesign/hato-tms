import { prisma } from "@hato-tms/db";

/**
 * Log an audit trail entry.
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  actorId: string,
  diff?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId,
        diff: diff ?? undefined,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[AuditService] Failed to write audit log:", err);
  }
}
