/**
 * Получение Promise с mock данными для работы запросов без бека
 *
 * @param data данные, возвращаемые в Promise
 * @param timer время задержки
 */
export const getDataFromServer = async <T>(data: T, timer?: number): Promise<T> => {
  return await new Promise((resolve) => {
    if (!data) throw { code: 404 };

    setTimeout(() => resolve(data), timer || 100);
  });
};
