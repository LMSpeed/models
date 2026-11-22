import { logoFor, routes, snapshot } from '@lmspeed/models-publish';
import type { APIRoute } from 'astro';
export const getStaticPaths = () =>
  [...routes].map(([modelId, id]) => ({ params: { modelId }, props: { id } }));
export const GET: APIRoute = async ({ props }) =>
  new Response((await logoFor(snapshot.data.models[props.id])).svg, {
    headers: { 'content-type': 'image/svg+xml' },
  });
