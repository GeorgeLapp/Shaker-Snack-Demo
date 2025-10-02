import {
  ProductMatrixDTO,
  ProductMatrixItem,
  ProductMatrixUi,
} from '../../types/serverInterface/ProductMatrixDTO';

/**
 * Преобразует плоский DTO массива продуктов в двумерную матрицу для UI.
 *
 * Поведение
 *  - Сначала сортирует все элементы по cellNumber (возрастание).
 *  - Затем группирует элементы по rowNumber в Map, чтобы сохранить элементы одного ряда вместе.
 *  - В результате возвращает массив рядов (ProductMatrixUi), отсортированный по rowNumber (возрастание).
 *
 * Параметры
 *  @param dto ProductMatrixDTO — плоский массив элементов ProductMatrixItem, полученных с бэка.
 *
 * Возвращает
 *  ProductMatrixUi — двумерный массив, где каждый внутренний массив — это ряд (row) с элементами,
 *  упорядоченными по cellNumber.
 *
 * Замечания
 *  - Внутренняя сортировка по cellNumber выполняется по всему набору, поэтому в каждом ряду элементы
 *    будут в порядке возрастания cellNumber.
 *  - Если rowNumber не идут подряд (например, 1, 3, 5), результирующий массив будет содержать только
 *    существующие ряды в порядке 1, 3, 5. При необходимости можно заполнить отсутствующие ряды пустыми массивами.
 *  - Функция делает поверхностные копии массивов для явной иммутабельности. Если это не требуется,
 *    можно пушить элементы в существующие массивы для уменьшения аллокаций.
 */
export function toProductMatrixUi(dto: ProductMatrixDTO): ProductMatrixUi {
  // Сортируем по cellNumber (в пределах всего массива)
  const sorted = [...dto].sort((a, b) => a.cellNumber - b.cellNumber);

  // Группируем по rowNumber, при этом порядок рядов будет по возрастанию rowNumber
  const rowsMap = new Map<number, ProductMatrixItem[]>();
  for (const item of sorted) {
    const row = rowsMap.get(item.rowNumber);
    if (row) rowsMap.set(item.rowNumber, [...row, item]);
    else rowsMap.set(item.rowNumber, [item]);
  }

  // Превращаем Map в массив рядов, отсортированный по ключу rowNumber
  return Array.from(rowsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, items]) => items);
}
