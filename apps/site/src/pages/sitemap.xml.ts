import { snapshot } from '@lmspeed/models-publish';
export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/zh/', '/ru/'].map((path) => `<url><loc>https://models.lmspeed.net${path}</loc><lastmod>${snapshot.dataUpdatedAt}</lastmod></url>`).join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml' } },
  );
