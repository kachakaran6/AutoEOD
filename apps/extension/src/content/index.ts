import { startObserving, triggerObservation } from './observer';
import { takeSnapshot } from './snapshot';

async function init() {
  const domain = window.location.hostname;
  
  // If we are on chatgpt, it's natively Tier 2
  if (domain.includes('chatgpt.com')) {
    startObserving();
    setTimeout(() => {
      triggerObservation();
    }, 2000);
    
    let lastUrl = location.href; 
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        triggerObservation();
      }
    }).observe(document, {subtree: true, childList: true});
    return;
  }

  // Otherwise, ask background if Tier 1 is allowed
  try {
    const response = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_TIER_1', payload: { domain } }, resolve);
    });

    if (response && response.allowed) {
      setTimeout(() => {
        const text = takeSnapshot();
        if (text) {
          const payload = {
            id: crypto.randomUUID(),
            domain,
            url: window.location.href,
            pageTitle: document.title,
            tabOpenedAt: new Date().toISOString(),
            durationSeconds: 0,
            captureTier: 1,
            snapshotText: text,
          };
          chrome.runtime.sendMessage({ type: 'ACTIVITY_UPDATE', payload });
        }
      }, 3000); // Wait 3s for page to render
    }
  } catch (err) {
    console.error('AutoEOD: Failed to check tier 1 status');
  }
}

init();
