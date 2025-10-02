import { BaseTableDataLoaderProps } from './BaseTableDataLoader/types';
import { BaseTableDataRowProps } from './BaseTableDataRow/types';
import { Column } from '../types';

/**
 * Свойства компонента BaseTableData
 */
export type BaseTableDataProps<T> = BaseTableDataLoaderProps &
  Omit<BaseTableDataRowProps<T>, 'rowIndex' | 'row'> & {
    /**
     * Флаг загрузки таблицы
     */
    isLoading?: boolean;
    /**
     * Внешний className строки таблицы
     */
    rowClassName?: string;
    /**
     * Внешний className контента таблицы
     */
    tableDataClassName?: string;
    /**
     * Внешний className для grid контейнера таблицы
     */
    gridContainerClassName?: string;
    /**
     * Массив индексов, перед которыми надо сделать промежуток
     */
    spaceIndexes?: number[];
    /**
     * Нужны ли заголовки перед spaceIndexes
     */
    isRowSpaceIndexesHeader?: boolean;
    /**
     * Данные таблицы
     */
    rows: T[];
    /**
     * Столбцы таблицы
     */
    columns: Column<T>[];
    /**
     * Внешний className для одной конкретной строки
     */
    getRowClassName?: (row: T, index: number) => string;
    /**
     * Обработчик нажатия на строку
     */
    onRowClick?: (row: T, index: number) => void;
  };
