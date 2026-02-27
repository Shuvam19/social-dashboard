import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Share2,
  FileText,
  MessageSquare,
  Megaphone,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronsUpDown,
  Plus,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { authApi, usersApi, tenantsApi } from '@/lib/api';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Share2 },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Inbox', href: '/inbox', icon: MessageSquare },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', slug: '' });
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenant, logout, refreshToken, setTokens, setTenant, setUser } = useAuthStore();

  useEffect(() => {
    usersApi.getTenants().then((data) => setTenants(data)).catch(() => {});
  }, [tenant?.id]);

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore errors
      }
    }
    logout();
    navigate('/login');
  };

  const handleSwitchTenant = async (tenantId: string) => {
    if (tenantId === tenant?.id) return;
    try {
      const tokens = await tenantsApi.switchTenant(tenantId);
      // 1. Update tokens first so subsequent API calls use the new token
      setTokens(tokens.accessToken, tokens.refreshToken);
      // 2. Clear all cached query data so remounted components start fresh
      queryClient.removeQueries();
      // 3. Update tenant – this changes the Outlet key, forcing full remount
      const selectedMembership = tenants.find((m) => m.tenant?.id === tenantId);
      if (selectedMembership?.tenant) {
        setTenant(selectedMembership.tenant);
      }
      // 4. Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch {
      // Ignore errors
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.slug) return;
    setCreatingWorkspace(true);
    try {
      const created = await tenantsApi.create(newWorkspace);
      const tokens = await tenantsApi.switchTenant(created.id);
      setTokens(tokens.accessToken, tokens.refreshToken);
      queryClient.removeQueries();
      setTenant({ id: created.id, name: created.name, slug: created.slug });
      setCreateWorkspaceOpen(false);
      setNewWorkspace({ name: '', slug: '' });
      navigate('/dashboard', { replace: true });
    } catch {
      // Ignore errors
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm.firstName || !profileForm.lastName) return;
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile(profileForm);
      setUser({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        avatarUrl: updated.avatarUrl,
      });
      setProfileOpen(false);
    } catch {
      // Ignore errors
    } finally {
      setSavingProfile(false);
    }
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : 'U';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Social Dashboard</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Tenant selector */}
          <div className="px-4 py-3 border-b">
            <p className="text-xs text-muted-foreground mb-1">Workspace</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors">
                  <span className="font-medium truncate">{tenant?.name}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tenants.map((membership) => (
                  <DropdownMenuItem
                    key={membership.tenant?.id || membership.tenantId}
                    onClick={() => handleSwitchTenant(membership.tenant?.id || membership.tenantId)}
                    className="cursor-pointer"
                  >
                    <span className="flex-1 truncate">{membership.tenant?.name}</span>
                    {(membership.tenant?.id || membership.tenantId) === tenant?.id && (
                      <Check className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setCreateWorkspaceOpen(true)}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center space-x-3 rounded-md p-1 hover:bg-gray-100 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setProfileOpen(true)}
                  className="cursor-pointer"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center bg-white border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" asChild>
            <Link to="/posts/create">Create Post</Link>
          </Button>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet key={tenant?.id} />
        </main>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to organize your social accounts and team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Company"
                value={newWorkspace.name}
                onChange={(e) =>
                  setNewWorkspace((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-slug">Slug</Label>
              <Input
                id="workspace-slug"
                placeholder="my-company"
                value={newWorkspace.slug}
                onChange={(e) =>
                  setNewWorkspace((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Only lowercase letters, numbers, and hyphens.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateWorkspaceOpen(false)}
              disabled={creatingWorkspace}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={creatingWorkspace || !newWorkspace.name || !newWorkspace.slug}
            >
              {creatingWorkspace ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First Name</Label>
              <Input
                id="profile-first-name"
                value={profileForm.firstName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Last Name</Label>
              <Input
                id="profile-last-name"
                value={profileForm.lastName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProfileOpen(false)}
              disabled={savingProfile}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileForm.firstName || !profileForm.lastName}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
