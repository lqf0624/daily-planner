import { useEffect, useRef, useState } from 'react';

type UseHoldActionOptions = {
  durationMs?: number;
  onComplete: () => void;
};

export const useHoldAction = ({ durationMs = 900, onComplete }: UseHoldActionOptions) => {
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const cancel = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    startRef.current = null;
    completedRef.current = false;
    setIsHolding(false);
    setProgress(0);
  };

  const tick = (timestamp: number) => {
    if (startRef.current === null) {
      startRef.current = timestamp;
    }

    const ratio = Math.min(1, (timestamp - startRef.current) / durationMs);
    setProgress(ratio);

    if (ratio >= 1) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      cancel();
      return;
    }

    frameRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    cancel();
    setIsHolding(true);
    frameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => cancel, []);

  return {
    progress,
    isHolding,
    start,
    cancel,
  };
};
