import { NavLink, Outlet } from 'react-router-dom';
import { Users, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsNav = [
  { name: 'Members', href: '/settings/members', icon: Users },
  { name: 'Audit Log', href: '/settings/audit-log', icon: ScrollText },
];

export function SettingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace settings</p>
      </div>

      <div className="flex gap-6">
        {/* Settings sub-nav */}
        <nav className="flex flex-col gap-1 w-48 shrink-0">
          {settingsNav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 hover:bg-gray-100',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
