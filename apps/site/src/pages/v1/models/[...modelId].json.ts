import { routes, snapshot } from '@lmspeed/models-publish';
import type { APIRoute } from 'astro';
export const getStaticPaths = () =>
  [...routes].map(([modelId, id]) => ({ params: { modelId }, props: { id } }));
export const GET: APIRoute = ({ props }) =>
  Response.json(snapshot.data.models[props.id]);
