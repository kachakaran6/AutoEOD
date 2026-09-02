// apps/web/src/lib/analytics.ts
// Production Google Analytics 4 (gtag.js) Integration

export const GA_MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || 'G-S703P0SKBF';

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Direct safe wrapper around window.gtag
 */
export function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

/**
 * Track single-page application page views
 */
export function trackPageView(url: string, title?: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_path: url,
    page_title: title || document.title,
    page_location: window.location.href,
    send_to: GA_MEASUREMENT_ID,
  });
}

/**
 * Track custom events with payload
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('event', eventName, {
    ...params,
    send_to: GA_MEASUREMENT_ID,
  });
}

/**
 * Set user properties/ID (privacy-safe pseudonymized user ID)
 */
export function setUserId(userId: string | null) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  if (userId) {
    window.gtag('set', 'user_properties', {
      user_id: userId,
    });
  } else {
    window.gtag('set', 'user_properties', {
      user_id: undefined,
    });
  }
}

/**
 * Consent Mode configuration (EEA / GDPR compliant)
 */
export interface ConsentOptions {
  analytics_storage?: 'granted' | 'denied';
  ad_storage?: 'granted' | 'denied';
  ad_user_data?: 'granted' | 'denied';
  ad_personalization?: 'granted' | 'denied';
}

export function updateConsent(consent: ConsentOptions) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  window.gtag('consent', 'update', consent);
}

/**
 * High-level typed analytics helper for AutoEOD
 */
export const analytics = {
  pageView: trackPageView,
  event: trackEvent,
  setUser: setUserId,
  consent: updateConsent,

  // User Actions
  login: (method: string = 'email') => trackEvent('login', { method }),
  signUp: (method: string = 'email') => trackEvent('sign_up', { method }),
  logout: () => trackEvent('logout'),

  // Product Actions
  generateReport: (params?: { date?: string; type?: string; auto?: boolean }) =>
    trackEvent('generate_report', params || {}),
  copyReport: () => trackEvent('copy_report'),
  exportReport: (format: string) => trackEvent('export_report', { format }),

  // Integrations
  connectIntegration: (platform: string) =>
    trackEvent('connect_integration', { platform }),
  disconnectIntegration: (platform: string) =>
    trackEvent('disconnect_integration', { platform }),

  // Settings & Theme
  themeChanged: (theme: string) => trackEvent('change_theme', { theme }),
};
