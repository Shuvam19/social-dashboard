export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  permissions: string[];
}
