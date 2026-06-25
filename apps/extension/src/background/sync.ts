import { getPendingPayloads, removePayload, updatePayloadRetry, SyncPayload } from './storage';
import { getApiToken, getApiEndpoint } from '../lib/api';

const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 5000;

export async function processQueue() {
  const pending = await getPendingPayloads();
  if (pending.length === 0) return;

  const token = await getApiToken();
  if (!token) {
    updateBadge('!', '#71717a');
    return;
  }

  let hasError = false;

  // We can batch all pending payloads into one request
  const activities = pending.map(item => item.payload);

  if (activities.length > 0) {
    const success = await sendToServer(activities, token);
    
    if (success) {
      for (const item of pending) {
        await removePayload(item.payload.id);
      }
    } else {
      hasError = true;
      for (const item of pending) {
        const newRetryCount = item.retryCount + 1;
        
        if (newRetryCount >= MAX_RETRIES) {
          // Drop it if we retry too much
          await removePayload(item.payload.id);
        } else {
          // Exponential backoff
          const backoff = BASE_BACKOFF_MS * Math.pow(2, newRetryCount);
          await updatePayloadRetry(item.payload.id, newRetryCount, Date.now() + backoff);
        }
      }
    }
  }

  if (hasError) {
    updateBadge('!', '#ef4444');
    // Ensure the alarm is active to try again
    chrome.alarms.create('retrySync', { delayInMinutes: 1 });
  } else {
    updateBadge('✓', '#22c55e');
    await chrome.storage.local.set({ lastSync: new Date().toISOString() });
  }
}

async function sendToServer(activities: SyncPayload[], token: string): Promise<boolean> {
  try {
    // Determine API base url
    let endpoint = getApiEndpoint();
    // Swap the old endpoint path to the new one if it ends with /activity
    if (endpoint.endsWith('/activity')) {
      endpoint = endpoint.replace('/activity', '/browser-activity');
    } else {
      endpoint = `${endpoint}/browser-activity`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ activities })
    });

    if (res.status === 401) {
      // Token revoked or invalid
      await chrome.storage.local.remove('apiToken');
      updateBadge('!', '#ef4444');
      return false; 
    }

    if (!res.ok) {
      return false;
    }

    return true;
  } catch (err) {
    console.error('Network error syncing payload:', err);
    return false;
  }
}

export function updateBadge(text: string, color: string) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}
