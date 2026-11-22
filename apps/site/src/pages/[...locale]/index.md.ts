import type { APIRoute, GetStaticPaths } from 'astro';
import { type Locale, localePath } from '../../lib/catalogue';
import { catalogueMarkdown } from '../../lib/markdown';
export const getStaticPaths: GetStaticPaths = () => [
  { params: { locale: undefined }, props: { locale: 'en' } },
  { params: { locale: 'zh' }, props: { locale: 'zh' } },
  { params: { locale: 'ru' }, props: { locale: 'ru' } },
];
export const GET: APIRoute = ({ props }) => {
  const locale = props.locale as Locale;
  return new Response(catalogueMarkdown(locale), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      link: `<https://models.lmspeed.net${localePath(locale)}>; rel="canonical"`,
    },
  });
};
