import { logoIndex } from '@lmspeed/models-publish';
export const GET = async () => Response.json(await logoIndex());
