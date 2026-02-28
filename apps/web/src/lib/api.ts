import { useAuthStore } from './store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (!skipAuth && accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && !skipAuth) {
    // Try to refresh token
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);

          // Retry original request
          (headers as Record<string, string>)['Authorization'] = `Bearer ${tokens.accessToken}`;
          const retryResponse = await fetch(`${API_URL}${endpoint}`, {
            ...fetchOptions,
            headers,
          });

          if (!retryResponse.ok) {
            throw new Error('Request failed after token refresh');
          }

          return retryResponse.json();
        }
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  logout: (refreshToken: string) =>
    apiClient('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

// Social Accounts API
export const socialAccountsApi = {
  getAll: () => apiClient<any[]>('/social-accounts'),

  getById: (id: string) => apiClient<any>(`/social-accounts/${id}`),

  disconnect: (id: string) =>
    apiClient(`/social-accounts/${id}`, { method: 'DELETE' }),

  getAuthUrl: (platform: string) =>
    apiClient<{ authorizationUrl: string }>(`/oauth/${platform}/authorize`),
};

// Posts API
export const postsApi = {
  getAll: (status?: string) =>
    apiClient<any[]>(`/posts${status ? `?status=${status}` : ''}`),

  getById: (id: string) => apiClient<any>(`/posts/${id}`),

  create: (data: { socialAccountIds: string[]; contentText: string; mediaUrls?: string[]; postType?: string; scheduledAt?: string }) =>
    apiClient('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { contentText?: string; mediaUrls?: string[]; postType?: string; scheduledAt?: string; status?: string }) =>
    apiClient(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient(`/posts/${id}`, { method: 'DELETE' }),

  publish: (id: string) =>
    apiClient(`/posts/${id}/publish`, { method: 'POST' }),

  submitForReview: (id: string) =>
    apiClient(`/posts/${id}/submit-review`, { method: 'POST' }),

  approve: (id: string, note?: string) =>
    apiClient(`/posts/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  reject: (id: string, note: string) =>
    apiClient(`/posts/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
};

// Interactions API
export const interactionsApi = {
  getAll: (filters?: {
    type?: string;
    platform?: string;
    isReplied?: boolean;
    isRead?: boolean;
    isHidden?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return apiClient<any[]>(`/interactions${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient<any>(`/interactions/${id}`),

  getStats: () => apiClient<{
    total: number;
    unread: number;
    unreplied: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
  }>('/interactions/stats'),

  getUnreadCount: () =>
    apiClient<{ count: number }>('/interactions/unread-count'),

  markAsRead: (id: string) =>
    apiClient(`/interactions/${id}/read`, { method: 'PATCH' }),

  markAllAsRead: () =>
    apiClient('/interactions/read-all', { method: 'POST' }),

  markAsReplied: (id: string) =>
    apiClient(`/interactions/${id}/replied`, { method: 'PATCH' }),

  reply: (id: string, replyText: string) =>
    apiClient(`/interactions/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ replyText }),
    }),

  hide: (id: string) =>
    apiClient(`/interactions/${id}/hide`, { method: 'PATCH' }),

  unhide: (id: string) =>
    apiClient(`/interactions/${id}/unhide`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiClient(`/interactions/${id}`, { method: 'DELETE' }),
};

// Users API
export const usersApi = {
  getProfile: () => apiClient<any>('/users/me'),

  updateProfile: (data: { firstName?: string; lastName?: string; avatarUrl?: string }) =>
    apiClient<any>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getTenants: () => apiClient<any[]>('/users/me/tenants'),
};

// Tenants API
export const tenantsApi = {
  getCurrent: () => apiClient<any>('/tenants/current'),

  getMembers: () => apiClient<any[]>('/tenants/current/members'),

  create: (data: { name: string; slug: string; logoUrl?: string }) =>
    apiClient<any>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  inviteMember: (data: { email: string; role: string; permissions?: string[] }) =>
    apiClient('/tenants/current/members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMemberRole: (memberId: string, role: string) =>
    apiClient(`/tenants/current/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  updateMemberPermissions: (memberId: string, permissions: string[]) =>
    apiClient(`/tenants/current/members/${memberId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ permissions }),
    }),

  removeMember: (memberId: string) =>
    apiClient(`/tenants/current/members/${memberId}`, { method: 'DELETE' }),

  switchTenant: (tenantId: string) =>
    apiClient<{ accessToken: string; refreshToken: string; role: string; permissions: string[] }>('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }),
};

// Audit Logs API
export const auditApi = {
  getLogs: (filters?: {
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return apiClient<{ logs: any[]; total: number; limit: number; offset: number }>(
      `/audit-logs${query ? `?${query}` : ''}`,
    );
  },
};

// Ads / Campaigns API
export const adsApi = {
  getCampaigns: (status?: string) =>
    apiClient<any[]>(`/ads/campaigns${status ? `?status=${status}` : ''}`),

  getCampaignById: (id: string) => apiClient<any>(`/ads/campaigns/${id}`),

  createCampaign: (data: {
    socialAccountId: string;
    postId?: string;
    name: string;
    objective: string;
    budgetType: string;
    budgetAmount: number;
    currency?: string;
    startDate: string;
    endDate?: string;
    targeting?: Record<string, unknown>;
  }) =>
    apiClient('/ads/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCampaignStatus: (id: string, status: string) =>
    apiClient(`/ads/campaigns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteCampaign: (id: string) =>
    apiClient(`/ads/campaigns/${id}`, { method: 'DELETE' }),

  syncCampaigns: (socialAccountId: string) =>
    apiClient<{ synced: number; campaigns: any[] }>('/ads/campaigns/sync', {
      method: 'POST',
      body: JSON.stringify({ socialAccountId }),
    }),

  boostPost: (data: {
    postId: string;
    socialAccountId: string;
    name?: string;
    budgetAmount: number;
    budgetType: string;
    duration: number;
    objective: string;
    targeting?: Record<string, unknown>;
  }) =>
    apiClient('/ads/boost', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdSets: (campaignId: string) =>
    apiClient<any[]>(`/ads/campaigns/${campaignId}/adsets`),

  getAds: (campaignId: string) =>
    apiClient<any[]>(`/ads/campaigns/${campaignId}/ads`),
};

// Uploads API (pre-signed S3 uploads)
export const uploadsApi = {
  getPresignedUrl: (fileName: string, contentType: string) =>
    apiClient<{ uploadUrl: string; fileUrl: string }>('/uploads/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType }),
    }),

  uploadFileToS3: async (uploadUrl: string, file: File): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    if (!response.ok) {
      throw new Error(`S3 upload failed with status ${response.status}`);
    }
  },
};

// Analytics API
export const analyticsApi = {
  getSummary: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    return apiClient<any>(`/analytics/summary${query ? `?${query}` : ''}`);
  },

  getOverview: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    return apiClient<any>(`/analytics/overview${query ? `?${query}` : ''}`);
  },

  getCampaignTimeSeries: (campaignId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    return apiClient<any[]>(
      `/analytics/campaigns/${campaignId}/timeseries${query ? `?${query}` : ''}`,
    );
  },
};

