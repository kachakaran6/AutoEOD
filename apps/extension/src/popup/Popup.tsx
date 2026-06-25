import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, LogOut } from 'lucide-react';

export default function Popup() {
  const [token, setToken] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(true);

  useEffect(() => {
    chrome.storage.local.get(['apiToken', 'lastSync'], (res) => {
      if (res.apiToken) setToken(res.apiToken);
      if (res.lastSync) setLastSync(res.lastSync);
    });

    // Check if background script says we're currently recording
    try {
      chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
        if (response && typeof response.isRecording === 'boolean') {
          setIsRecording(response.isRecording);
        }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const handleConnect = async () => {
    if (!inputToken.trim()) {
      setError('Please enter a valid token');
      return;
    }
    
    // Check if token is valid (this is just saving for now, actual validation happens on background)
    await chrome.storage.local.set({ apiToken: inputToken.trim() });
    
    // Set badge to OK
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    
    setToken(inputToken.trim());
    setInputToken('');
    setError('');
  };

  const handleDisconnect = async () => {
    await chrome.storage.local.remove(['apiToken', 'lastSync']);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#71717a' });
    
    setToken(null);
    setLastSync(null);
  };

  return (
    <div className="w-80 p-4 bg-zinc-950 text-zinc-50 font-sans">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-800">
        {token ? (
          <ShieldCheck className="w-6 h-6 text-green-500" />
        ) : (
          <ShieldAlert className="w-6 h-6 text-zinc-500" />
        )}
        <h1 className="text-base font-semibold tracking-tight">AutoEOD Capture</h1>
      </div>

      {!token ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Paste your extension token from the AutoEOD Integrations page to begin capturing activity.
          </p>
          
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          
          <div className="space-y-2">
            <input
              type="password"
              placeholder="eyJhbG..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <button
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-50 text-zinc-950 text-sm font-medium rounded-md hover:bg-zinc-200 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              Connect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {isRecording ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Universal Capture Active
              </p>
              {lastSync && (
                <p className="text-xs text-zinc-400 mt-2">
                  Last synced: {new Date(lastSync).toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <p className="text-sm text-zinc-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                Capture Paused
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Disabled by global pause or out of work hours.
              </p>
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 text-sm font-medium rounded-md hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
