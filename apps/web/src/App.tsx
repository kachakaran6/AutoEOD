// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { ReportsHistoryPage } from '@/pages/ReportsHistoryPage'
import { AdminPage } from '@/pages/Admin'
import { AnalyticsTracker } from '@/components/AnalyticsTracker'

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function PublicOrDashboardRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) {
    return (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    )
  }
  return <LandingPage />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

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

              {/* Root route: Shows Landing Page if logged out, or Dashboard inside AppLayout if logged in */}
              <Route
                path="/"
                element={
                  <PublicOrDashboardRoute />
                }
              >
                <Route index element={<DashboardPage />} />
              </Route>

              {/* Protected app routes */}
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
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  }
                />
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
  )
}
