import { useMemo, useState } from 'react';

/**
 * Интерфейс props компонента useSelectableList
 *
 * Параметр типа T - объект с обязательным полем id типа number
 */
type UseSelectableListProps<T extends { id: number }> = {
  /**
   * Массив элементов списка
   */
  items: T[];
  /**
   * Выбранные элементы
   */
  prevSelectedItems: number[] | null | undefined;
};

/**
 * Тип возвращаемого значения функцией useSelectableList
 *
 * Параметры типов:
 *   T - исходный элемент массива
 *   R - расширенный элемент массива с дополнительным полем isSelected
 */
type ReturnType<T extends { id: number }, R extends T & { isSelected: boolean }> = {
  /**
   * Массив элементов с добавлением поля isSelected
   */
  items: R[];
  /**
   * Выбранные автоматы
   */
  selectedMachines: number[] | null;
  /**
   * Функция для получения уникального ключа элемента
   *
   * @param r {R} Элемент
   */
  getItemKey: (r: R) => string;
  /**
   * Функция проверки выбранного состояния элемента
   *
   * @param r {R} Элемент
   */
  getItemSelected: (r: R) => boolean;
  /**
   * Обработчик изменения выбора элемента
   *
   * @param id {number} id
   */
  onChange: (id: number) => () => void;
};

/**
 * Хук для создания селектируемого списка элементов
 *
 * @template T - тип объектов в списке с обязательным полем id
 * @template R - тип расширенных объектов с добавлением поля isSelected
 *
 * @param {UseSelectableListProps<T>} params - входные параметры
 * @returns {ReturnType<T, R>} Объект с элементами списка и методами взаимодействия
 */
export function useSelectableList<T extends { id: number }, R extends T & { isSelected: boolean }>({
  items,
  prevSelectedItems,
}: UseSelectableListProps<T>): ReturnType<T, R> {
  /**
   * Создаем состояние selectedMap - мапа выбранных элементов.
   * Используем useState с начальным значением:
   *   - инициализируем пустой объект
   *   - добавляем в него ключи (ID элементов), отмечаем выбранные элементы
   */
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>(() => {
    const initialMap: Record<number, boolean> = {}; // Пустой объект для хранения выбранных элементов
    (prevSelectedItems || []).forEach((id) => {
      initialMap[id] = true; // Отмечаем каждый переданный ID как не выбранный
    });
    return initialMap; // Возвращаем начальное значение мапы
  });

  /**
   * Мемоизируем массив элементов с полями isSelected
   * Для каждого элемента проверяем его статус в selectedMap
   */
  const itemsWithSelection = useMemo(
    () =>
      items.map(
        (item) =>
          ({
            ...item, // Копируем исходный элемент
            isSelected: selectedMap[item.id], // Добавляем поле isSelected
          }) as R,
      ), // Приводим тип к требуемому типу R
    [items, selectedMap], // Перезапускаем мемоизацию при изменении items или selectedMap
  );

  const selectedItems = useMemo(() => {
    return Object.keys(selectedMap)
      .filter((id) => selectedMap[+id]) // Преобразуем строковые ключи в числа и проверяем флаг
      .map(Number); // Преобразуем обратно в массив чисел
  }, [selectedMap]);

  // Обработчики
  const handleChange = (id: number) => () => {
    // Обработчик изменения выборки элемента
    setSelectedMap((prev) => ({
      // Меняем состояние мапы
      ...prev, // Сохраняем предыдущие значения
      [id]: !prev[id], // Инвертируем состояние текущего элемента
    }));
  };

  /**
   * Возвращаемый объект с функциональностью для внешнего использования
   */
  return {
    items: itemsWithSelection,
    selectedMachines: selectedItems,
    getItemKey: (r) => r.id.toString(),
    getItemSelected: (r) => selectedMap[r.id],
    onChange: handleChange,
  };
}
