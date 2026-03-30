// Cliente GraphQL para Contentful, núcleo de la integración de datos del sitio. Actúa como puente o cliente graphQL que conecta la aplicación con el CMS Contentful.
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'; //Función que convierte el json del richText de contentful en html
import type { Document } from '@contentful/rich-text-types'; //Tipar el contenido del richText. Evita errores o que sea reconocido de tipo any.
import { cached } from './cache'; //Funcion personalida que envuelve las consultas a la api. Guarda el resultado de las consultas temporalmente haciendo que la página cargue más rápido.

// Configuración de Contentful, asigna a las variables los valores de las variables de entorno.
const SPACE_ID = import.meta.env.CONTENTFUL_SPACE_ID;
const ACCESS_TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;
const PREVIEW_TOKEN = import.meta.env.CONTENTFUL_PREVIEW_TOKEN;

const GRAPHQL_ENDPOINT = `https://graphql.contentful.com/content/v1/spaces/${SPACE_ID}`; //Connection string con contentful en modo graphql

// ============================================================================
// SISTEMA DE ERRORES PERSONALIZADO
// ============================================================================

/** Códigos de error para identificar el tipo de fallo */
export const ContentfulErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  HTTP_ERROR: 'HTTP_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  GRAPHQL_ERROR: 'GRAPHQL_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
} as const;

export type ContentfulErrorCodeType = typeof ContentfulErrorCode[keyof typeof ContentfulErrorCode];

/** Error base para todas las operaciones de Contentful */
export class ContentfulError extends Error {
  public readonly code: ContentfulErrorCodeType;
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: ContentfulErrorCodeType,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'ContentfulError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
    this.originalError = options?.originalError;

    // Mantiene el stack trace correcto en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContentfulError);
    }
  }
}

/** Configuración para fetchGraphQL */
interface FetchGraphQLOptions {
  /** Número de reintentos para errores transitorios (default: 2) */
  retries?: number;
  /** Delay inicial entre reintentos en ms (default: 1000) */
  retryDelay?: number;
  /** Timeout de la petición en ms (default: 10000) */
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<FetchGraphQLOptions> = {
  retries: 2,
  retryDelay: 1000,
  timeout: 10000,
};

/** Utilidad para esperar un tiempo determinado */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/** Determina si un error HTTP es recuperable mediante reintentos */
function isRetryableHttpStatus(status: number): boolean {
  // 408: Request Timeout, 429: Too Many Requests, 5xx: Server errors
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

/** Crea un error apropiado según el código de estado HTTP */
function createHttpError(status: number, statusText: string): ContentfulError {
  if (status === 401 || status === 403) {
    return new ContentfulError(
      `Error de autenticación con Contentful (${status}): Verifica CONTENTFUL_DELIVERY_TOKEN o CONTENTFUL_PREVIEW_TOKEN`,
      ContentfulErrorCode.AUTH_ERROR,
      { statusCode: status, isRetryable: false }
    );
  }

  if (status === 429) {
    return new ContentfulError(
      'Límite de peticiones excedido en Contentful. Intenta de nuevo más tarde.',
      ContentfulErrorCode.RATE_LIMIT_ERROR,
      { statusCode: status, isRetryable: true }
    );
  }

  return new ContentfulError(
    `Error HTTP ${status}: ${statusText}`,
    ContentfulErrorCode.HTTP_ERROR,
    { statusCode: status, isRetryable: isRetryableHttpStatus(status) }
  );
}

// Tipos de artículo y mapeo a rutas
export const ARTICLE_TYPES = {
  'ARTÍCULO ESTUDIANTIL': 'estudiantes', //Mapeo del tipo de artículo de contentful a astro
  'ARTÍCULO DE INVITADO': 'invitados',
} as const;

export const ARTICLE_TYPE_LABELS = {
  'estudiantes': 'ARTÍCULO ESTUDIANTIL', //mapeo del tipo de artículo de astro a contentful
  'invitados': 'ARTÍCULO DE INVITADO',
} as const;

export type ArticleTypeValue = keyof typeof ARTICLE_TYPES;
export type ArticleTypeSlug = typeof ARTICLE_TYPES[ArticleTypeValue];

// Interfaces TypeScript
export interface ContentfulAsset {
  url: string;
  title: string;
  description?: string;
  width?: number;
  height?: number;
}

export interface Author {
  sys: { id: string };
  fullName: string;
  academicDegree: 'Estudiante' | 'Bachiller' | 'Abogado' | 'Magíster' | 'Doctor';
  profilePicture?: ContentfulAsset;
  aboutAuthor?: string;
}

export interface Article {
  sys: { id: string; publishedAt: string };
  title: string;
  slug: string;
  articleType: ArticleTypeValue;
  coverImage: ContentfulAsset;
  authorsCollection: {
    items: Author[];
  };
  publishDate: string;
  content: {
    json: Document;
  };
  referencias?: {
    json: Document;
  };
}

// Junta Directiva
export interface JuntaDirectiva {
  description: string;
  managmentYear: number;
  juntaActiva: boolean;
  fotoGeneral: ContentfulAsset;
}

export interface ArticlePreview {
  sys: { id: string };
  title: string;
  slug: string;
  articleType: ArticleTypeValue;
  coverImage: ContentfulAsset;
  authorsCollection: {
    items: Pick<Author, 'fullName' | 'academicDegree' | 'profilePicture'>[]; //De author solo toma el nombre, grado académico y foto de perfil.
  };
  publishDate: string;
}

// ============================================================================
// FUNCIÓN PRINCIPAL: fetchGraphQL con manejo robusto de errores
// ============================================================================

/**
 * Ejecuta queries GraphQL contra Contentful con manejo completo de errores de red.
 * 
 * Características:
 * - Manejo de errores de red (sin conexión, DNS, etc.)
 * - Timeout configurable
 * - Reintentos automáticos para errores transitorios
 * - Errores tipados y descriptivos
 * 
 * @param query - La consulta GraphQL a ejecutar
 * @param preview - Si usar el token de preview (contenido no publicado)
 * @param options - Configuración opcional (retries, timeout, etc.)
 * @returns Los datos de la consulta
 * @throws {ContentfulError} Error tipado con información detallada
 */
async function fetchGraphQL<T>(
  query: string,
  preview = false,
  options: FetchGraphQLOptions = {}
): Promise<T> {
  const { retries, retryDelay, timeout } = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: ContentfulError | null = null;
  
  // Intenta la petición con reintentos para errores transitorios
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await executeGraphQLRequest<T>(query, preview, timeout);
      return result;
    } catch (error) {
      // Convierte a ContentfulError si no lo es
      lastError = error instanceof ContentfulError 
        ? error 
        : new ContentfulError(
            'Error inesperado al conectar con Contentful',
            ContentfulErrorCode.NETWORK_ERROR,
            { isRetryable: true, originalError: error as Error }
          );
      
      // Si no es recuperable o es el último intento, no reintenta
      if (!lastError.isRetryable || attempt === retries) {
        break;
      }
      
      // Espera con backoff exponencial antes del próximo intento
      const delay = retryDelay * Math.pow(2, attempt);
      console.warn(
        `[Contentful] Reintento ${attempt + 1}/${retries} después de ${delay}ms - ${lastError.code}`
      );
      await sleep(delay);
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error('[Contentful] Error después de todos los reintentos:', lastError);
  throw lastError;
}

/**
 * Ejecuta una única petición GraphQL (sin reintentos).
 * Separa la lógica de la petición de la lógica de reintentos.
 */
async function executeGraphQLRequest<T>(
  query: string,
  preview: boolean,
  timeout: number
): Promise<T> {
  // Crear AbortController para timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  let response: Response;
  
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preview ? PREVIEW_TOKEN : ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch (error) {
    // Manejo de errores de red
    if (error instanceof Error) {
      // Timeout (AbortError)
      if (error.name === 'AbortError') {
        throw new ContentfulError(
          `Timeout: La petición a Contentful excedió ${timeout}ms`,
          ContentfulErrorCode.TIMEOUT_ERROR,
          { isRetryable: true, originalError: error }
        );
      }
      
      // TypeError suele indicar problemas de red (DNS, conexión, etc.)
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new ContentfulError(
          `Error de red al conectar con Contentful: ${error.message}`,
          ContentfulErrorCode.NETWORK_ERROR,
          { isRetryable: true, originalError: error }
        );
      }
    }
    
    // Error desconocido
    throw new ContentfulError(
      'Error desconocido al conectar con Contentful',
      ContentfulErrorCode.NETWORK_ERROR,
      { isRetryable: true, originalError: error as Error }
    );
  } finally {
    clearTimeout(timeoutId);
  }
  
  // Verificar código de estado HTTP
  if (!response.ok) {
    throw createHttpError(response.status, response.statusText);
  }
  
  // Parsear respuesta JSON
  let json: { data?: T; errors?: Array<{ message: string }> };
  
  try {
    json = await response.json();
  } catch (error) {
    throw new ContentfulError(
      'Error al parsear la respuesta de Contentful (JSON inválido)',
      ContentfulErrorCode.PARSE_ERROR,
      { isRetryable: false, originalError: error as Error }
    );
  }
  
  // Verificar errores de GraphQL
  if (json.errors && json.errors.length > 0) {
    const errorMessages = json.errors.map(e => e.message).join('; ');
    console.error('[Contentful] GraphQL Errors:', json.errors);
    throw new ContentfulError(
      `Error en consulta GraphQL: ${errorMessages}`,
      ContentfulErrorCode.GRAPHQL_ERROR,
      { isRetryable: false }
    );
  }
  
  // Verificar que hay datos
  if (!json.data) {
    throw new ContentfulError(
      'Respuesta de Contentful sin datos',
      ContentfulErrorCode.PARSE_ERROR,
      { isRetryable: false }
    );
  }
  
  return json.data;
}

// Helper para obtener la ruta del tipo de artículo
export function getArticleTypeSlug(articleType: ArticleTypeValue): ArticleTypeSlug {
  return ARTICLE_TYPES[articleType];
}

// Helper para obtener el tipo de artículo desde el slug
export function getArticleTypeFromSlug(slug: ArticleTypeSlug): ArticleTypeValue | undefined {
  return ARTICLE_TYPE_LABELS[slug];
}

// Helper para generar la URL completa del artículo
export function getArticleUrl(article: Pick<Article, 'slug' | 'articleType'>): string {
  const typeSlug = getArticleTypeSlug(article.articleType);
  return `/publicaciones/${typeSlug}/${article.slug}`;
}

// Fragmento común para preview de artículos
const ARTICLE_PREVIEW_FRAGMENT = `
  sys { id }
  title
  slug
  articleType
  coverImage {
    url
    title
    description
    width
    height
  }
  authorsCollection(limit: 2) {
    items {
      fullName
      academicDegree
      profilePicture {
        url
        title
      }
    }
  }
  publishDate
`;

// Obtener todos los artículos (preview) con filtros opcionales
interface GetArticlesOptions {
  limit?: number;
  skip?: number;
  articleType?: ArticleTypeValue;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  preview?: boolean;
}

interface ArticlesResponse {
  articleCollection: {
    total: number;
    items: ArticlePreview[];
  };
}

export async function getArticles(options: GetArticlesOptions = {}): Promise<{
  articles: ArticlePreview[];
  total: number;
}> {
  const {
    limit = 10,
    skip = 0,
    articleType,
    searchQuery,
    startDate,
    endDate,
    preview = false,
  } = options;

  // Construir filtros
  const filters: string[] = [];

  if (articleType) {
    filters.push(`articleType: "${articleType}"`);
  }

  if (searchQuery) {
    // Búsqueda por título o nombre de autor
    filters.push(`OR: [
      { title_contains: "${searchQuery}" },
      { authorsCollection_exists: true }
    ]`);
  }

  if (startDate) {
    filters.push(`publishDate_gte: "${startDate}"`);
  }

  if (endDate) {
    filters.push(`publishDate_lte: "${endDate}"`);
  }

  const whereClause = filters.length > 0 ? `where: { ${filters.join(', ')} }` : '';

  const query = `
    query {
      articleCollection(
        limit: ${limit}
        skip: ${skip}
        order: publishDate_DESC
        ${whereClause}
      ) {
        total
        items {
          ${ARTICLE_PREVIEW_FRAGMENT}
        }
      }
    }
  `;

  // Cache key única por combinación de parámetros
  const cacheKey = `articles:${limit}:${skip}:${articleType ?? ''}:${searchQuery ?? ''}:${startDate ?? ''}:${endDate ?? ''}:${preview}`;

  return cached(cacheKey, async () => {
    const data = await fetchGraphQL<ArticlesResponse>(query, preview);
    return {
      articles: data.articleCollection.items,
      total: data.articleCollection.total,
    };
  });
}

// Obtener artículos recientes (para la página principal)
export async function getRecentArticles(limit = 3): Promise<ArticlePreview[]> {
  const { articles } = await getArticles({ limit });
  return articles;
  // Hereda el caché de getArticles automáticamente
}

// Obtener artículos destacados (los más recientes de cada tipo)
export async function getFeaturedArticles(): Promise<ArticlePreview[]> {
  const query = `
    query {
      estudiantes: articleCollection(
        limit: 1
        order: publishDate_DESC
        where: { articleType: "ARTÍCULO ESTUDIANTIL" }
      ) {
        items {
          ${ARTICLE_PREVIEW_FRAGMENT}
        }
      }
      invitados: articleCollection(
        limit: 1
        order: publishDate_DESC
        where: { articleType: "ARTÍCULO DE INVITADO" }
      ) {
        items {
          ${ARTICLE_PREVIEW_FRAGMENT}
        }
      }
    }
  `;

  return cached('featured-articles', async () => {
    const data = await fetchGraphQL<{
      estudiantes: { items: ArticlePreview[] };
      invitados: { items: ArticlePreview[] };
    }>(query);
    return [
      ...data.estudiantes.items,
      ...data.invitados.items,
    ];
  });
}

// Obtener un artículo completo por slug y tipo
interface ArticleResponse {
  articleCollection: {
    items: Article[];
  };
}

export async function getArticleBySlug(
  slug: string,
  articleTypeSlug: ArticleTypeSlug,
  preview = false
): Promise<Article | null> {
  const articleType = getArticleTypeFromSlug(articleTypeSlug);

  if (!articleType) {
    return null;
  }

  const query = `
    query {
      articleCollection(
        limit: 1
        where: {
          slug: "${slug}"
          articleType: "${articleType}"
        }
      ) {
        items {
          sys { id publishedAt }
          title
          slug
          articleType
          coverImage {
            url
            title
            description
            width
            height
          }
          authorsCollection(limit: 2) {
            items {
              sys { id }
              fullName
              academicDegree
              profilePicture {
                url
                title
              }
              aboutAuthor
            }
          }
          publishDate
          content {
            json
          }
          referencias {
            json
          }
        }
      }
    }
  `;

  return cached(`article:${slug}:${articleTypeSlug}:${preview}`, async () => {
    const data = await fetchGraphQL<ArticleResponse>(query, preview);
    return data.articleCollection.items[0] || null;
  });
}

// Obtener todos los slugs de artículos (para generación estática)
interface AllSlugsResponse {
  articleCollection: {
    items: Array<{ slug: string; articleType: ArticleTypeValue }>;
  };
}

export async function getAllArticleSlugs(): Promise<
  Array<{ slug: string; tipo: ArticleTypeSlug }>
> {
  const query = `
    query {
      articleCollection(limit: 1000) {
        items {
          slug
          articleType
        }
      }
    }
  `;

  return cached('all-article-slugs', async () => {
    const data = await fetchGraphQL<AllSlugsResponse>(query);
    return data.articleCollection.items.map((item) => ({
      slug: item.slug,
      tipo: getArticleTypeSlug(item.articleType),
    }));
  });
}

// Búsqueda de artículos por título o autor
export async function searchArticles(
  searchQuery: string,
  limit = 10
): Promise<ArticlePreview[]> {
  // Primero buscamos por título
  const queryByTitle = `
    query {
      articleCollection(
        limit: ${limit}
        order: publishDate_DESC
        where: { title_contains: "${searchQuery}" }
      ) {
        items {
          ${ARTICLE_PREVIEW_FRAGMENT}
        }
      }
    }
  `;

  // Cache key única por combinación de parámetros de búsqueda
  const cacheKey = `search:${searchQuery}:${limit}`;

  return cached(cacheKey, async () => {
    const data = await fetchGraphQL<ArticlesResponse>(queryByTitle);
    return data.articleCollection.items;
  });
}

//VersionDefinitiva del formateador de fechas
export type DateFormatSize = 'short' | 'long';

export function formatDateBySize(dateString: string, size : DateFormatSize = 'long', locale = 'es-PE') : string{
  try {
    const date = new Date(dateString);

    //Verificamos si la fecha es válida antes de formatear
    if(isNaN(date.getTime())){
      return 'Fecha no disponible';
    }

    return date.toLocaleDateString(locale, {
      timeZone : 'America/Lima',
      year : 'numeric',
      month : size === 'short' ? 'short' : 'long',
      day : 'numeric'
    });
  } catch (error) {
    console.error('Error formateando fecha: ', dateString);
    return 'Fecha no disponible';
  }
}

// Helper para obtener iniciales del autor
export function getAuthorInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Obtener la junta directiva activa
interface JuntaDirectivaResponse {
  juntaDirectivaCollection: {
    items: JuntaDirectiva[];
  };
}

export async function getActiveJuntaDirectiva(): Promise<JuntaDirectiva | null> {
  const query = `
    query {
      juntaDirectivaCollection(
        limit: 1
        where: { juntaActiva: true }
      ) {
        items {
          description
          managmentYear
          juntaActiva
          fotoGeneral {
            url
            title
            description
            width
            height
          }
        }
      }
    }
  `;

  return cached('active-junta-directiva', async () => {
    try {
      const data = await fetchGraphQL<JuntaDirectivaResponse>(query);
      return data.juntaDirectivaCollection.items[0] || null;
    } catch (e) {
      console.error('Error fetching junta directiva:', e);
      return null;
    }
  });
}
