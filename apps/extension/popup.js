document.addEventListener('DOMContentLoaded', async () => {
  const viewUnconnected = document.getElementById('view-unconnected');
  const viewConnected = document.getElementById('view-connected');
  const badge = document.getElementById('status-badge');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const tokenInput = document.getElementById('token-input');
  const errorMsg = document.getElementById('error-msg');
  const statusText = document.getElementById('connected-status');

  async function updateUI() {
    const { apiToken } = await chrome.storage.local.get('apiToken');
    if (apiToken) {
      viewUnconnected.style.display = 'none';
      viewConnected.style.display = 'block';
      badge.className = 'badge active';
      
      const { lastSync } = await chrome.storage.local.get('lastSync');
      if (lastSync) {
        statusText.textContent = `Connected. Last sync: ${new Date(lastSync).toLocaleTimeString()}`;
      } else {
        statusText.textContent = `Connected and waiting for activity.`;
      }
    } else {
      viewUnconnected.style.display = 'block';
      viewConnected.style.display = 'none';
      badge.className = 'badge';
    }
  }

  btnConnect.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      errorMsg.textContent = 'Please enter a token';
      errorMsg.style.display = 'block';
      return;
    }
    
    // In a real scenario we could ping the backend to verify, but for now just save it
    await chrome.storage.local.set({ apiToken: token });
    errorMsg.style.display = 'none';
    tokenInput.value = '';
    updateUI();
  });

  btnDisconnect.addEventListener('click', async () => {
    await chrome.storage.local.remove('apiToken');
    updateUI();
  });

  updateUI();
});
