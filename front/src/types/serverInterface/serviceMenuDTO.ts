/**
 * Пин
 */
export type Pin = {
  /**
   * Пин
   */
  pin: string;
};

/**
 * Тип ячейки
 */
export enum CellTypeEnum {
  /**
   * Спираль
   */
  SPIRAL = 'spiral',
  /**
   * Конвейер
   */
  CONVEYOR = 'conveyor',
}

/**
 * Ячейка в списке ячеек с ценами
 */
export type CellPrice = {
  /**
   * id ячейки
   */
  id: number;
  /**
   * Номер ряда
   */
  row: number;
  /**
   * Путь до картинки
   */
  imgPath: string;
  /**
   * Название бренда
   */
  brandName: string;
  /**
   * Название продукта
   */
  productName: string;
  /**
   * Вместимость ячейки
   */
  capacity: number;
  /**
   * Остаток в ячейке
   */
  stock: number;
  /**
   * Цена
   */
  price: number;
  /**
   * id продукта
   */
  productId: number;
  /**
   * Статус
   */
  status: CellStatusEnum;
  /**
   * Тип ячейки
   */
  type: CellTypeEnum;
  /**
   * Размер ячейки
   */
  size: number;
  /**
   * Описание последней ошибки
   */
  lastError: string | null;
  /**
   * Объединена ли с какой-либо ячейкой
   */
  mergedTo: boolean | null;
  /**
   * Время последнего обновления
   */
  updatedAt: string;
};

/**
 * Мотор ячейки
 */
export type Motor = {
  /**
   * Вместимость ячейки
   */
  capacity: number;
  /**
   * id ячейки
   */
  cellId: number;
  /**
   * Описание последней ошибки
   */
  lastError: string | null;
  /**
   * Статус
   */
  status: CellStatusEnum;
  /**
   * Остаток в ячейке
   */
  stock: number;
  /**
   * Время последнего обновления
   */
  updatedAt: string;
};

/**
 * Ячейка в списке ячеек с диагностикой
 */
export type CellDiagnostics = {
  /**
   * Вместимость ячейки
   */
  capacity: number;
  /**
   * id ячейки
   */
  id: number;
  /**
   * Описание последней ошибки
   */
  lastError: string | null;
  /**
   * Моторы ячейки
   */
  motors: Motor[];
  /**
   * Путь до картинки(нет сейчас)
   */
  imgPath: string;
  /**
   * id продукта
   */
  productId: number;
  /**
   * Название продукта
   */
  productName: string;
  /**
   * Номер ряда
   */
  row: number;
  /**
   * Статус
   */
  status: CellStatusEnum;
  /**
   * Остаток в ячейке
   */
  stock: number;
  /**
   * Время последнего обновления
   */
  updatedAt: string;
};

/**
 * Мета информация
 */
export type Meta = {
  /**
   * Текст предупреждения
   */
  warn?: string;
};

/**
 * Мета информация
 */
export type StatusMeta = {
  /**
   * Код
   */
  status: 200;
};

export type ServiceMenuAuthorizationDTO = {
  /**
   * Мета информация
   */
  meta: Meta;
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * Сообщение
     */
    message: string;
    /**
     * Название экрана
     */
    screen: string;
  };
};

/**
 * dto управление ячейками - цены
 */
export type ServiceMenuPricesDTO = {
  /**
   * Мета информация
   */
  meta: Meta;
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * Список ячеек
     */
    cells: CellPrice[];
    /**
     * Название экрана
     */
    screen: string;
  };
};

/**
 * dto управление ячейками - товары
 */
export type ServiceMenuProductsDTO = ServiceMenuPricesDTO;

/**
 * dto управление ячейками - конфиг
 */
export type ServiceMenuConfigDTO = ServiceMenuPricesDTO;

/**
 * dto для смены цены в ряду
 */
export type CellsPricesRowDTO = {
  /**
   * Номер ряда
   */
  row: number;
  /**
   * Цена
   */
  price: number;
};

/**
 * dto для смены цены в ячейке
 */
export type CellPriceDTO = {
  /**
   * id ячейки
   */
  cellId: number;
  /**
   * Цена
   */
  price: number;
};

/**
 * dto присвоения продукта ячейке
 */
export type ProductToCellDTO = {
  /**
   * Номер ячейки
   */
  cellId: number;
  /**
   * id продукта
   */
  productId: number | null;
};

/**
 * dto присвоения продукта ряду
 */
export type ProductToRowDTO = {
  /**
   * Номер ряда
   */
  row: number;
  /**
   * id продукта
   */
  productId: number;
  /**
   * Объем
   */
  scope: 'all';
};

/**
 * Режим изменения продуктов/цен
 */
export enum ChangeCellsModeEnum {
  /**
   * Ряд
   */
  ROW = 'ROW',
  /**
   * Ячейка
   */
  CELL = 'CELL',
}

export type ChangeCellsProducts = {
  /**
   * Номер ряда
   */
  row: number | null;
  /**
   * Номер ячейки
   */
  cell: number | null;
  /**
   * Режим изменения цен/продуктов
   */
  mode: ChangeCellsModeEnum | null;
  /**
   * Название продукта
   */
  productName: string | null;
};

/**
 * Статус ячейки
 */
export enum CellStatusEnum {
  /**
   * Выключена
   */
  DISABLED = 'disabled',
  /**
   * Включена
   */
  ENABLED = 'enabled',
}

/**
 * dto для включения/выключения ячеек
 */
export type TurnOnOffCellsDTO = {
  /**
   * Номера ячеек
   */
  cellIds: number[];
  /**
   * Статус ячеек
   */
  status: CellStatusEnum;
};

/**
 * dto для объединения ячеек
 */
export type MergeCellsDTO = {
  /**
   * Номера ячеек
   */
  cellIds: number[];
};

/**
 * dto для разъединения ячеек
 */
export type SplitCellsDTO = {
  /**
   * Номера ячеек
   */
  cellIds: number[];
};

/**
 * dto для изменения типа ячейки
 */
export type ChangeCellsTypeDTO = {
  /**
   * Номера ячеек
   */
  cellIds: number[];
  /**
   * Тип ячейки
   */
  type: CellTypeEnum;
};

/**
 * dto для теста ячеек
 */
export type RunDiagnosticsDTO = {
  /**
   * Номера ячеек
   */
  cellIds: number[];
};

/**
 * dto для перезапуска теста ячеек
 */
export type RerunDiagnosticsDTO = RunDiagnosticsDTO;

/**
 * Продукт из каталога
 */
export type OpenListItem = {
  /**
   * Путь до картинки
   */
  imgPath: string;
  /**
   * id продукта
   */
  id: number;
  /**
   * Название продукта
   */
  name: string;
};

/**
 * Массив продукта из каталога
 */
export type OpenProductListDTO = {
  /**
   * Мета информация
   */
  meta: Meta;
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * Список ячеек
     */
    products: OpenListItem[];
    /**
     * Название экрана
     */
    screen: string;
  };
};

/**
 * dto диагностика - тест ячеек
 */
export type DiagnosticsTestDTO = {
  /**
   * Мета информация
   */
  meta: Meta;
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * Список ячеек
     */
    cells: CellDiagnostics[];
    /**
     * Название экрана
     */
    screen: string;
  };
};

/**
 * dto получение состояния моторов
 */
export type LoadCalibrationDTO = DiagnosticsTestDTO;

/**
 * Статус начала калибровки
 */
export enum StartCalibrationEnum {
  STARTED = 'STARTED',
}

/**
 * dto получения начала калибровки
 */
export type StartCalibrationDTO = {
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * id операции
     */
    opId: string;
    /**
     * Статус
     */
    status: StartCalibrationEnum;
  };
  /**
   * Мета информация
   */
  meta: StatusMeta;
};

/**
 * Статус ячейки во время получения состояния калибровки
 */
export enum CellStatusPollCalibrationEnum {
  /**
   * Откалибровалась успешно
   */
  SUCCESS = 'SUCCESS',
  /**
   * В процессе калибровки
   */
  PENDING = 'PENDING',
  /**
   * Откалибровалась с ошибкой
   */
  ALERT = 'ALERT',
}

/**
 * Ячейка калибровки
 */
export type CellPollCalibration = {
  /**
   * id ячейки
   */
  cellId: number;
  /**
   * Статус калибровки ячейки
   */
  status: CellStatusPollCalibrationEnum;
  /**
   * Сообщение
   */
  message: 'CALIBRATED' | null;
  /**
   * Время последнего обновления
   */
  updatedAt: string;
};

/**
 * dto получения состояния калибровки
 */
export type PollCalibrationDTO = {
  /**
   * Состояние
   */
  state: string;
  /**
   * Вид
   */
  view: {
    /**
     * id операции
     */
    opId: string;
    /**
     * Все ли ячейки откалиброваны
     */
    done: boolean;
    /**
     * Ячейки
     */
    cells: CellPollCalibration[];
  };
  /**
   * Мета информация
   */
  meta: StatusMeta;
};

/**
 * Доп. поля для UI калибровки
 */
export type CalibrationOverlay = {
  /**
   * Статус калибровки ячейки
   */
  loadingStatus: CellStatusPollCalibrationEnum;
  /**
   * Сообщение
   */
  message: 'CALIBRATED' | null;
  /**
   * Время последнего обновления
   */
  updatedAtCalibration: string | null;
};

/**
 * Ячейка для UI:
 */
export type CellDiagnosticsUI = CellDiagnostics & CalibrationOverlay;

/**
 * UI-версия диагностики:
 */
export type DiagnosticsTestUI = Omit<DiagnosticsTestDTO, 'view'> & {
  /**
   * Вид
   */
  view: Omit<DiagnosticsTestDTO['view'], 'cells'> & {
    /**
     * Список ячеек
     */
    cells: CellDiagnosticsUI[];
    /**
     * Все ли ячейки откалиброваны
     */
    done: boolean;
  };
};
