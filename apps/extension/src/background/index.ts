import { enqueuePayload } from './storage';
import { processQueue, updateBadge } from './sync';
import { getApiToken } from '../lib/api';

// Handle incoming messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_UPDATE') {
    const payload = message.payload;
    if (sender.tab) {
      payload.tabId = sender.tab.id;
      payload.windowId = sender.tab.windowId;
    }
    
    // Fire and forget, but acknowledge receipt to content script
    enqueuePayload(payload).then(() => {
      // Trigger processing immediately
      processQueue();
    }).catch(err => {
      console.error('Failed to enqueue payload:', err);
    });
    
    sendResponse({ status: 'queued' });
  }
  return true; // Keep message channel open for async response if needed
});

// Periodic alarm to flush the queue (useful if browser was offline)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retrySync') {
    processQueue();
  }
});

// Create alarm on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('retrySync', { periodInMinutes: 1 });
  processQueue();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('retrySync', { periodInMinutes: 1 });
  
  getApiToken().then(token => {
    if (token) {
      updateBadge('✓', '#22c55e');
    } else {
      updateBadge('!', '#71717a');
    }
  });
});

// Also initialize state on worker load
getApiToken().then(token => {
  if (token) {
    updateBadge('✓', '#22c55e');
  } else {
    updateBadge('!', '#71717a');
  }
  processQueue();
});
