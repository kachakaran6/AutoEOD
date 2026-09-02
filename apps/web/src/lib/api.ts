// apps/web/src/lib/api.ts
// API client — all requests go through here

const envApiUrl = (import.meta as any).env.VITE_API_URL;
export const BASE_URL = envApiUrl
  ? (envApiUrl.endsWith('/api') ? envApiUrl.replace(/\/$/, '') : `${envApiUrl.replace(/\/$/, '')}/api`)
  : '/api';

const TOKEN_KEY = 'autoeod_access_token';

let accessToken: string | null =
  typeof window !== 'undefined'
    ? localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token')
    : null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('token');
    }
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
  }
  return accessToken;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
  role?: string;
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

export interface TimeBlock {
  startTime: string;
  endTime: string;
  title: string;
  category?: string;
  details?: string;
  toolsAndWebsites?: string[];
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
  timeBlocks?: TimeBlock[] | null;
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
  errorMessage?: string | null;
}

export interface ReportEditData {
  summary: string;
  completedItems: string[];
  inProgressItems: string[];
  blockers: string | null;
  tomorrowPlan: string;
  timeBlocks?: TimeBlock[] | null;
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
  workingDays?: number[];
  autoGenerate: boolean;
  autoSend: boolean;
  managerEmail: string | null;
  ccEmails: string | null;
  reportTemplate: string;
  reportLanguage: string;
  chatgptCaptureContent?: boolean;
  includeRadarLogs?: boolean;
  includeTimeBlocks?: boolean;
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

// ── Holidays & PTO ─────────────────────────────────────────────────────────────
export interface Holiday {
  id: string;
  userId: string;
  date: string;
  name: string;
}

export interface ReportSkipLog {
  id: string;
  userId: string;
  date: string;
  reason: string;
  createdAt: string;
}

export const holidays = {
  list: () => apiRequest<Holiday[]>('/holidays'),
  create: (data: { date: string; name: string }) =>
    apiRequest<Holiday>('/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/holidays/${id}`, {
      method: 'DELETE',
    }),
  getSkipLogs: () => apiRequest<ReportSkipLog[]>('/holidays/skip-logs'),
};

// ── Timeline Sessions ──────────────────────────────────────────────────────────
export interface TimelineSessionItem {
  id: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  appName: string;
  windowTitle?: string | null;
  project?: string | null;
  detectedTask?: string | null;
  aiSummary?: string | null;
  selected: boolean;
}

export const timeline = {
  list: (date: string) => apiRequest<TimelineSessionItem[]>(`/timeline?date=${date}`),
  generateSummaries: () =>
    apiRequest<{ count: number; usedModel?: string }>('/timeline/generate-summaries', {
      method: 'POST',
    }),
  update: (id: string, data: { windowTitle?: string; aiSummary?: string; selected?: boolean }) =>
    apiRequest<TimelineSessionItem>(`/timeline/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/timeline/${id}`, {
      method: 'DELETE',
    }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface AdminSystemConfig {
  id: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  maintenanceMode: boolean;
  forceUpdate: boolean;
  minExtensionVersion: string;
  minDesktopVersion: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    reports: number;
    activityEvents: number;
    browserLogs?: number;
  };
}

export interface AdminHealth {
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'healthy' | 'unhealthy' | 'down';
    latencyMs?: number;
    error?: string;
  };
  redis: {
    status: 'healthy' | 'unhealthy' | 'down';
    latencyMs?: number;
    totalCommands?: number;
    totalReads?: number;
    totalWrites?: number;
    totalKeys?: number;
    dataSize?: string;
    opsPerSec?: number;
    connectedClients?: number;
    error?: string;
  };
  queues: Record<string, {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
  }>;
}

// ── Observability & Admin Platform Types ───────────────────────────────────────

export interface ObservabilityOverview {
  systemHealth: {
    overall: 'healthy' | 'degraded' | 'down';
    database: { status: string; latencyMs: number };
    redis: { status: string; latencyMs: number };
    queues: Record<string, { active: number; completed: number; failed: number; delayed: number; waiting: number }>;
    uptimeSeconds: number;
    timestamp: string;
  };
  requests: {
    total: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    errorRate: number;
    failure5xxRate: number;
    requestsPerMinute: number;
  };
  latency: {
    avg: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  comparison: {
    requestsVsYesterday: number;
    errorsVsYesterday: number;
    latencyVsYesterday: number;
  };
  usage: {
    totalUsers: number;
    reportsToday: number;
    aiCalls: number;
    aiFallbacks: number;
    backgroundJobs: number;
    failedJobs: number;
  };
  security: {
    securityEventsToday: number;
    activeAlerts: number;
  };
  errors: {
    unresolvedErrorGroups: number;
  };
  timeSeries: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    p50Ms: number;
    p95Ms: number;
    aiCalls: number;
  }>;
}

export interface StructuredLogItem {
  id: string;
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  environment: string;
  application: string;
  hostname: string;
  processId: number;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  userEmail?: string;
  action?: string;
  category?: string;
  message: string;
  durationMs?: number;
  status?: string | number;
  metadata?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
}

export interface LogsQueryResponse {
  logs: StructuredLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  levelCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

export interface TraceSummaryItem {
  traceId: string;
  rootSpanName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  service: string;
  httpMethod?: string;
  httpRoute?: string;
  httpStatus?: number;
  userId?: string;
  userEmail?: string;
  spanCount: number;
  errorCount: number;
}

export interface SpanItem {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER' | 'INTERNAL';
  service: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR' | 'UNSET';
  attributes: Record<string, any>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> }>;
  error?: { message: string; stack?: string };
}

export interface TraceDetailResponse extends TraceSummaryItem {
  spans: SpanItem[];
}

export interface TracesQueryResponse {
  traces: TraceSummaryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorGroupItem {
  id: string;
  fingerprint: string;
  name: string;
  message: string;
  service: string;
  environment: string;
  firstSeen: string;
  lastSeen: string;
  totalOccurrences: number;
  affectedUsersCount: number;
  status: 'UNRESOLVED' | 'RESOLVED' | 'IGNORED';
  lastTraceId?: string;
  sampleStackTrace?: string;
  _count?: { occurrences: number };
}

export interface ErrorOccurrenceItem {
  id: string;
  groupId: string;
  timestamp: string;
  message: string;
  stackTrace?: string;
  userId?: string;
  userEmail?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorDetailResponse extends ErrorGroupItem {
  occurrences: ErrorOccurrenceItem[];
}

export interface ErrorsQueryResponse {
  errors: ErrorGroupItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditEventItem {
  id: string;
  timestamp: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  targetUserId?: string;
  action: string;
  category: string;
  resource?: string;
  resourceId?: string;
  status: string;
  reason?: string;
  details?: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

export interface AdminActionItem {
  id: string;
  timestamp: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  traceId?: string;
}

export interface SecurityEventItem {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  traceId?: string;
  details?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AlertRuleItem {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: string;
  threshold: number;
  windowMinutes: number;
  severity: string;
  enabled: boolean;
  notificationChannel: string;
  recipients?: string;
  createdAt: string;
  _count?: { incidents: number };
}

export interface AlertIncidentItem {
  id: string;
  ruleId: string;
  status: string;
  triggeredAt: string;
  resolvedAt?: string;
  metricValue: number;
  message: string;
  details?: Record<string, any>;
  rule?: { name: string; severity: string };
}

export interface RetentionPolicyItem {
  id: string;
  logCategory: string;
  retentionDays: number;
  archiveEnabled: boolean;
  archiveStoragePath?: string;
}

export interface ObservabilitySettings {
  id: string;
  logLevel: string;
  samplingRatePercent: number;
  aiPromptPrivacy: string;
  redactionEnabled: boolean;
}

export interface EndpointMetricItem {
  route: string;
  method: string;
  count: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastAccessedAt: string;
}

export interface PerformanceMetricsResponse {
  requests: {
    total: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    errorRate: number;
  };
  latency: {
    avg: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  endpoints: EndpointMetricItem[];
  timeSeries: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    p50Ms: number;
    p95Ms: number;
  }>;
}

export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  enabled: boolean;
  variables: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  user?: { id: string; name: string; email: string } | null;
  action: string;
  level: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AdminModelsUsage {
  config: {
    primaryModel: string;
    fallbackModel: string;
    baseURL: string;
    providerName: string;
  };
  metrics: {
    totalReports: number;
    successfulReports: number;
    failedReports: number;
    successRate: number;
    totalTimelineSummaries: number;
    estimatedTokensUsed: number;
  };
  modelBreakdown: Array<{
    model: string;
    count: number;
    percentage: number;
  }>;
  recentAiLogs: any[];
}

export interface AdminAnalytics {
  metrics: {
    totalUsers: number;
    totalReports: number;
    totalActivityEvents: number;
    totalBrowserLogs: number;
    estimatedApiReqs: number;
    avgResponseMs: number;
    statusDistribution: {
      '2xx_success': number;
      '4xx_client': number;
      '5xx_server': number;
    };
  };
}

export interface AuditLogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const admin = {
  // Observability & Telemetry
  getObservabilityOverview: () => apiRequest<ObservabilityOverview>('/admin/observability/overview'),
  getLogs: (params?: {
    level?: string;
    service?: string;
    category?: string;
    traceId?: string;
    requestId?: string;
    userId?: string;
    action?: string;
    search?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<LogsQueryResponse>(`/admin/logs${query}`);
  },
  getTraces: (params?: {
    service?: string;
    status?: string;
    route?: string;
    search?: string;
    minDurationMs?: number;
    startTime?: string;
    endTime?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<TracesQueryResponse>(`/admin/traces${query}`);
  },
  getTraceDetail: (traceId: string) => apiRequest<TraceDetailResponse>(`/admin/traces/${traceId}`),
  getErrors: (params?: { status?: string; service?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<ErrorsQueryResponse>(`/admin/errors${query}`);
  },
  getErrorDetail: (id: string) => apiRequest<ErrorDetailResponse>(`/admin/errors/${id}`),
  updateErrorStatus: (id: string, status: 'UNRESOLVED' | 'RESOLVED' | 'IGNORED') =>
    apiRequest<ErrorGroupItem>(`/admin/errors/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getMetrics: () => apiRequest<PerformanceMetricsResponse>('/admin/metrics'),

  // Audit Trails & Security
  getUserAudit: (params?: {
    category?: string;
    action?: string;
    userId?: string;
    search?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<{ events: AuditEventItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/audit/users${query}`
    );
  },
  getUserTimeline: (userId: string) =>
    apiRequest<{ user: { id: string; name: string; email: string; createdAt: string }; timeline: AuditEventItem[] }>(
      `/admin/audit/users/${userId}/timeline`
    ),
  getAdminAudit: (params?: { action?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<{ actions: AdminActionItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/audit/admin${query}`
    );
  },
  getSecurityLogs: (params?: { severity?: string; eventType?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== 'all') qs.set(k, String(v));
      }
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<{ events: SecurityEventItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/security${query}`
    );
  },
  resolveSecurityEvent: (id: string) =>
    apiRequest<SecurityEventItem>(`/admin/security/${id}/resolve`, {
      method: 'PATCH',
    }),

  // Operations (Jobs, Scheduler, Integrations, Email)
  getJobs: () => apiRequest<{ queues: Array<{ name: string; counts: any; recentJobs: any[] }> }>('/admin/jobs'),
  retryJob: (queueName: string, jobId: string) =>
    apiRequest<{ success: boolean; message: string }>(`/admin/jobs/${queueName}/${jobId}/retry`, {
      method: 'POST',
    }),
  getScheduler: () =>
    apiRequest<{ schedulers: any[]; recentExecutionLogs: StructuredLogItem[] }>('/admin/scheduler'),
  getIntegrationsStats: () =>
    apiRequest<{ connectedProviders: { github: number; google: number; zoho: number }; recentEvents: AuditEventItem[] }>(
      '/admin/integrations/stats'
    ),
  getEmailLogs: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<{ events: AuditEventItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/email/logs${query}`
    );
  },

  // AI & System Health
  getAiObservability: () => apiRequest<AdminModelsUsage>('/admin/ai'),
  getSystemHealth: () =>
    apiRequest<{
      timestamp: string;
      uptimeSeconds: number;
      database: { status: string; latencyMs?: number; error?: string };
      redis: { status: string; latencyMs?: number; error?: string; memory?: string; opsPerSec?: number; totalKeys?: number };
      queues: Record<string, any>;
      aiProvider: { status: string; provider: string };
      emailProvider: { status: string; provider: string };
    }>('/admin/system-health'),

  // Alerts, Retention, Export & Settings
  getAlerts: () => apiRequest<{ rules: AlertRuleItem[]; incidents: AlertIncidentItem[] }>('/admin/alerts'),
  createAlert: (data: {
    name: string;
    description?: string;
    metric: string;
    condition?: string;
    threshold: number;
    windowMinutes?: number;
    severity?: string;
    recipients?: string;
  }) =>
    apiRequest<AlertRuleItem>('/admin/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAlert: (id: string, data: Partial<AlertRuleItem>) =>
    apiRequest<AlertRuleItem>(`/admin/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteAlert: (id: string) =>
    apiRequest<{ success: boolean }>(`/admin/alerts/${id}`, {
      method: 'DELETE',
    }),

  getRetention: () =>
    apiRequest<{
      policies: RetentionPolicyItem[];
      storageStats: { errorOccurrences: number; securityEvents: number; auditEvents: number };
    }>('/admin/retention'),
  updateRetention: (category: string, data: { retentionDays: number; archiveEnabled?: boolean }) =>
    apiRequest<RetentionPolicyItem>(`/admin/retention/${category}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  runRetentionCleanup: () =>
    apiRequest<{ success: boolean; result: any }>('/admin/retention/run-cleanup', {
      method: 'POST',
    }),

  createExportJob: (data: { category: string; filters?: any; format?: 'json' | 'csv' }) =>
    apiRequest<{ success: boolean; jobId: string; message: string }>('/admin/logs/export', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getExportStatus: (id: string) =>
    apiRequest<{
      id: string;
      status: string;
      rowCount?: number;
      fileSizeBytes?: number;
      downloadUrl?: string;
      errorMessage?: string;
    }>(`/admin/logs/export/${id}`),

  getLogSettings: () => apiRequest<ObservabilitySettings>('/admin/log-settings'),
  updateLogSettings: (data: Partial<ObservabilitySettings>) =>
    apiRequest<ObservabilitySettings>('/admin/log-settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Preserved Existing Management API
  getConfig: () => apiRequest<AdminSystemConfig>('/admin/config'),
  updateConfig: (data: Partial<AdminSystemConfig>) =>
    apiRequest<AdminSystemConfig>('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getUsers: () => apiRequest<AdminUser[]>('/admin/users'),
  updateUserRole: (id: string, role: 'USER' | 'ADMIN') =>
    apiRequest<AdminUser>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  getHealth: () => apiRequest<AdminHealth>('/admin/system-health'),
  getTemplates: () => apiRequest<EmailTemplate[]>('/admin/templates'),
  createTemplate: (data: Partial<EmailTemplate>) =>
    apiRequest<EmailTemplate>('/admin/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (id: string, data: Partial<EmailTemplate>) =>
    apiRequest<EmailTemplate>(`/admin/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) =>
    apiRequest<{ success: boolean }>(`/admin/templates/${id}`, {
      method: 'DELETE',
    }),
  getAuditLogs: (params?: { level?: string; category?: string; limit?: number; page?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.level && params.level !== 'all') qs.set('level', params.level);
    if (params?.category && params.category !== 'all') qs.set('category', params.category);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<AuditLogsResponse>(`/admin/audit-logs${query}`);
  },
  getModelsUsage: () => apiRequest<AdminModelsUsage>('/admin/ai'),
  getAnalytics: () => apiRequest<AdminAnalytics>('/admin/analytics'),
  releaseExtension: (data: { githubToken?: string; repo?: string; tag?: string; apiBaseUrl?: string }) =>
    apiRequest<{
      success: boolean;
      tag: string;
      releaseUrl?: string | null;
      downloadUrl?: string | null;
      sizeBytes: number;
      directDownloadUrl: string;
    }>('/admin/release-extension', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

