import { createContext, useContext } from "react";

export interface GlobalActivityContextValue {
  readonly activeCount: number;
  readonly begin: (reason?: string) => () => void;
}

const inactiveActivityContext: GlobalActivityContextValue = {
  activeCount: 0,
  begin: () => () => undefined,
};

export const GlobalActivityContext = createContext<GlobalActivityContextValue | null>(null);

export function useGlobalActivityContext(): GlobalActivityContextValue {
  const value = useContext(GlobalActivityContext);
  return value ?? inactiveActivityContext;
}
