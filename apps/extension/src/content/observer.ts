import { getConversationId, getConversationTitle, extractMessages, getModelName, getWorkspace } from './extractor';

let lastSentPayload: string | null = null;
let debounceTimeout: number | null = null;
let observer: MutationObserver | null = null;

export function observeAndSend() {
  const id = getConversationId();
  if (!id) return;

  const title = getConversationTitle();
  const messages = extractMessages();
  const modelName = getModelName();
  const workspace = getWorkspace();

  const payload = {
    externalId: id,
    title,
    lastSeenAt: new Date().toISOString(),
    modelName,
    workspace,
    messages
  };

  const payloadString = JSON.stringify(payload);
  if (lastSentPayload !== payloadString) {
    lastSentPayload = payloadString;
    try {
      chrome.runtime.sendMessage({ type: 'ACTIVITY_UPDATE', payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('AutoEOD: Failed to send message to background script.', chrome.runtime.lastError);
        }
      });
    } catch (e) {
      console.warn('AutoEOD: Error sending message', e);
    }
  }
}

export function triggerObservation() {
  if (debounceTimeout !== null) {
    clearTimeout(debounceTimeout);
  }
  // @ts-ignore
  debounceTimeout = setTimeout(observeAndSend, 5000); // 5 second debounce
}

export function startObserving() {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    // Only trigger if we see meaningful changes (text nodes or elements added/removed)
    // This avoids triggering on every tiny class change for hover states
    let hasMeaningfulChange = false;
    for (const m of mutations) {
      if (m.type === 'childList' || m.type === 'characterData') {
        hasMeaningfulChange = true;
        break;
      }
    }
    
    if (hasMeaningfulChange) {
      triggerObservation();
    }
  });

  // Try to find the main chat container instead of observing the whole body
  const mainContainer = document.querySelector('main') || document.body;

  observer.observe(mainContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
