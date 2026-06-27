// apps/web/src/lib/api.ts
// API client — all requests go through here

const BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  // If 401, try to refresh the token once
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  signup: (data: { name: string; email: string; password: string }) =>
    apiRequest<{ accessToken: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  login: (data: { email: string; password: string }) =>
    apiRequest<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  refresh: () =>
    apiRequest<{ accessToken: string; user: User }>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
    }),

  logout: () =>
    apiRequest<void>('/auth/logout', { method: 'POST' }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboard = {
  getToday: () => apiRequest<DashboardData>('/dashboard/today'),
};

// ── Activity ─────────────────────────────────────────────────────────────────
export const activity = {
  getByDate: (date: string) => apiRequest<ActivityResponse>(`/activity?date=${date}`),
};

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = {
  generate: () => apiRequest<{ message: string; jobId: string; date: string }>('/reports/generate', { method: 'POST' }),
  getByDate: (date: string) => apiRequest<Report>(`/reports/${date}`),
  list: () => apiRequest<ReportSummary[]>('/reports'),
  update: (id: string, data: Partial<ReportEditData>) =>
    apiRequest<Report>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  regenerate: (id: string) =>
    apiRequest<{ message: string; jobId: string }>(`/reports/${id}/regenerate`, { method: 'POST' }),
  send: (id: string) => apiRequest<Report>(`/reports/${id}/send`, { method: 'POST' }),
};

// ── Integrations ─────────────────────────────────────────────────────────────
export const integrations = {
  get: () => apiRequest<IntegrationsData>('/integrations'),
  disconnectGitHub: () => apiRequest<void>('/integrations/github', { method: 'DELETE' }),
  syncGitHub: () => apiRequest<{ message: string }>('/integrations/github/sync', { method: 'POST' }),
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settings = {
  get: () => apiRequest<UserSettings>('/settings'),
  update: (data: Partial<UserSettings>) =>
    apiRequest<UserSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  disconnectEmail: () => apiRequest<{ success: boolean }>('/settings/email-connection', { method: 'DELETE' }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = {
  list: () => apiRequest<Notification[]>('/notifications'),
  markRead: (ids?: string[]) =>
    apiRequest<void>('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface DashboardData {
  date: string;
  timezone: string;
  user: { name: string; email: string } | null;
  github: {
    githubUsername: string;
    lastSyncedAt: string | null;
    needsReconnect: boolean;
  } | null;
  stats: {
    commits: number;
    prsOpened: number;
    prsMerged: number;
    reviews: number;
    issues: number;
    total: number;
  };
  report: {
    id: string;
    status: string;
    summary: string | null;
    completedItems: string[] | null;
    inProgressItems: string[] | null;
    generatedAt: string | null;
  } | null;
  unreadNotifications: number;
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  repo: string;
  url: string;
  occurredAt: string;
  source: string;
  rawPayload?: any;
}

export interface ActivityResponse {
  date: string;
  timezone: string;
  events: ActivityEvent[];
}

export interface Report {
  id: string;
  userId: string;
  reportDate: string;
  status: string;
  summary: string | null;
  completedItems: string[] | null;
  inProgressItems: string[] | null;
  blockers: string | null;
  tomorrowPlan: string | null;
  aiModel: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSummary {
  id: string;
  reportDate: string;
  status: string;
  summary: string | null;
  generatedAt: string | null;
  sentAt: string | null;
}

export interface ReportEditData {
  summary: string;
  completedItems: string[];
  inProgressItems: string[];
  blockers: string | null;
  tomorrowPlan: string;
}

export interface IntegrationsData {
  github:
    | {
        connected: true;
        username: string;
        scopes: string;
        connectedAt: string;
        lastSyncedAt: string | null;
        needsReconnect: boolean;
      }
    | { connected: false };
}

export interface UserSettings {
  id: string;
  userId: string;
  timezone: string;
  workStartTime: string;
  workEndTime: string;
  reportTime: string;
  autoGenerate: boolean;
  autoSend: boolean;
  managerEmail: string | null;
  ccEmails: string | null;
  reportTemplate: string;
  reportLanguage: string;
  chatgptCaptureContent?: boolean;
  includeRadarLogs?: boolean;
  emailConnection?: EmailConnection | null;
}

export interface EmailConnection {
  provider: 'google' | 'zoho';
  email: string;
  name: string | null;
  avatar: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  reportId: string | null;
  read: boolean;
  createdAt: string;
}
export interface ExtensionToken {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  token?: string; // only present on creation
}

export const extensionTokens = {
  list: () => apiRequest<ExtensionToken[]>('/extension-tokens'),
  create: (label: string) => apiRequest<ExtensionToken>('/extension-tokens', { method: 'POST', body: JSON.stringify({ label }) }),
  revoke: (id: string) => apiRequest<{ message: string }>(`/extension-tokens/${id}`, { method: 'DELETE' })
};

// ── Extension Settings ────────────────────────────────────────────────────────
export interface UserExtensionSettings {
  id: string;
  userId: string;
  globalPaused: boolean;
  tier1GlobalDefault: boolean;
  tier1DomainAllowlist: string[];
  excludedDomains: string[];
  updatedAt: string;
}

export const extensionSettings = {
  get: () => apiRequest<UserExtensionSettings>('/extension-settings'),
  update: (data: Partial<Omit<UserExtensionSettings, 'id'|'userId'|'updatedAt'>>) =>
    apiRequest<UserExtensionSettings>('/extension-settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ── Activity Log ──────────────────────────────────────────────────────────────
export interface BrowserActivityLog {
  id: string;
  userId: string;
  domain: string;
  url: string;
  pageTitle: string;
  tabOpenedAt: string;
  tabClosedAt: string | null;
  durationSeconds: number;
  captureTier: number;
  snapshotText: string | null;
  adapterPayload: any | null;
  selected: boolean;
  promotedToEventId: string | null;
  createdAt: string;
}

export interface ActivityLogListResponse {
  data: BrowserActivityLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const activityLog = {
  list: (params: { page?: number; limit?: number; domain?: string; date?: string; tier?: number; selectedOnly?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.domain) searchParams.set('domain', params.domain);
    if (params.date) searchParams.set('date', params.date);
    if (params.tier !== undefined) searchParams.set('tier', params.tier.toString());
    if (params.selectedOnly) searchParams.set('selectedOnly', 'true');
    return apiRequest<ActivityLogListResponse>(`/activity-log?${searchParams.toString()}`);
  },
  updateSelected: (id: string, selected: boolean) =>
    apiRequest<BrowserActivityLog>(`/activity-log/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ selected }),
    }),
  bulkSelect: (selected: boolean, domain?: string, date?: string) =>
    apiRequest<{ updatedCount: number }>('/activity-log/bulk-select', {
      method: 'POST',
      body: JSON.stringify({ selected, domain, date }),
    }),
  deleteBefore: (beforeDate: string) =>
    apiRequest<{ deletedCount: number }>('/activity-log', {
      method: 'DELETE',
      body: JSON.stringify({ beforeDate }),
    }),
  promote: (date?: string, ids?: string[]) =>
    apiRequest<{ promotedCount: number }>('/activity-log/promote', {
      method: 'POST',
      body: JSON.stringify({ date, ids }),
    }),
};
