import { useEffect, useRef } from 'react';

const VIEWPORT_SELECTOR = 'meta[name="viewport"]';

const parseViewport = (content: string): Record<string, string> => {
  const params: Record<string, string> = {};

  content
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, ...rest] = part.split('=');
      const key = rawKey.trim();
      if (!key) {
        return;
      }

      params[key] = rest.join('=').trim();
    });

  return params;
};

const serializeViewport = (params: Record<string, string>): string =>
  Object.entries(params)
    .map(([key, value]) => (value ? `${key}=${value}` : key))
    .join(', ');

const buildNoZoomViewport = (content: string): string => {
  const params = parseViewport(content);

  params.width = params.width || 'device-width';
  params['initial-scale'] = params['initial-scale'] || '1';
  params['maximum-scale'] = '1';
  params['minimum-scale'] = '1';
  params['user-scalable'] = 'no';

  return serializeViewport(params);
};

const preventTouchZoom = (event: TouchEvent) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
};

const preventGesture = (event: Event) => {
  event.preventDefault();
};

const preventCtrlWheelZoom = (event: WheelEvent) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
};

const useZoomLock = (enabled: boolean) => {
  const originalViewport = useRef<string | null>(null);

  useEffect(() => {
    const viewport = document.querySelector(VIEWPORT_SELECTOR) as HTMLMetaElement | null;
    if (!viewport) {
      return;
    }

    if (originalViewport.current === null) {
      originalViewport.current = viewport.getAttribute('content') ?? '';
    }

    if (enabled) {
      viewport.setAttribute('content', buildNoZoomViewport(originalViewport.current));
      document.documentElement.classList.add('zoom-locked');
      return;
    }

    viewport.setAttribute('content', originalViewport.current);
    document.documentElement.classList.remove('zoom-locked');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.addEventListener('touchstart', preventTouchZoom, { passive: false });
    document.addEventListener('touchmove', preventTouchZoom, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('wheel', preventCtrlWheelZoom, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventTouchZoom);
      document.removeEventListener('touchmove', preventTouchZoom);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('wheel', preventCtrlWheelZoom);
    };
  }, [enabled]);
};

export default useZoomLock;
