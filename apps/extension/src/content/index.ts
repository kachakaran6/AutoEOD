import { startObserving, triggerObservation } from './observer';

// Start observing on load
startObserving();

// Also trigger an initial check after a short delay
setTimeout(() => {
  triggerObservation();
}, 2000);

// Re-evaluate on navigation events (SPA routing)
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // URL changed, trigger a fresh observation
    triggerObservation();
  }
}).observe(document, {subtree: true, childList: true});
