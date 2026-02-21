import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Share2,
  FileText,
  MessageSquare,
  Megaphone,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Share2 },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Inbox', href: '/inbox', icon: MessageSquare },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone, disabled: true },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, logout, refreshToken } = useAuthStore();

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
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="font-medium truncate">{tenant?.name}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.disabled ? '#' : item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100',
                    item.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                  {item.disabled && (
                    <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="border-t p-4">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
