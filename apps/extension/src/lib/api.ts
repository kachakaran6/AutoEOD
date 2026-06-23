export async function getApiToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('apiToken');
  return result.apiToken || null;
}

export function getApiEndpoint(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api/extension/activity';
  }
  return 'https://autoeod-production.up.railway.app/api/extension/activity';
}
