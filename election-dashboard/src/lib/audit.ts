import prisma from "./prisma";

export async function logAudit(action: string, actor: string | null, payload?: object): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actor,
        payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

export async function getAuditLogs(limit: number = 100) {
  try {
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor || "",
      payload: log.payload ? JSON.stringify(log.payload) : null,
      created_at: log.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return [];
  }
}
