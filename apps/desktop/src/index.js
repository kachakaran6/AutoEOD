import activeWin from 'active-win';
import fs from 'fs';
import path from 'path';

// This is a minimal CLI agent that tracks active window every 5 seconds.
// It requires an ExtensionToken or API Key from the AutoEOD settings.

const POLL_INTERVAL_MS = 5000;
const API_URL = process.env.AUTOEOD_API_URL || 'http://localhost:3001';
const API_KEY = process.env.AUTOEOD_API_KEY;

if (!API_KEY) {
  console.error("Error: AUTOEOD_API_KEY environment variable is required.");
  console.error("Please generate one in the AutoEOD web settings and set it.");
  process.exit(1);
}

let sessionBuffer = [];

async function trackWindow() {
  try {
    const win = await activeWin();
    if (!win) return;

    // Filter out very short noisy window changes or system stuff if needed
    // win object has: title, owner.name, bounds, memoryUsage
    sessionBuffer.push({
      timestamp: new Date().toISOString(),
      appName: win.owner?.name || 'Unknown',
      windowTitle: win.title || '',
      durationSeconds: POLL_INTERVAL_MS / 1000
    });
  } catch (err) {
    console.error('Error getting active window:', err.message);
  }
}

async function flushBuffer() {
  if (sessionBuffer.length === 0) return;
  const payload = [...sessionBuffer];
  sessionBuffer = []; // clear buffer

  try {
    const res = await fetch(`${API_URL}/api/timeline/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ events: payload })
    });

    if (!res.ok) {
      console.error(`Failed to flush timeline events: ${res.status} ${res.statusText}`);
      // re-queue
      sessionBuffer = [...payload, ...sessionBuffer];
    } else {
      console.log(`Flushed ${payload.length} window events successfully.`);
    }
  } catch (err) {
    console.error('Error flushing timeline events:', err.message);
    // re-queue
    sessionBuffer = [...payload, ...sessionBuffer];
  }
}

console.log(`Starting AutoEOD Desktop Agent... Polling every ${POLL_INTERVAL_MS}ms`);

setInterval(trackWindow, POLL_INTERVAL_MS);
// Flush every minute
setInterval(flushBuffer, 60000);
