import type { Model } from '@lmspeed/models-core';
import en from '../messages/en.json';
import ru from '../messages/ru.json';
import zh from '../messages/zh.json';
export type Locale = 'en' | 'zh' | 'ru';
export const messages = { en, zh, ru };
export const localePath = (locale: Locale) =>
  locale === 'en' ? '/' : `/${locale}/`;
export function catalogueRows(models: Record<string, Model>) {
  return Object.values(models).sort(
    (a, b) =>
      (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') ||
      a.name.localeCompare(b.name, 'en'),
  );
}
export const tokens = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en');
export const parameters = (model: Model) =>
  model.parameters?.totalBillions == null
    ? '—'
    : `${Number(model.parameters.totalBillions.toPrecision(5))}B`;
export function searchText(model: Model, developer: string) {
  return [
    model.id,
    model.name,
    developer,
    ...Object.values(model.externalIds ?? {}).flat(),
  ]
    .join(' ')
    .toLocaleLowerCase('en');
}
