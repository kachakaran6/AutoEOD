// AutoEOD Extension Background Worker

const API_ENDPOINT = 'http://localhost:3001/api/extension/activity';

async function getApiToken() {
  const result = await chrome.storage.local.get('apiToken');
  return result.apiToken;
}

async function sendActivityPayload(payload) {
  const token = await getApiToken();
  if (!token) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#71717a' });
    return false;
  }

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ conversations: [payload] })
    });

    if (res.status === 401) {
      // Token revoked or invalid
      await chrome.storage.local.remove('apiToken');
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      return false;
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    // Success
    chrome.action.setBadgeText({ text: 'âœ“' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    await chrome.storage.local.set({ lastSync: new Date().toISOString() });
    
    return true;
  } catch (error) {
    console.error('AutoEOD Sync failed:', error);
    return false;
  }
}

// Queue management for offline/failed requests
async function enqueuePayload(payload) {
  const { pendingQueue = [] } = await chrome.storage.local.get('pendingQueue');
  
  // Replace existing payload for the same conversation to prevent duplicates
  const existingIdx = pendingQueue.findIndex(p => p.externalId === payload.externalId);
  if (existingIdx !== -1) {
    pendingQueue[existingIdx] = payload;
  } else {
    pendingQueue.push(payload);
  }

  // Cap queue at 50
  if (pendingQueue.length > 50) {
    pendingQueue.shift();
  }

  await chrome.storage.local.set({ pendingQueue });
  chrome.alarms.create('retrySync', { delayInMinutes: 1 });
}

async function processQueue() {
  const { pendingQueue = [] } = await chrome.storage.local.get('pendingQueue');
  if (pendingQueue.length === 0) return;

  const token = await getApiToken();
  if (!token) return; // Wait until connected

  const remainingQueue = [];
  for (const payload of pendingQueue) {
    const success = await sendActivityPayload(payload);
    if (!success) {
      remainingQueue.push(payload);
    }
  }

  await chrome.storage.local.set({ pendingQueue: remainingQueue });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retrySync') {
    processQueue();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_UPDATE') {
    sendActivityPayload(message.payload).then(success => {
      if (!success) {
        enqueuePayload(message.payload);
      }
    });
  }
});

// Update badge on load
getApiToken().then(token => {
  if (token) {
    chrome.action.setBadgeText({ text: 'âœ“' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#71717a' });
  }
});
