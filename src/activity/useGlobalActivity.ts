import { useEffect, useRef } from "react";
import { useGlobalActivityContext } from "./globalActivityContext";

export function useGlobalActivity(active: boolean, reason = "Loading") {
  const { begin } = useGlobalActivityContext();
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (active && !stopRef.current) stopRef.current = begin(reason);
    if (!active && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [active, begin, reason]);
}
