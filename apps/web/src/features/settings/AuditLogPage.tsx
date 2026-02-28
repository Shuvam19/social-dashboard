import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const AUDIT_ACTIONS = [
  'STORE_LINKED',
  'STORE_UNLINKED',
  'DEFAULTS_CHANGED',
  'POST_CREATED',
  'POST_UPDATED',
  'POST_PUBLISHED',
  'POST_SUBMITTED_FOR_REVIEW',
  'POST_APPROVED',
  'POST_REJECTED',
  'POST_SCHEDULED',
  'POST_DELETED',
  'MEMBER_INVITED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_REMOVED',
  'MEMBER_PERMISSIONS_CHANGED',
  'TOKEN_CONNECTED',
] as const;

const ACTION_COLORS: Record<string, string> = {
  POST_PUBLISHED: 'bg-green-100 text-green-800',
  POST_APPROVED: 'bg-blue-100 text-blue-800',
  POST_REJECTED: 'bg-red-100 text-red-800',
  MEMBER_INVITED: 'bg-purple-100 text-purple-800',
  MEMBER_REMOVED: 'bg-red-100 text-red-800',
  STORE_LINKED: 'bg-cyan-100 text-cyan-800',
  STORE_UNLINKED: 'bg-orange-100 text-orange-800',
  DEFAULTS_CHANGED: 'bg-yellow-100 text-yellow-800',
};

const PAGE_SIZE = 25;

export function AuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', offset, actionFilter, entityTypeFilter],
    queryFn: () =>
      auditApi.getLogs({
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">
          Immutable record of all actions in this workspace
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={actionFilter}
          onValueChange={(v: string) => {
            setActionFilter(v === 'ALL' ? '' : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Entity type (e.g. Post)"
          value={entityTypeFilter}
          onChange={(e) => {
            setEntityTypeFilter(e.target.value);
            setOffset(0);
          }}
          className="w-[200px]"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}
                        >
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityId && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({log.entityId.slice(0, 8)}…)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">
                        {log.metadata ? (
                          <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">
                            {JSON.stringify(log.metadata).slice(0, 80)}
                            {JSON.stringify(log.metadata).length > 80 ? '…' : ''}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
