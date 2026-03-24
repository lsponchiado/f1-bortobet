/**
 * Rate limiter em memória (por chave — ex: IP ou identifier).
 * Limpa entradas expiradas periodicamente para evitar memory leak.
 */

const attempts = new Map<string, { count: number; firstAttempt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ENTRIES = 10_000;

// Cleanup periódico
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS) attempts.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
  }

  const current = attempts.get(key);

  if (!current) {
    // Proteção contra memory exhaustion
    if (attempts.size >= MAX_ENTRIES) return { allowed: false, retryAfterMs: WINDOW_MS };
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  if (current.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - current.firstAttempt);
    return { allowed: false, retryAfterMs };
  }

  current.count++;
  return { allowed: true };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
