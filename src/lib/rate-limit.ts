/**
 * Rate limiter em memória (por chave — ex: IP ou identifier).
 * Limpa entradas expiradas automaticamente.
 */

const attempts = new Map<string, { count: number; firstAttempt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  // Limpa entradas expiradas a cada chamada (map pequeno, sem custo relevante)
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
  }

  const current = attempts.get(key);

  if (!current) {
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
