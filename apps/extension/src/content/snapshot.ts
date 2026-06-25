export function takeSnapshot(): string | null {
  // Aggressively skip if password or payment fields exist
  const inputs = document.querySelectorAll('input');
  for (const input of Array.from(inputs)) {
    const type = input.type.toLowerCase();
    const name = (input.name || '').toLowerCase();
    if (type === 'password' || name.includes('card') || name.includes('ccv') || name.includes('credit')) {
      return null;
    }
  }

  // Get text, truncate to 2000 chars to save space
  const text = document.body.innerText || '';
  return text.slice(0, 2000);
}
