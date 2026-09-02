// apps/worker/src/lib/observability/redaction.ts
const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|secret|token|accessToken|refreshToken|accessTokenEnc|refreshTokenEnc|authorization|cookie|set-cookie|apiKey|api_key|clientSecret|client_secret|encryptionKey|encryption_key|jwtSecret|jwt_secret|privateKey|private_key|githubToken|github_token|openaiApiKey|openai_key)$/i;

export function redactSensitiveData(target: any, depth = 0): any {
  if (target === null || target === undefined) return target;
  if (typeof target === 'string') {
    if (target.toLowerCase().startsWith('bearer ')) return 'Bearer [REDACTED]';
    return target;
  }
  if (typeof target !== 'object' || depth > 5) return target;
  if (Array.isArray(target)) return target.map((i) => redactSensitiveData(i, depth + 1));

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(target)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value, depth + 1);
    }
  }
  return result;
}
