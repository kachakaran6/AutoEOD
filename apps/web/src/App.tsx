// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { ReportPage } from '@/pages/ReportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';
import { ReportsHistoryPage } from '@/pages/ReportsHistoryPage';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';

// Master Admin Layout & Pages
import { AdminLayout } from '@/components/admin/AdminLayout';
import ObservabilityOverviewPage from '@/pages/admin/ObservabilityOverviewPage';
import LogsExplorerPage from '@/pages/admin/LogsExplorerPage';
import TracesPage from '@/pages/admin/TracesPage';
import TraceDetailPage from '@/pages/admin/TraceDetailPage';
import ErrorTrackerPage from '@/pages/admin/ErrorTrackerPage';
import ErrorDetailPage from '@/pages/admin/ErrorDetailPage';
import PerformanceMetricsPage from '@/pages/admin/PerformanceMetricsPage';
import UserAuditPage from '@/pages/admin/UserAuditPage';
import UserTimelinePage from '@/pages/admin/UserTimelinePage';
import AdminAuditPage from '@/pages/admin/AdminAuditPage';
import SecurityLogsPage from '@/pages/admin/SecurityLogsPage';
import BackgroundJobsPage from '@/pages/admin/BackgroundJobsPage';
import SchedulerLogsPage from '@/pages/admin/SchedulerLogsPage';
import IntegrationLogsPage from '@/pages/admin/IntegrationLogsPage';
import EmailLogsPage from '@/pages/admin/EmailLogsPage';
import AiObservabilityPage from '@/pages/admin/AiObservabilityPage';
import SystemHealthPage from '@/pages/admin/SystemHealthPage';
import DatabaseHealthPage from '@/pages/admin/DatabaseHealthPage';
import RedisHealthPage from '@/pages/admin/RedisHealthPage';
import AdminAnalyticsPage from '@/pages/admin/AdminAnalyticsPage';
import RemoteConfigPage from '@/pages/admin/RemoteConfigPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import EmailTemplatesPage from '@/pages/admin/EmailTemplatesPage';
import ExtensionReleasePage from '@/pages/admin/ExtensionReleasePage';
import LogSettingsPage from '@/pages/admin/LogSettingsPage';
import RetentionPage from '@/pages/admin/RetentionPage';
import AlertsPage from '@/pages/admin/AlertsPage';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function PublicOrDashboardRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    return (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    );
  }
  return <LandingPage />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="autoeod-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AnalyticsTracker />
            <Routes>
              {/* Public marketing & auth routes */}
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Root route */}
              <Route path="/" element={<PublicOrDashboardRoute />}>
                <Route index element={<DashboardPage />} />
              </Route>

              {/* User Application Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/activity-log" element={<ActivityLogPage />} />
                <Route path="/timeline" element={<TimelinePage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/reports/:date" element={<ReportPage />} />
                <Route path="/history" element={<ReportsHistoryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Dedicated Enterprise Admin Platform Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/observability" replace />} />
                <Route path="observability" element={<ObservabilityOverviewPage />} />
                <Route path="logs" element={<LogsExplorerPage />} />
                <Route path="traces" element={<TracesPage />} />
                <Route path="traces/:traceId" element={<TraceDetailPage />} />
                <Route path="errors" element={<ErrorTrackerPage />} />
                <Route path="errors/:id" element={<ErrorDetailPage />} />
                <Route path="metrics" element={<PerformanceMetricsPage />} />

                {/* Activity & Audit */}
                <Route path="audit/users" element={<UserAuditPage />} />
                <Route path="audit/users/:userId/timeline" element={<UserTimelinePage />} />
                <Route path="audit/admin" element={<AdminAuditPage />} />
                <Route path="security" element={<SecurityLogsPage />} />

                {/* Operations */}
                <Route path="jobs" element={<BackgroundJobsPage />} />
                <Route path="scheduler" element={<SchedulerLogsPage />} />
                <Route path="integrations" element={<IntegrationLogsPage />} />
                <Route path="email" element={<EmailLogsPage />} />

                {/* AI & Infrastructure Health */}
                <Route path="ai" element={<AiObservabilityPage />} />
                <Route path="system-health" element={<SystemHealthPage />} />
                <Route path="system-health/database" element={<DatabaseHealthPage />} />
                <Route path="system-health/redis" element={<RedisHealthPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />

                {/* Governance & Configuration */}
                <Route path="config" element={<RemoteConfigPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="templates" element={<EmailTemplatesPage />} />
                <Route path="extension" element={<ExtensionReleasePage />} />
                <Route path="log-settings" element={<LogSettingsPage />} />
                <Route path="retention" element={<RetentionPage />} />
                <Route path="alerts" element={<AlertsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster
            position="bottom-right"
            richColors
            theme="system"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
