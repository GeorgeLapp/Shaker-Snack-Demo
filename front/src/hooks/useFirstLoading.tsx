import { useState, useEffect } from 'react';

/**
 * Хук useFirstLoading отвечает за управление отображением лоадера
 * в зависимости от состояния загрузки.
 *
 * @param isLoading - состояние загрузки (boolean). True, если идет загрузка, иначе False.
 * @param dependencies - массив зависимостей, при изменении которых будет сбрасываться состояние первой загрузки.
 * @returns showLoader - состояние, указывающее, нужно ли показывать лоадер (boolean).
 */
function useFirstLoading(isLoading: boolean, dependencies: unknown[] = []): boolean {
  const [showLoader, setShowLoader] = useState<boolean>(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  useEffect(() => {
    if (isLoading && !hasLoadedOnce) {
      setShowLoader(true);
    }

    if (!isLoading) {
      setHasLoadedOnce(true);
      setShowLoader(false);
    }
  }, [isLoading, hasLoadedOnce]);

  // Используем отдельный эффект для отслеживания зависимостей
  useEffect(() => {
    // Сбрасываем состояние первой загрузки при изменении зависимостей
    setHasLoadedOnce(false);
    setShowLoader(false);
  }, dependencies); // этот эффект будет запускаться при изменении зависимости

  return showLoader;
}

export default useFirstLoading;
