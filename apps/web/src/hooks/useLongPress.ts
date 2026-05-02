import { useRef, useCallback } from 'react';

const useLongPress = (onLongPress: () => void, delay = 600) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Prevent context menu / text selection on long touch
      e.preventDefault();
      timerRef.current = setTimeout(onLongPress, delay);
    },
    [onLongPress, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
  };
};

export default useLongPress;
