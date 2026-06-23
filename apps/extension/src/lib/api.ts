export async function getApiToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('apiToken');
  return result.apiToken || null;
}

export function getApiEndpoint(): string {
  // If we're in development, try localhost, else production.
  // We'll default to the production URL as the safest bet for the distributed extension.
  return 'https://autoeod-production.up.railway.app/api/extension/activity';
}
