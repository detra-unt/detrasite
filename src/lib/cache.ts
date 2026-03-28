/**
 * Caché en memoria del lado del servidor con TTL.
 * En producción (SSG) Astro genera las páginas una vez — este caché
 * principalmente ayuda en modo dev, donde cada petición re-ejecuta el
 * script del frontmatter.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>(); //Store es la memoria donde se guardarán las cosas en el lado del desarrollo.

/** TTL por defecto: 5 minutos (dev) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function cached<T>(
  key: string,
  fn: () => Promise<T>, //Es un callback porque la función no se quiere ejecutar siempre, sino cuando no hay caché o el TTL ya expiró.
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidate(key: string) {
  store.delete(key);
}

export function invalidateAll() {
  store.clear();
}
