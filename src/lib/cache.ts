/**
 * Caché en memoria del lado del servidor con TTL y request coalescing.
 * 
 * Comportamiento por entorno:
 * - Dev: El caché persiste entre recargas del servidor, evitando llamadas
 *   redundantes a Contentful mientras el TTL no expire.
 * - Producción (SSG build): El caché vive durante todo el proceso de build.
 *   Múltiples páginas que piden los mismos datos reutilizan la misma petición.
 *   El request coalescing es CRÍTICO aquí: evita llamadas duplicadas cuando
 *   Astro genera múltiples páginas en paralelo.
 * 
 * El Map se reinicia en cada deploy, pero eso es correcto para SSG ya que
 * los datos se embeben estáticamente en el HTML generado.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Store de valores ya resueltos con TTL */
const store = new Map<string, CacheEntry<unknown>>();

/** 
 * Store de promesas en vuelo (request coalescing).
 * Si múltiples llamadas piden la misma key simultáneamente,
 * todas comparten la misma Promise en lugar de disparar N requests.
 */
const inflight = new Map<string, Promise<unknown>>();

/** TTL por defecto: 5 minutos (suficiente para dev y builds largos) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Ejecuta una función async con caché y deduplicación de requests en vuelo.
 * 
 * @param key - Identificador único para esta consulta
 * @param fn - Función async que obtiene los datos (solo se ejecuta si no hay caché)
 * @param ttlMs - Tiempo de vida del caché en ms (default: 5 min)
 * @returns El valor cacheado o el resultado de ejecutar fn()
 * 
 * @example
 * ```ts
 * const articles = await cached('all-articles', () => fetchArticles());
 * ```
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  // 1. Cache hit: devolver valor si no ha expirado
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  // 2. Request coalescing: si ya hay una petición en vuelo para esta key,
  //    reutilizarla en lugar de disparar otra llamada duplicada
  const existingRequest = inflight.get(key);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  // 3. Cache miss y sin petición en vuelo: ejecutar la función
  const promise = fn()
    .then((value) => {
      // Guardar en caché con TTL
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      // Limpiar de inflight ya que completó
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      // Limpiar de inflight en caso de error para permitir reintentos
      inflight.delete(key);
      throw err;
    });

  // Registrar como petición en vuelo
  inflight.set(key, promise);
  
  return promise;
}

/**
 * Invalida una entrada específica del caché.
 * También cancela cualquier petición en vuelo para esa key.
 */
export function invalidate(key: string): void {
  store.delete(key);
  inflight.delete(key);
}

/**
 * Invalida todo el caché y cancela todas las peticiones en vuelo.
 */
export function invalidateAll(): void {
  store.clear();
  inflight.clear();
}

/**
 * Obtiene estadísticas del caché (útil para debugging/logging).
 * En producción SSG, esto puede loguearse al final del build.
 */
export function getCacheStats(): {
  cachedEntries: number;
  inflightRequests: number;
  keys: string[];
} {
  return {
    cachedEntries: store.size,
    inflightRequests: inflight.size,
    keys: Array.from(store.keys()),
  };
}
