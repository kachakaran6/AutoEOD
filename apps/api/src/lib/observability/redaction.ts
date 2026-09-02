// apps/api/src/lib/observability/redaction.ts
// Production-grade sensitive data redactor and sanitizer

const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|secret|token|accessToken|refreshToken|accessTokenEnc|refreshTokenEnc|authorization|cookie|set-cookie|apiKey|api_key|clientSecret|client_secret|encryptionKey|encryption_key|jwtSecret|jwt_secret|privateKey|private_key|githubToken|github_token|openaiApiKey|openai_key)$/i;

const REDACTED_STRING = '[REDACTED]';
const MAX_STRING_LENGTH = 10000; // Limit huge strings
const MAX_OBJECT_DEPTH = 6; // Limit recursion

/**
 * Recursively redacts sensitive keys from objects, arrays, and headers
 */
export function redactSensitiveData(target: any, depth = 0): any {
  if (target === null || target === undefined) return target;

  if (typeof target === 'string') {
    // Redact Bearer token strings
    if (target.toLowerCase().startsWith('bearer ')) {
      return 'Bearer [REDACTED]';
    }
    // Limit very long user strings
    if (target.length > MAX_STRING_LENGTH) {
      return target.substring(0, MAX_STRING_LENGTH) + '... [TRUNCATED]';
    }
    return target;
  }

  if (typeof target !== 'object') return target;

  if (depth > MAX_OBJECT_DEPTH) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (Array.isArray(target)) {
    return target.map((item) => redactSensitiveData(item, depth + 1));
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(target)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED_STRING;
    } else if (key.toLowerCase() === 'headers' && typeof value === 'object' && value !== null) {
      result[key] = redactHeaders(value);
    } else {
      result[key] = redactSensitiveData(value, depth + 1);
    }
  }

  return result;
}

/**
 * Specifically scrubs HTTP header objects
 */
export function redactHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'set-cookie' ||
      lowerKey === 'x-api-key' ||
      lowerKey === 'token'
    ) {
      sanitized[key] = REDACTED_STRING;
    } else {
      sanitized[key] = typeof value === 'string' && value.length > 500 ? value.slice(0, 500) + '...' : value;
    }
  }
  return sanitized;
}

/**
 * Masks email address for privacy (e.g. j***n@example.com)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}
