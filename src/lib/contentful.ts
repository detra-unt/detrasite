// Cliente GraphQL para Contentful
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import type { Document } from '@contentful/rich-text-types';

// Configuración de Contentful
const SPACE_ID = import.meta.env.CONTENTFUL_SPACE_ID;
const ACCESS_TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;
const PREVIEW_TOKEN = import.meta.env.CONTENTFUL_PREVIEW_TOKEN;

const GRAPHQL_ENDPOINT = `https://graphql.contentful.com/content/v1/spaces/${SPACE_ID}`;

// Tipos de artículo y mapeo a rutas
export const ARTICLE_TYPES = {
  'ARTÍCULO ESTUDIANTIL': 'estudiantes',
  'ARTÍCULO DE INVITADO': 'invitados',
} as const;

export const ARTICLE_TYPE_LABELS = {
  'estudiantes': 'ARTÍCULO ESTUDIANTIL',
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
    items: Pick<Author, 'fullName' | 'academicDegree' | 'profilePicture'>[];
  };
  publishDate: string;
}

// Función helper para ejecutar queries GraphQL
async function fetchGraphQL<T>(
  query: string,
  preview = false
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${preview ? PREVIEW_TOKEN : ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  const json = await response.json();

  if (json.errors) {
    console.error('GraphQL Errors:', json.errors);
    throw new Error('Error fetching data from Contentful');
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

  const data = await fetchGraphQL<ArticlesResponse>(query, preview);

  return {
    articles: data.articleCollection.items,
    total: data.articleCollection.total,
  };
}

// Obtener artículos recientes (para la página principal)
export async function getRecentArticles(limit = 3): Promise<ArticlePreview[]> {
  const { articles } = await getArticles({ limit });
  return articles;
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

  const data = await fetchGraphQL<{
    estudiantes: { items: ArticlePreview[] };
    invitados: { items: ArticlePreview[] };
  }>(query);

  return [
    ...data.estudiantes.items,
    ...data.invitados.items,
  ];
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

  const data = await fetchGraphQL<ArticleResponse>(query, preview);

  return data.articleCollection.items[0] || null;
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

  const data = await fetchGraphQL<AllSlugsResponse>(query);

  return data.articleCollection.items.map((item) => ({
    slug: item.slug,
    tipo: getArticleTypeSlug(item.articleType),
  }));
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

  const data = await fetchGraphQL<ArticlesResponse>(queryByTitle);
  return data.articleCollection.items;
}

// Renderizar Rich Text a HTML
export function renderRichText(document: Document): string {
  return documentToHtmlString(document, {
    renderNode: {
      // Personalizar renderizado de nodos si es necesario
    },
  });
}

// Helper para formatear fecha
export function formatDate(dateString: string, locale = 'es-PE'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Helper para formatear fecha corta
export function formatShortDate(dateString: string, locale = 'es-PE'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

  try {
    const data = await fetchGraphQL<JuntaDirectivaResponse>(query);
    return data.juntaDirectivaCollection.items[0] || null;
  } catch (e) {
    console.error('Error fetching junta directiva:', e);
    return null;
  }
}
