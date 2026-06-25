import { enqueuePayload } from './storage';
import { processQueue, updateBadge } from './sync';
import { getApiToken, getApiEndpoint } from '../lib/api';

interface ActiveTabState {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  title: string;
  openedAt: number;
}

let activeState: ActiveTabState | null = null;
let isRecording = true; 
let extSettings: any = null;
let activeSyncInterval: any = null;

async function fetchExtensionSettings() {
  const token = await getApiToken();
  if (!token) return;

  try {
    let endpoint = getApiEndpoint();
    if (endpoint.endsWith('/activity')) {
      endpoint = endpoint.replace('/extension/activity', '/extension-settings');
    } else {
      endpoint = `${endpoint}/extension-settings`;
    }

    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      extSettings = await res.json();
      // Update badge based on global pause
      if (extSettings.globalPaused) {
        isRecording = false;
        updateBadge('||', '#71717a');
      } else {
        isRecording = true;
        updateBadge('✓', '#22c55e');
      }
    }
  } catch (err) {
    // silently ignore
  }
}

async function finalizeActiveTab(closedAt: number = Date.now()) {
  if (!activeState) return;
  if (!isRecording) {
    activeState = null;
    return;
  }

  const durationMs = closedAt - activeState.openedAt;
  const durationSeconds = Math.floor(durationMs / 1000);

  // Minimum duration to track? Let's say 2 seconds to avoid noise
  if (durationSeconds >= 2) {
    // Determine tier, snapshot logic will be triggered if tier 1, but for Tier 0 just send it
    // Wait, the content script handles Tier 1 snapshot and Tier 2 chatgpt.
    // So background script ONLY handles Tier 0 (Active Tab Duration).
    // The content script will send messages with higher tiers and we will merge them,
    // or we just send Tier 0 separately and let the backend/frontend manage it.
    // Actually, it's simpler if Tier 0 is sent by background, and Tier 1/2 are sent by content scripts.

    await enqueuePayload({
      id: crypto.randomUUID(),
      domain: activeState.domain,
      url: activeState.url,
      pageTitle: activeState.title,
      tabOpenedAt: new Date(activeState.openedAt).toISOString(),
      tabClosedAt: new Date(closedAt).toISOString(),
      durationSeconds,
      captureTier: 0,
    });
    processQueue();
  }

  activeState = null;
}

async function handleTabSwitch(tabId: number, windowId: number) {
  await finalizeActiveTab();

  if (!isRecording) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && tab.url.startsWith('http')) {
      const urlObj = new URL(tab.url);
      
      // Check exclusion list
      if (extSettings?.excludedDomains) {
        if (extSettings.excludedDomains.includes(urlObj.hostname)) {
          return;
        }
      }

      activeState = {
        tabId,
        windowId,
        url: tab.url,
        domain: urlObj.hostname,
        title: tab.title || urlObj.hostname,
        openedAt: Date.now(),
      };
    }
  } catch (err) {
    // Tab might be closed or inaccessible
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Check if window is focused
  const win = await chrome.windows.get(activeInfo.windowId);
  if (win.focused) {
    await handleTabSwitch(activeInfo.tabId, activeInfo.windowId);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // OS lost focus on all chrome windows
    await finalizeActiveTab();
  } else {
    // Chrome window gained focus, find its active tab
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].id) {
      await handleTabSwitch(tabs[0].id, windowId);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (activeState && activeState.tabId === tabId && changeInfo.url) {
    // The active tab navigated to a new URL
    await finalizeActiveTab();
    if (changeInfo.url.startsWith('http')) {
      const urlObj = new URL(changeInfo.url);
      activeState = {
        tabId,
        windowId: tab.windowId,
        url: changeInfo.url,
        domain: urlObj.hostname,
        title: tab.title || urlObj.hostname,
        openedAt: Date.now(),
      };
    }
  } else if (activeState && activeState.tabId === tabId && changeInfo.title) {
    activeState.title = changeInfo.title;
  }
});

// Handle incoming messages from content scripts (Tier 1 & Tier 2)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_UPDATE') {
    const payload = message.payload;
    if (sender.tab) {
      payload.tabId = sender.tab.id;
      payload.windowId = sender.tab.windowId;
    }
    
    enqueuePayload(payload).then(() => {
      processQueue();
    }).catch(err => {
      console.error('Failed to enqueue payload:', err);
    });
    
    sendResponse({ status: 'queued' });
  } else if (message.type === 'GET_RECORDING_STATE') {
    sendResponse({ isRecording });
  } else if (message.type === 'CHECK_TIER_1') {
    const { domain } = message.payload;
    let allowed = false;
    
    if (extSettings) {
      if (extSettings.excludedDomains && extSettings.excludedDomains.includes(domain)) {
        allowed = false;
      } else if (extSettings.tier1GlobalDefault) {
        allowed = true;
      } else if (extSettings.tier1DomainAllowlist && extSettings.tier1DomainAllowlist.includes(domain)) {
        allowed = true;
      }
    }
    
    sendResponse({ allowed });
  }
  return true;
});

// Periodic alarm to flush the queue (useful if browser was offline)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retrySync') {
    processQueue();
  } else if (alarm.name === 'fetchSettings') {
    fetchExtensionSettings();
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('retrySync', { periodInMinutes: 1 });
  chrome.alarms.create('fetchSettings', { periodInMinutes: 5 });
  processQueue();
  fetchExtensionSettings();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('retrySync', { periodInMinutes: 1 });
  chrome.alarms.create('fetchSettings', { periodInMinutes: 5 });
  checkTokenAndUpdateBadge();
});

// Also initialize state on worker load
checkTokenAndUpdateBadge();

async function checkTokenAndUpdateBadge() {
  const token = await getApiToken();
  if (token) {
    await fetchExtensionSettings();
  } else {
    updateBadge('!', '#71717a');
  }
  processQueue();
}
