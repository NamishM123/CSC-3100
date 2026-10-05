import { createContext, useContext } from "react";

export const AppStateContext = createContext(null);

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error(
      "useAppState must be used inside AppStateProvider"
    );
  }
  return value;
}
