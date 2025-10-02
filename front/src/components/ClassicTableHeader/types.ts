import React from 'react';
import { SortDirection } from '../../types/enums/sortDirection';

/**
 * Свойства компонента TablePageSettings
 */
export type TablePageSettingsProps = {
  /**
   * Длина массива элементов
   */
  fullLength: number;
  /**
   * Длина страниц
   */
  limit: number;
  /**
   * Номер страницы
   */
  page: number;
  /**
   * Обработчик нажатия на кнопку назад
   */
  onBackClick: () => void;
  /**
   * Обработчик нажатия на кнопку вперёд
   */
  onNextClick: () => void;
  /**
   * Изменение отображаемых на странице элементов
   *
   * @param limit количество отображаемых элементов
   */
  onLimitChange: (limit: number) => void;
};

/**
 * Столбец с фильтрацией
 */
type ColumnWithFilter = {
  /**
   * Внешний className контекстного меню фильтра столбца
   */
  filterClassName?: string;
  /**
   * Флаг наличия фильтра
   */
  withFilter: true;
  /**
   * Рендер метод фильтра столбца
   */
  renderFilter: () => React.ReactNode;
};

/**
 * Столбец без фильтрации
 */
type ColumnNoFilter = {
  /**
   * Флаг отсутствия фильтрации
   */
  withFilter?: false;
};

/**
 * Union type фильтрации столбца
 */
type ColumnFilter = ColumnWithFilter | ColumnNoFilter;

/**
 * Столбец с кастомной сортировкой
 */
type ColumnCustomSort = {
  /**
   * Кастомная сортировки
   */
  type: 'custom';
  /**
   * Рендер метод контекстного меню кастомной сортировки
   */
  renderSort: () => React.ReactNode;
};

/**
 * Столбец со стандартной сортировкой
 */
type ColumnDefaultSort<T extends Record<string, any>, K extends keyof T> = {
  /**
   * Стандартная сортировка
   */
  type: 'default';
  /**
   * Обработчик нажатия на кнопку сортировки
   *
   * @param key ключ поля таблицы
   */
  onSortClick: (key: K) => void;
};

/**
 * Столбец с сортировкой + Union type типа сортировки
 */
type ColumnWithSortable<T extends Record<string, any>, K extends keyof T> = (
  | ColumnCustomSort
  | ColumnDefaultSort<T, K>
) & {
  /**
   * Флаг наличия сортировки
   */
  sortable: true;
};

/**
 * Столбец без сортировки
 */
type ColumnNoSortable = {
  /**
   * Флаг отсутствия сортировки
   */
  sortable?: false;
};

/**
 * Union type наличия сортировки
 */
export type ColumnSortable<T extends Record<string, any>, K extends keyof T> =
  | ColumnWithSortable<T, K>
  | ColumnNoSortable;

/**
 * Столбец
 */
export type Column<T extends Record<string, any>, K extends keyof T> = ColumnFilter &
  ColumnSortable<T, K> & {
    /**
     * Внешний classname ячейки
     */
    className?: string;
    /**
     * Флаг наличия сортировки
     */
    sortable?: boolean;
    /**
     * Не рендерить колонку
     */
    isNoRender?: boolean;
    /**
     * Длинный текст
     */
    isLongText?: boolean | undefined;
    /**
     * Ширина
     */
    width?: string;
    /**
     * Ключ поля
     */
    key: keyof T;
    /**
     * Название колонки
     */
    title: string;
    /**
     * Выравнивание внутри колонки
     */
    alignment?: 'left' | 'right';
    /**
     * Рендер-метод ячейки в таблице
     *
     * @param data данные строки в таблице
     */
    renderCell?: (data: T, rowIndex: number) => JSX.Element;
    /**
     * Рендер-метод столбца в таблице (ячейки в шапке)
     *
     * @param data данные строки в таблице
     */
    renderColumn?: (data: T) => JSX.Element;
    /**
     * Метод получения значения в ячейке
     *
     * @param data данные строки в таблице
     */
    getItemLabel?: (data: T) => string | number | null;
    /**
     * Заполнить всю доступную ширину.
     * Не имеет смысл использовать больше 1 раза на таблицу
     */
    fullWidth?: boolean | undefined;
    // эти поля используются для таблицы цен
    multi?: boolean;
    count?: number;
    renderMultiCell?: (data: any, rowIndex: number, index: number) => JSX.Element;
  };

type WithPageSetting = TablePageSettingsProps & {
  /**
   * Есть настройка страниц на таблице
   */
  withPageSetting: true;
};

type WithoutPageSetting = {
  /**
   * Нет настройки страниц
   */
  withPageSetting?: false;
};

type PageSettingUnionType = WithPageSetting | WithoutPageSetting;

type WithActions = {
  withHeaderActions: true;
  renderTableHeadActions: () => React.ReactNode;
};

type WithoutActions = {
  withHeaderActions?: false;
};

type ActionsUnion = WithActions | WithoutActions;

export type ClassicTableHeaderProps<
  T extends Record<string, any>,
  K extends keyof T,
> = PageSettingUnionType &
  ActionsUnion & {
    /**
     * Наличие чекбокса у таблицы
     */
    withCheckbox?: boolean | undefined;
    /**
     * Наличие заголовка у таблицы
     */
    withHeader?: boolean | undefined;
    /**
     * Колонки таблицы
     */
    columns: Record<K, Column<T, K>>;
    /**
     * Состояние сортировки
     */
    sortOrder?: Record<K, SortDirection | null>;
    /**
     * Функция для установки состояния сортировки
     */
    onSortClick?: (value: Record<K, SortDirection | null>) => void;
  };
