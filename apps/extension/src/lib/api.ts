// apps/extension/src/lib/api.ts
// Dynamic Remote Configuration client for AutoEOD Chrome Extension

const BOOTSTRAP_CONFIG_URL = 'https://autoeod-be.kachakaran.tech/api/config';
const FALLBACK_API_BASE_URL = 'https://autoeod-be.kachakaran.tech';

export interface RemoteConfig {
  api_base_url: string;
  web_base_url: string;
  maintenance_mode: boolean;
  force_update: boolean;
}

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  try {
    const res = await fetch(BOOTSTRAP_CONFIG_URL);
    if (res.ok) {
      const config = await res.json();
      await chrome.storage.local.set({ remoteConfig: config });
      return config;
    }
  } catch {
    // Ignore fetch error and use cached or fallback
  }

  const cached = await chrome.storage.local.get('remoteConfig');
  if (cached.remoteConfig) {
    return cached.remoteConfig as RemoteConfig;
  }

  return {
    api_base_url: FALLBACK_API_BASE_URL,
    web_base_url: FALLBACK_API_BASE_URL,
    maintenance_mode: false,
    force_update: false,
  };
}

export async function getApiToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('apiToken');
  return result.apiToken || null;
}

export async function getApiBaseUrl(): Promise<string> {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  const config = await fetchRemoteConfig();
  return (config.api_base_url || FALLBACK_API_BASE_URL).replace(/\/$/, '');
}

export async function getBrowserActivityEndpoint(): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}/api/extension/browser-activity`;
}

export async function getExtensionSettingsEndpoint(): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}/api/extension-settings`;
}

// Backwards-compatible alias
export async function getApiEndpoint(): Promise<string> {
  return getBrowserActivityEndpoint();
}
