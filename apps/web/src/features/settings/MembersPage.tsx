import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Trash2, Shield } from 'lucide-react';

const ROLES = ['OWNER', 'PUBLISHER', 'EDITOR', 'ANALYST'] as const;

const PERMISSIONS = [
  { key: 'CONNECT_TOKENS', label: 'Connect tokens' },
  { key: 'PUBLISH_YOUTUBE', label: 'Publish to YouTube' },
  { key: 'PUBLISH_FACEBOOK', label: 'Publish to Facebook' },
  { key: 'PUBLISH_INSTAGRAM', label: 'Publish to Instagram' },
  { key: 'PUBLISH_LINKEDIN', label: 'Publish to LinkedIn' },
  { key: 'PUBLISH_TWITTER', label: 'Publish to Twitter' },
  { key: 'PUBLISH_TIKTOK', label: 'Publish to TikTok' },
  { key: 'PUBLISH_PINTEREST', label: 'Publish to Pinterest' },
  { key: 'EDIT_CAPTIONS', label: 'Edit captions' },
  { key: 'SCHEDULE', label: 'Schedule posts' },
  { key: 'MANAGE_MEMBERS', label: 'Manage members' },
  { key: 'VIEW_ANALYTICS', label: 'View analytics' },
  { key: 'APPROVE_POSTS', label: 'Approve posts' },
  { key: 'MANAGE_CAMPAIGNS', label: 'Manage campaigns' },
] as const;

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  PUBLISHER: 'bg-blue-100 text-blue-800',
  EDITOR: 'bg-green-100 text-green-800',
  ANALYST: 'bg-gray-100 text-gray-800',
};

export function MembersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'EDITOR' as string });

  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: tenantsApi.getMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      tenantsApi.inviteMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setInviteOpen(false);
      setInviteForm({ email: '', role: 'EDITOR' });
      toast({ title: 'Member invited successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to invite', description: error.message });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      tenantsApi.updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({ title: 'Role updated' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ memberId, permissions }: { memberId: string; permissions: string[] }) =>
      tenantsApi.updateMemberPermissions(memberId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setPermissionsOpen(false);
      toast({ title: 'Permissions updated' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update permissions', description: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => tenantsApi.removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({ title: 'Member removed' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to remove member', description: error.message });
    },
  });

  const openPermissions = (member: any) => {
    setSelectedMember(member);
    setSelectedPermissions(
      member.permissions?.map((p: any) => p.permission) || [],
    );
    setPermissionsOpen(true);
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">Manage who has access to this workspace</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => {
                const isCurrentUser = m.user?.id === user?.id;
                const initials = `${m.user?.firstName?.charAt(0) || ''}${m.user?.lastName?.charAt(0) || ''}`;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.user?.avatarUrl} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {m.user?.firstName} {m.user?.lastName}
                            {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isCurrentUser || m.role === 'OWNER' ? (
                        <Badge variant="secondary" className={ROLE_COLORS[m.role]}>{m.role}</Badge>
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(role: string) =>
                            updateRoleMutation.mutate({ memberId: m.id, role })
                          }
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {m.permissions?.length || 0} permissions
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPermissions(m)}
                        title="Edit permissions"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      {!isCurrentUser && m.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeMutation.mutate(m.id)}
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They must already have an account. Enter their email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(role: string) => setInviteForm((f) => ({ ...f, role }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate(inviteForm)}
              disabled={!inviteForm.email || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting…' : 'Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Permissions — {selectedMember?.user?.firstName} {selectedMember?.user?.lastName}
            </DialogTitle>
            <DialogDescription>
              Toggle individual permissions for this member.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto py-2">
            {PERMISSIONS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(key)}
                  onChange={() => togglePermission(key)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedMember) {
                  updatePermissionsMutation.mutate({
                    memberId: selectedMember.id,
                    permissions: selectedPermissions,
                  });
                }
              }}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
