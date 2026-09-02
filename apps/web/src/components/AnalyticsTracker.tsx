// apps/web/src/components/AnalyticsTracker.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * Component that automatically tracks page views in Google Analytics on React Router navigation
 */
export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const url = location.pathname + location.search;
    trackPageView(url, document.title);
  }, [location.pathname, location.search]);

  return null;
}
