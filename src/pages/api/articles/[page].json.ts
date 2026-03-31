// API endpoints prerenderizados para paginación de artículos
// En modo estático, generamos un archivo JSON por cada "página" posible
import type { APIRoute, GetStaticPaths } from 'astro';
import { getArticles, getArticleUrl, getArticleTypeSlug, formatDateBySize, getAuthorInitials } from '../../../lib/contentful';
import type { ArticlePreview } from '../../../lib/contentful';

export const prerender = true;

const ARTICLES_PER_PAGE = 6;

// Genera el HTML de una tarjeta de artículo (variante default)
function renderArticleCard(article: ArticlePreview): string {
  const articleUrl = getArticleUrl(article);
  const typeSlug = getArticleTypeSlug(article.articleType);
  const formattedDate = formatDateBySize(article.publishDate, 'short');
  const authors = article.authorsCollection.items;

  const authorsHtml = authors
    .map((author) => {
      if (author.profilePicture) {
        return `
          <div class="relative group/avatar">
            <img 
              src="${author.profilePicture.url}"
              alt="${author.fullName}"
              width="40"
              height="40"
              class="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm transition-transform duration-300 group-hover/avatar:scale-110"
              loading="lazy"
              decoding="async"
            />
          </div>
        `;
      }
      return `
        <span class="w-10 h-10 rounded-full bg-gradient-to-br from-[#5E0B15] to-[#5E0B15]/80 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white shadow-sm">
          ${getAuthorInitials(author.fullName)}
        </span>
      `;
    })
    .join('');

  const authorsNames = authors.map((a) => a.fullName).join(', ');
  const badgeClass =
    typeSlug === 'estudiantes'
      ? 'bg-[#fcfaec]/95 text-[#5E0B15]'
      : 'bg-[#5E0B15]/95 text-white';
  const badgeText = typeSlug === 'estudiantes' ? 'Estudiantes' : 'Invitados';

  return `
    <div
      data-article
      data-title="${article.title.replace(/"/g, '&quot;')}"
      data-authors="${authorsNames.replace(/"/g, '&quot;')}"
      data-type="${typeSlug}"
      data-date="${article.publishDate}"
      class="animate-fade-in-up"
    >
      <article
        class="group relative block bg-white rounded-sm overflow-hidden transition-all duration-500 shadow-lg hover:shadow-2xl hover:shadow-[#5E0B15]/15 hover:-translate-y-2 border border-[#5E0B15]/0 hover:border-[#5E0B15]/10"
      >
        <a
          href="${articleUrl}"
          tabindex="-1"
          class="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5E0B15]"
        ></a>

        <div class="relative aspect-[16/10] overflow-hidden bg-[#1c1c14]">
          <img 
            src="${article.coverImage.url}"
            alt="${article.coverImage.title || article.title}"
            width="${article.coverImage.width || 800}"
            height="${article.coverImage.height || 500}"
            class="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
          
          <div class="absolute inset-0 bg-gradient-to-t from-[#1c1c14]/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div class="absolute top-4 left-4">
            <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-label font-bold uppercase tracking-[0.12em] shadow-md backdrop-blur-sm ${badgeClass}">
              <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
              ${badgeText}
            </span>
          </div>
          
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5E0B15] via-[#5E0B15]/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>
        
        <div class="p-6 md:p-8">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-px bg-[#5E0B15]/40 group-hover:w-12 group-hover:bg-[#5E0B15] transition-all duration-300"></div>
            <time datetime="${article.publishDate}" class="font-label text-xs text-[#1c1c14]/60 uppercase tracking-[0.15em]">
              ${formattedDate}
            </time>
          </div>
          
          <div class="mb-6 min-h-[5.75rem]">
            <h3 class="font-headline text-xl md:text-2xl font-bold text-[#1c1c14] leading-snug transition-colors duration-300 group-hover:text-[#5E0B15] line-clamp-3">
              <a href="${articleUrl}" class="decoration-[#5E0B15]/45 underline-offset-4 hover:underline">
                ${article.title}
              </a>
            </h3>
          </div>
          
          <div class="flex items-center gap-4 pt-5 border-t border-[#5E0B15]/10">
            <div class="flex -space-x-2">
              ${authorsHtml}
            </div>
            <div class="min-w-0 flex-grow">
              <p class="font-headline font-semibold text-sm text-[#1c1c14] truncate">
                ${authorsNames}
              </p>
              <p class="font-label text-xs text-[#1c1c14]/50 uppercase tracking-wider mt-0.5">
                ${authors.length === 1 ? 'Autor' : 'Autores'}
              </p>
            </div>
            
            <div class="shrink-0">
              <span class="material-symbols-outlined text-[#5E0B15]/40 group-hover:text-[#5E0B15] transition-colors duration-300">chevron_right</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  `;
}

// Generamos rutas estáticas para cada página posible
export const getStaticPaths: GetStaticPaths = async () => {
  // Obtener total de artículos
  const { total } = await getArticles({ limit: 1 });
  const totalPages = Math.ceil(total / ARTICLES_PER_PAGE);

  // Generar rutas para cada página (empezando desde página 2)
  // La página 1 está en el SSG inicial de publicaciones.astro
  const paths = [];
  for (let page = 2; page <= totalPages; page++) {
    paths.push({ params: { page: String(page) } });
  }

  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  const page = parseInt(params.page || '2', 10);
  const skip = (page - 1) * ARTICLES_PER_PAGE;

  try {
    const { articles, total } = await getArticles({
      limit: ARTICLES_PER_PAGE,
      skip,
    });

    // Generar HTML de las tarjetas
    const articlesHtml = articles.map(renderArticleCard).join('');

    return new Response(
      JSON.stringify({
        html: articlesHtml,
        articles: articles.map((a) => ({
          id: a.sys.id,
          title: a.title,
          authors: a.authorsCollection.items.map((x) => x.fullName).join(', '),
          type: getArticleTypeSlug(a.articleType),
          date: a.publishDate,
        })),
        page,
        total,
        hasMore: skip + articles.length < total,
        loaded: skip + articles.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching articles:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al cargar artículos',
        html: '',
        articles: [],
        page,
        total: 0,
        hasMore: false,
        loaded: 0,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
