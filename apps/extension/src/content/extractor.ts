export function getConversationTitle(): string {
  try {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      let title = titleEl.textContent || '';
      if (title.endsWith(' - ChatGPT')) {
        title = title.substring(0, title.length - 10);
      }
      if (title !== 'ChatGPT' && title !== 'New chat' && title.trim() !== '') {
        return title;
      }
    }
    
    // Fallback if title is generic
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent?.trim() !== '') return h1.textContent!.trim();
  } catch (e) {
    console.warn('AutoEOD: Failed to parse title', e);
  }
  return 'Untitled Conversation';
}

export function getConversationId(): string | null {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)$/);
  return match ? match[1] : null;
}

export function getModelName(): string | undefined {
  try {
    // Model name is often in a specific header or dropdown.
    const modelDropdown = document.querySelector('button[aria-haspopup="menu"] .truncate, div.text-token-text-secondary.truncate');
    if (modelDropdown && modelDropdown.textContent) {
      return modelDropdown.textContent.trim();
    }
  } catch (e) {
    // Ignore
  }
  return undefined;
}

export function getWorkspace(): string | undefined {
  try {
    const workspaceEl = document.querySelector('[data-testid="workspace-name"]');
    if (workspaceEl && workspaceEl.textContent) {
      return workspaceEl.textContent.trim();
    }
  } catch(e) {
    // Ignore
  }
  return undefined;
}

export function extractMessages(): Array<{ id?: string; role: string; excerpt: string; timestamp?: string }> {
  try {
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    const messages: Array<{ id?: string; role: string; excerpt: string; timestamp?: string }> = [];

    messageElements.forEach(el => {
      const role = el.getAttribute('data-message-author-role') || 'unknown';
      const id = el.getAttribute('data-message-id') || undefined;
      let text = el.textContent || '';
      
      text = text.trim();
      const excerpt = text.length > 500 ? text.substring(0, 500) + '...' : text;
      
      const timestamp = new Date().toISOString(); // Fallback timestamp since ChatGPT DOM lacks explicit times

      if (excerpt && role) {
        messages.push({ id, role, excerpt, timestamp });
      }
    });

    return messages;
  } catch (e) {
    console.warn('AutoEOD: Failed to extract messages', e);
    return [];
  }
}
