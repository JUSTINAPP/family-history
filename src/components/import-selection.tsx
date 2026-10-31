"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
interface Selection {
  archiveId: string;
  files: File[];
}
const Context = createContext<{
  selection: Selection | null;
  stage: (archiveId: string, files: File[]) => void;
  clear: () => void;
} | null>(null);
export function ImportSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  return (
    <Context.Provider
      value={{
        selection,
        stage: (archiveId, files) => setSelection({ archiveId, files }),
        clear: () => setSelection(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useImportSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("Import selection provider is required.");
  return value;
}
