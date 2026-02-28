import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  setAuth: (data: {
    user: User;
    tenant: Tenant;
    accessToken: string;
    refreshToken: string;
    role: string;
    permissions: string[];
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setTenant: (tenant: Tenant) => void;
  setUser: (user: User) => void;
  setRoleAndPermissions: (role: string, permissions: string[]) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (minRole: string) => boolean;
  logout: () => void;
}

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  PUBLISHER: 3,
  EDITOR: 2,
  ANALYST: 1,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      permissions: [],
      isAuthenticated: false,
      setAuth: (data) =>
        set({
          user: data.user,
          tenant: data.tenant,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
          permissions: data.permissions,
          isAuthenticated: true,
        }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setTenant: (tenant) => set({ tenant }),
      setUser: (user) => set({ user }),
      setRoleAndPermissions: (role, permissions) =>
        set({ role, permissions }),
      hasPermission: (permission: string) => {
        const state = get();
        if (state.role === 'OWNER') return true;
        return state.permissions.includes(permission);
      },
      hasRole: (minRole: string) => {
        const state = get();
        if (!state.role) return false;
        return (ROLE_HIERARCHY[state.role] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
      },
      logout: () =>
        set({
          user: null,
          tenant: null,
          accessToken: null,
          refreshToken: null,
          role: null,
          permissions: [],
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
