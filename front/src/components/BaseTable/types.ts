import { BaseTableSettingsBarProps } from './BaseTableSettingsBar/types';
import { BaseTableHeaderProps } from './BaseTableHeader/types';
import { TextProps } from '@consta/uikit/Text';
import { BaseTableDataProps } from './BaseTableData/types';
import { BaseTableSortButtonProps } from './BaseTableHeader/BaseTableHeaderColumn/BaseTableSortButton/types';
import { BaseTableFilterButtonProps } from './BaseTableHeader/BaseTableHeaderColumn/BaseTableFilterButton/types';
import React from 'react';

/**
 * Столбец
 */
export type Column<T> = BaseTableSortButtonProps &
  BaseTableFilterButtonProps & {
    /**
     * Флаг, показывающий, что этот столбец не будет рендериться
     */
    isNoRender?: boolean;
    /**
     * Текст столбца
     */
    title: React.ReactNode | null;

    /**
     * Внешний className ячейки в header
     */
    baseTableHeaderColumnClassName?: string;
    /**
     * Внешний className title ячейки в header
     */
    baseTableHeaderColumnTitleClassName?: string;

    /**
     * Внешний className ячейки таблицы
     */
    baseTableDataRowCellClassName?: string;
    /**
     * Центровка ячейки
     */
    justify?: 'left' | 'center' | 'right';
    /**
     * Ширина колонки. Допустимо указать любой размер. Если не указан, выставляется 1fr
     */
    columnWidth?: string;
    /**
     * Props для текста title
     */
    titleTextProp?: TextProps;
    /**
     * render ячейки таблицы
     *
     * @param data данные строки таблицы
     * @param rowIndex индекс строки таблицы
     */
    renderCell: (data: T, rowIndex: number) => React.ReactNode | string;
    /**
     * Обработчик нажатия по ячейке
     *
     * @param data данные строки таблицы
     */
    onCellClick?: (data: T) => void;
  };

/**
 * Свойства базовой таблицы
 */
export type BaseTableProps<T> = BaseTableSettingsBarProps &
  BaseTableHeaderProps<T> &
  BaseTableDataProps<T> & {
    /**
     * Без настроек таблицы
     */
    withoutSettingsBar?: boolean;
    /**
     * Без шапки таблицы
     */
    withoutHeader?: boolean;
    /**
     * Без отображения данных таблицы
     */
    withoutData?: boolean;
    /**
     * Внешний className таблицы
     */
    baseTableClassName?: string;
  };
