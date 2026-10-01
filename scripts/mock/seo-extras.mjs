/**
 * The SEO-phase members of the product and listing `Seo` blocks in the mock (breadcrumbs, structuredData,
 * pagination, openGraph), the way the backend builds them (SeoFacts). Used by product.mjs and catalog.mjs;
 * no imports, so those modules and seo.mjs can share it without an import cycle.
 */
const plain = (value) => (typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null : null);

/** Home first, the page last and not a link (contract Seo.breadcrumbs). */
function crumbs(list) {
  return list.map((crumb, index) => ({ label: crumb.label, target: index === list.length - 1 ? null : crumb.target }));
}

/** `Seo` members of a product page (ProductDetails as product.mjs builds it). */
export function productSeoExtras(details) {
  const { product } = details;
  const AVAILABILITY = { available: 'in_stock', out_of_stock: 'out_of_stock', coming_soon: 'out_of_stock' };
  return {
    breadcrumbs: crumbs(details.breadcrumbs),
    structuredData: {
      product: {
        schemaType: 'Product',
        name: product.name,
        description: plain(details.summary?.html),
        sku: details.sku,
        brand: product.brand?.name ?? null,
        images: details.gallery.map((image) => image.url),
        price: product.price ? product.price.amount : null,
        currency: product.price ? product.price.currency : null,
        availability: AVAILABILITY[details.availability.status] ?? 'out_of_stock',
        rating: product.rating,
        category: details.breadcrumbs.length > 2 ? details.breadcrumbs[1].label : null,
      },
    },
    pagination: null,
    openGraph: { title: product.name, description: null, image: details.gallery[0]?.url ?? null, type: 'product' },
  };
}

/** `Seo` members of a listing page (scope and page as catalog.mjs builds them). */
export function listingSeoExtras(scope, items, page, totalPages) {
  return {
    breadcrumbs: crumbs(scope.crumbs),
    structuredData: {
      collection: {
        name: scope.title,
        description: plain(scope.description?.html),
        items: items.map((card) => ({ name: card.name, target: card.target, image: card.image?.url ?? null })),
      },
    },
    pagination: totalPages > 1 ? { prev: page > 1 ? Math.min(page - 1, totalPages) : null, next: page < totalPages ? page + 1 : null } : null,
    openGraph: { title: null, description: null, image: scope.image?.url ?? items[0]?.image?.url ?? null, type: 'website' },
  };
}

