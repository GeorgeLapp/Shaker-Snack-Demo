import React from 'react';
import { SortDirection } from '../../types/enums/sortDirection';

/**
 * Базовый столбец таблицы
 */
export type BaseColumn<T extends Record<string, any>> = {
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
   * Метод получения значения в ячейке
   *
   * @param data данные строки в таблице
   */
  getItemLabel?: (data: T) => string | number;
  /**
   * Не рендерить колонку
   */
  isNoRender?: boolean;
  /**
   * Несколько столбцов на столбец
   */
  multi?: boolean;
  /**
   * Количество столбцов в столбце
   */
  count?: number;
  /**
   * Рендер метод multi ячейки
   *
   * @param data элемент массива таблицы
   * @param rowIndex index строки
   * @param index index multi column
   */
  renderMultiCell?: (data: any, rowIndex: number, index: number) => JSX.Element;
  /**
   * Внешний className
   */
  className?: string;
};

/**
 * Кастомная сортировка
 */
export type ColumnCustomSort = {
  /**
   * Тип для unionType
   */
  type: 'custom';
  /**
   * render метод для контекстного меню настройки сортировки
   */
  renderSort: () => React.ReactNode;
};

/**
 * Стандартная сортировка
 */
export type ColumnDefaultSort = {
  /**
   * Тип для unionType
   */
  type: 'default';
  /**
   * Обработчик нажатия на сортировку
   */
  onSortClick: () => void;
};

/**
 * Столбец с сортировкой
 */
export type ColumnWithSortable = (ColumnCustomSort | ColumnDefaultSort) & {
  /**
   * Флаг наличия сортировки для unionType
   */
  sortable: true;
};

/**
 * Столбец без сортировки
 */
type ColumnNoSortable = {
  /**
   * Флаг наличия сортировки для unionType
   */
  sortable?: false;
};

/**
 * Описание сортировки столбца
 */
export type ColumnSortable = ColumnWithSortable | ColumnNoSortable;

/**
 * Столбец
 */
export type Column<T extends Record<string, any>> = ColumnSortable & BaseColumn<T>;

export type TableCardProps<T extends Record<string, any>, K extends keyof T> = {
  /**
   * Внешний класс
   */
  className?: string;
  /**
   * Внешний класс для стиля рядов
   */
  rowClassName?: string;
  /**
   * Колонки таблицы
   */
  columns: Record<K, Column<T>>;
  /**
   * Данные таблицы
   */
  rows: T[];
  /**
   * Наличие header в таблице
   */
  withHeader?: boolean;
  /**
   * Состояние сортировки
   */
  sortOrder?: Record<K, SortDirection | null>;
  /**
   * Обработчик клика по строке
   *
   * @param key ключ
   */
  onRowClick?: (data: T) => void;
};

export type TableHeaderProps<T extends Record<string, any>, K extends keyof T> = {
  /**
   * Колонки таблицы
   */
  columns: Record<K, Column<T>>;
  /**
   * Состояние сортировки
   */
  sortOrder?: Record<K, SortDirection | null>;
};
