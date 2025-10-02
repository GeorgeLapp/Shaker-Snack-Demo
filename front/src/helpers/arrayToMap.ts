/**
 * Преобразует массив в объект, индексированный по ключу.
 *
 * Поведение по умолчанию (без keyFn): используется поле `id: number` у элементов.
 * - arrayToMap(array) -> Record<number, T> (один элемент на ключ, при дублировании — последнее значение выигрывает)
 *
 * Если передать `keyFn`, то ключи будут получены как `keyFn(item)` и
 * возвращаемый тип — `Record<K, T[]>` (группировка в массивы).
 *
 * Замечание: при размещении в объекте ключи будут приведены к строке (как в JS).
 */
export function arrayToMap<T extends { id: number }>(array: T[]): Record<number, T>;
export function arrayToMap<T, K extends PropertyKey>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]>;
export function arrayToMap<T extends { id: number }, K extends PropertyKey = number>(
  array: T[],
  keyFn?: (item: T) => K,
): Record<PropertyKey, any> {
  if (keyFn) {
    const result: Record<PropertyKey, T[]> = {};
    for (const item of array) {
      const key = keyFn(item) as PropertyKey;
      const bucket = result[key];
      if (bucket) bucket.push(item);
      else result[key] = [item];
    }
    return result as Record<K, T[]>;
  } else {
    const result: Record<number, T> = {};
    for (const item of array as T[]) {
      result[(item as any).id as number] = item;
    }
    return result as unknown as Record<number, T>;
  }
}
