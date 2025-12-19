import {
  CellDiagnosticsUI,
  CellStatusPollCalibrationEnum,
  DiagnosticsTestDTO,
  DiagnosticsTestUI,
  OpenProductListDTO,
  PollCalibrationDTO,
  ServiceMenuConfigDTO,
} from '../../types/serverInterface/serviceMenuDTO';
import { buildServiceMenuUrl } from '../../helpers/media';

/**
 * Преобразует исходный DiagnosticsTestDTO в UI-формат DiagnosticsTestUI.
 *
 * Задачи функции:
 * 1. Сохранить всю информацию CellDiagnostics, полученную с сервера
 * 2. Добавить UI-слой (loadingStatus / message / updatedAtCalibration)
 * 3. При повторных вызовах НЕ терять уже полученное состояние калибровки
 *
 * prev используется для сохранения состояния между запросами
 * (например, когда приходит новый getCellsTest, но калибровка уже идет)
 */
export const toDiagnosticsTestUI = (
  dto: DiagnosticsTestDTO,
  prev?: DiagnosticsTestUI,
): DiagnosticsTestUI => {
  const prevById = new Map<number, CellDiagnosticsUI>(
    (prev?.view.cells || []).map((c) => [c.id, c]),
  );

  const cells: CellDiagnosticsUI[] = (dto.view.cells || []).map((c) => {
    const old = prevById.get(c.id);

    return {
      ...c,
      imgPath: buildServiceMenuUrl(c.productId, c.imgPath),
      loadingStatus: old?.loadingStatus || CellStatusPollCalibrationEnum.PENDING,
      message: old?.message || null,
      updatedAtCalibration: old?.updatedAtCalibration || null,
    };
  });

  return {
    ...dto,
    view: {
      ...dto.view,
      cells,
      done: prev?.view.done || false,
    },
  };
};

/**
 * Сливает результат pollCalibration в существующее UI-состояние диагностики.
 *
 * Используется при периодическом опросе сервера:
 * - обновляет статус калибровки отдельных ячеек
 * - не трогает остальные данные ячейки (продукт, картинка и т.п.)
 * - определяет, завершена ли калибровка полностью
 */
export const mergePollIntoDiagnostics = (
  prev: DiagnosticsTestUI,
  poll: PollCalibrationDTO,
): DiagnosticsTestUI => {
  const pollMap = new Map(poll.view.cells.map((c) => [c.cellId, c]));

  const cells = prev.view.cells.map((cell) => {
    const p = pollMap.get(cell.id);

    if (!p) return cell;

    return {
      ...cell,
      imgPath: buildServiceMenuUrl(cell.productId, cell.imgPath),
      loadingStatus: p.status,
      message: p.message,
      updatedAtCalibration: p.updatedAt || null,
    };
  });

  const allCalibrated = cells.length > 0 && cells.every((c) => c.message === 'CALIBRATED');
  const done = poll.view.done || allCalibrated;

  return {
    ...prev,
    state: poll.state,
    view: {
      ...prev.view,
      done,
      cells: cells.map((cell) => {
        return {
          ...cell,
          imgPath: buildServiceMenuUrl(cell.productId, cell.imgPath),
        };
      }),
    },
  };
};

/**
 * Нормализует ссылки на картинки в ответах ServiceMenu
 */
export const changeMediaUrl = (data: ServiceMenuConfigDTO) => {
  return {
    ...data,
    view: {
      ...data.view,
      cells: data.view.cells.map((cell) => ({
        ...cell,
        imgPath: buildServiceMenuUrl(cell.productId, cell.imgPath),
      })),
    },
  };
};

/**
 * Нормализует ссылки на картинки в ответах OpenProductListDTO
 */
export const changeMediaUrlProducts = (data: OpenProductListDTO) => {
  return {
    ...data,
    view: {
      ...data.view,
      products: data.view.products.map((product) => ({
        ...product,
        imgPath: buildServiceMenuUrl(product.id, product.imgPath),
      })),
    },
  };
};
