// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Protected app routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/reports/:date" element={<ReportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>

        <Toaster
          position="bottom-right"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: 'hsl(224 71% 6%)',
              border: '1px solid hsl(216 34% 17%)',
              color: 'hsl(213 31% 91%)',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
