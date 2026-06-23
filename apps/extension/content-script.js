// AutoEOD ChatGPT Content Script
// Observes DOM for conversation activity and sends to background worker

let lastSentPayload = null;
let debounceTimeout = null;

// Finds the conversation title in the sidebar or header
function getConversationTitle() {
  // ChatGPT DOM changes frequently. We try a few common selectors.
  try {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      let title = titleEl.textContent;
      if (title.endsWith(' - ChatGPT')) {
        title = title.substring(0, title.length - 10);
      }
      if (title !== 'ChatGPT' && title !== 'New chat') {
        return title;
      }
    }
    
    // Fallback if title is generic
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim() !== '') return h1.textContent.trim();
  } catch (e) {
    console.warn('AutoEOD: Failed to parse title', e);
  }
  return 'Untitled Conversation';
}

function getConversationId() {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)$/);
  return match ? match[1] : null;
}

function extractMessages() {
  try {
    // Select all message blocks. This selector must be updated if OpenAI changes their DOM.
    // Usually message blocks have specific test-id attributes or specific article structures
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    const messages = [];

    messageElements.forEach(el => {
      const role = el.getAttribute('data-message-author-role');
      let text = el.textContent || '';
      
      // Basic cleanup and length cap
      text = text.trim();
      const excerpt = text.length > 500 ? text.substring(0, 500) + '...' : text;
      
      if (excerpt && role) {
        messages.push({ role, excerpt });
      }
    });

    return messages;
  } catch (e) {
    console.warn('AutoEOD: Failed to extract messages', e);
    return [];
  }
}

function observeAndSend() {
  const id = getConversationId();
  console.log('AutoEOD Debug: observeAndSend triggered. Extracted ID:', id);
  if (!id) return; // Not on a specific conversation page

  const title = getConversationTitle();
  const messages = extractMessages();
  
  console.log(`AutoEOD Debug: Extracted ${messages.length} messages. Title: "${title}"`);

  const payload = {
    externalId: id,
    title,
    lastSeenAt: new Date().toISOString(),
    messages
  };

  const payloadString = JSON.stringify(payload);
  if (lastSentPayload !== payloadString) {
    console.log('AutoEOD Debug: Payload changed. Sending to background worker...', payload);
    lastSentPayload = payloadString;
    chrome.runtime.sendMessage({ type: 'ACTIVITY_UPDATE', payload });
  } else {
    console.log('AutoEOD Debug: Payload unchanged. Skipping send.');
  }
}

function triggerObservation() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(observeAndSend, 10000); // 10 second debounce
}

// Initial check on load
setTimeout(triggerObservation, 2000);

// Observe DOM mutations to detect new messages streaming in or navigation
const observer = new MutationObserver(() => {
  triggerObservation();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});
