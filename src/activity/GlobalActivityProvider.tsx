import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { GlobalActivityContext } from "./globalActivityContext";

export function GlobalActivityProvider({ children }: { readonly children: ReactNode }) {
  const nextId = useRef(0);
  const active = useRef(new Set<number>());
  const [activeCount, setActiveCount] = useState(0);

  const begin = useCallback(() => {
    const id = ++nextId.current;
    active.current.add(id);
    setActiveCount(active.current.size);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      active.current.delete(id);
      setActiveCount(active.current.size);
    };
  }, []);

  const value = useMemo(() => ({ activeCount, begin }), [activeCount, begin]);
  return <GlobalActivityContext.Provider value={value}>{children}</GlobalActivityContext.Provider>;
}
