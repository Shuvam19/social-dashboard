import { ReactNode } from 'react';
import { useAuthStore } from '@/lib/store';

interface PermissionGateProps {
  /** The permission key required (e.g., 'EDIT_CAPTIONS') */
  permission?: string;
  /** Minimum role required (e.g., 'PUBLISHER') */
  role?: string;
  /** Content to render if the user lacks the required permission/role */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the user's permissions and role.
 *
 * Usage:
 *   <PermissionGate permission="EDIT_CAPTIONS">
 *     <EditButton />
 *   </PermissionGate>
 *
 *   <PermissionGate role="PUBLISHER">
 *     <PublishButton />
 *   </PermissionGate>
 */
export function PermissionGate({ permission, role, fallback = null, children }: PermissionGateProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
