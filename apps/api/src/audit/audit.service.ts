import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogParams {
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget — errors are silently caught.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata as any,
          ipAddress: params.ipAddress,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      console.error('Audit log write failed:', error);
    }
  }

  /**
   * Query audit logs with pagination and filters.
   */
  async findAll(
    tenantId: string,
    filters?: {
      action?: AuditAction;
      entityType?: string;
      entityId?: string;
      userId?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.action) where.action = filters.action;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.userId) where.userId = filters.userId;

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }
}
