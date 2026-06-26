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

let globalActiveTabId: number | null = null;
let globalActiveWindowId: number | null = null;

// ---------------------------------------------------------------------------
// Settings fetch
// ---------------------------------------------------------------------------

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
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      extSettings = await res.json();
      if (extSettings.globalPaused) {
        isRecording = false;
        updateBadge('||', '#71717a');
      } else {
        isRecording = true;
        updateBadge('✓', '#22c55e');
      }
    }
  } catch (err) {
    // Network error or backend down — keep last known extSettings/isRecording
    // rather than guessing. This is intentionally silent (non-fatal); a
    // dedicated debug log line is fine, but never let this throw upward.
    console.warn('AutoEOD: fetchExtensionSettings failed', err);
  }
}

// ---------------------------------------------------------------------------
// Active-tab tracking helpers
// ---------------------------------------------------------------------------

/**
 * Safely builds a URL object. Returns null instead of throwing for anything
 * that isn't a real http(s) page — data:/blob:/chrome:/about: URLs, or
 * malformed URLs that can appear transiently mid-navigation.
 */
function safeParseHttpUrl(rawUrl: string | undefined | null): URL | null {
  if (!rawUrl) return null;
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

async function finalizeActiveTab(closedAt: number = Date.now()) {
  if (!activeState) return;

  if (!isRecording) {
    activeState = null;
    return;
  }

  const snapshot = activeState;
  // Clear immediately so a slow await below can't race a new activeState
  // assignment from a fast follow-up tab switch.
  activeState = null;

  const durationMs = closedAt - snapshot.openedAt;
  const durationSeconds = Math.floor(durationMs / 1000);

  // Minimum duration to track, to avoid noise from accidental flick-through tabs.
  if (durationSeconds < 2) return;

  try {
    await enqueuePayload({
      id: crypto.randomUUID(),
      domain: snapshot.domain,
      url: snapshot.url,
      pageTitle: snapshot.title,
      tabOpenedAt: new Date(snapshot.openedAt).toISOString(),
      tabClosedAt: new Date(closedAt).toISOString(),
      durationSeconds,
      captureTier: 0,
    });
    processQueue();
  } catch (err) {
    console.error('AutoEOD: failed to enqueue Tier 0 payload', err);
  }
}

async function handleTabSwitch(tabId: number, windowId: number) {
  globalActiveTabId = tabId;
  globalActiveWindowId = windowId;

  await finalizeActiveTab();

  if (!isRecording) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    const urlObj = safeParseHttpUrl(tab?.url);
    if (!urlObj) return;

    if (extSettings?.excludedDomains?.includes(urlObj.hostname)) {
      return;
    }

    activeState = {
      tabId,
      windowId,
      url: tab.url as string,
      domain: urlObj.hostname,
      title: tab.title || urlObj.hostname,
      openedAt: Date.now(),
    };
  } catch (err) {
    // Tab may have closed or become inaccessible between the event firing
    // and this await resolving — expected under normal browsing, not fatal.
    console.warn('AutoEOD: handleTabSwitch could not read tab', tabId, err);
  }
}

// ---------------------------------------------------------------------------
// Chrome event listeners — every handler is wrapped; an uncaught throw in
// any one of these is what causes Chrome to flag the extension's service
// worker as erroring, and onUpdated/onActivated fire on *every* navigation
// and tab switch across *every* site, so a single unguarded edge case here
// reproduces constantly rather than rarely.
// ---------------------------------------------------------------------------

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const win = await chrome.windows.get(activeInfo.windowId);
    if (win.focused) {
      await handleTabSwitch(activeInfo.tabId, activeInfo.windowId);
    }
  } catch (err) {
    console.warn('AutoEOD: onActivated handler error', err);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // OS lost focus on all chrome windows.
      globalActiveTabId = null;
      globalActiveWindowId = null;
      await finalizeActiveTab();
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].id !== undefined) {
      await handleTabSwitch(tabs[0].id, windowId);
    }
  } catch (err) {
    console.warn('AutoEOD: onFocusChanged handler error', err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (tabId === globalActiveTabId) {
      // The active tab navigated to a new URL.
      if (changeInfo.url) {
        await finalizeActiveTab();

        const urlObj = safeParseHttpUrl(changeInfo.url);
        if (urlObj && (!extSettings?.excludedDomains?.includes(urlObj.hostname))) {
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
    } else {
      if (activeState && activeState.tabId === tabId && changeInfo.title) {
        activeState.title = changeInfo.title;
      }
    }
  } catch (err) {
    console.warn('AutoEOD: onUpdated handler error', err);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    if (tabId === globalActiveTabId) {
      globalActiveTabId = null;
    }
    if (activeState && activeState.tabId === tabId) {
      await finalizeActiveTab();
    }
  } catch (err) {
    console.warn('AutoEOD: onRemoved handler error', err);
  }
});

// ---------------------------------------------------------------------------
// Messages from content scripts (Tier 1 & Tier 2)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message?.type === 'ACTIVITY_UPDATE') {
      const payload = message.payload;
      if (sender.tab) {
        payload.tabId = sender.tab.id;
        payload.windowId = sender.tab.windowId;
      }

      enqueuePayload(payload)
        .then(() => processQueue())
        .catch((err) => console.error('AutoEOD: failed to enqueue payload', err));

      sendResponse({ status: 'queued' });
      return true;
    }

    if (message?.type === 'GET_RECORDING_STATE') {
      sendResponse({ isRecording });
      return true;
    }

    if (message?.type === 'CHECK_TIER_1') {
      const { domain } = message.payload ?? {};
      let allowed = false;

      if (extSettings && domain) {
        if (extSettings.excludedDomains?.includes(domain)) {
          allowed = false;
        } else if (extSettings.tier1GlobalDefault) {
          allowed = true;
        } else if (extSettings.tier1DomainAllowlist?.includes(domain)) {
          allowed = true;
        }
      }

      sendResponse({ allowed });
      return true;
    }
  } catch (err) {
    console.warn('AutoEOD: onMessage handler error', err);
    try {
      sendResponse({ status: 'error' });
    } catch {
      // sendResponse itself can throw if the channel is already closed —
      // nothing further to do here.
    }
  }

  // Returning true (or having already returned above) keeps the message
  // channel open for the async sendResponse calls.
  return true;
});

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  try {
    if (alarm.name === 'retrySync') {
      processQueue();
    } else if (alarm.name === 'fetchSettings') {
      fetchExtensionSettings();
    }
  } catch (err) {
    console.warn('AutoEOD: onAlarm handler error', err);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle — single, idempotent entry point.
//
// IMPORTANT: do NOT also call checkTokenAndUpdateBadge() at module top
// level. Service workers in MV3 unload and reload constantly (every tab
// switch, every alarm, every message can wake a fresh worker instance), so a
// bare top-level call fires far more often than intended and races with the
// onStartup/onInstalled calls below. Alarm registration is idempotent
// (chrome.alarms.create with the same name just resets it), so calling it
// from both onStartup and onInstalled is fine and deliberate — it's the
// *work* (settings fetch, queue flush) that must not be triggered from a
// third, uncontrolled place.
// ---------------------------------------------------------------------------

function registerAlarms() {
  chrome.alarms.create('retrySync', { periodInMinutes: 1 });
  chrome.alarms.create('fetchSettings', { periodInMinutes: 5 });
}

async function checkTokenAndUpdateBadge() {
  try {
    const token = await getApiToken();
    if (token) {
      await fetchExtensionSettings();
    } else {
      updateBadge('!', '#71717a');
    }
    await processQueue();
  } catch (err) {
    console.warn('AutoEOD: checkTokenAndUpdateBadge failed', err);
  }
}

chrome.runtime.onStartup.addListener(() => {
  registerAlarms();
  checkTokenAndUpdateBadge();
});

chrome.runtime.onInstalled.addListener(() => {
  registerAlarms();
  checkTokenAndUpdateBadge();
});