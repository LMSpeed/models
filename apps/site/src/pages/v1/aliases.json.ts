import { snapshot } from '@lmspeed/models-publish';
export const GET = () => Response.json(snapshot.data.aliases);
