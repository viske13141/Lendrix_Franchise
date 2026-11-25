import type { DashboardPayload, PartyRole, UserAccount } from '../shared/types';

export interface LoginAccountOption {
  id: string;
  name: string;
  email: string;
  role: PartyRole;
  roleLabel: string;
  franchiseeId?: string;
  franchiseeName?: string;
  sessionTimeoutPolicy: 'Pending Confirmation';
  configuredSessionTimeoutMinutes: number | null;
}

export interface MfaChallengeResponse {
  challengeId: string;
  account: {
    id: string;
    name: string;
    role: PartyRole;
    roleLabel: string;
  };
  builtInChallengeCode: string;
  mfaIntegrationStatus: 'Not Connected';
}

export interface AuthSessionResponse {
  token: string;
  user: UserAccount;
  sessionExpiresAt: number;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function fetchAuthAccounts(): Promise<LoginAccountOption[]> {
  const res = await fetch('/api/auth/accounts');
  const data = await parseJsonOrThrow<{ accounts: LoginAccountOption[] }>(res);
  return data.accounts;
}

export async function initiateLogin(accountId: string): Promise<MfaChallengeResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  return parseJsonOrThrow<MfaChallengeResponse>(res);
}

export async function verifyMfa(challengeId: string, code: string): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/verify-mfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, code }),
  });
  return parseJsonOrThrow<AuthSessionResponse>(res);
}

export async function apiRequest<T>(
  token: string,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers });
  return parseJsonOrThrow<T>(res);
}

export async function fetchDashboardState(token: string): Promise<DashboardPayload> {
  return apiRequest<DashboardPayload>(token, '/api/dashboard');
}

export async function authorizeRoute(
  token: string,
  path: string
): Promise<{ authorized: boolean; role: PartyRole }> {
  return apiRequest<{ authorized: boolean; role: PartyRole }>(
    token,
    `/api/auth/authorize-route?path=${encodeURIComponent(path)}`
  );
}
