import { createContext, useContext, useState, type ReactNode } from "react";
import { centers, type Center } from "@/lib/mock-data";

interface CenterContextValue {
  selectedCenterId: string;
  selectedCenter: Center;
  setSelectedCenterId: (id: string) => void;
  centers: Center[];
}

const CenterContext = createContext<CenterContextValue | null>(null);

export function CenterProvider({ children }: { children: ReactNode }) {
  const [selectedCenterId, setSelectedCenterId] = useState(centers[0].id);
  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ?? centers[0];

  return (
    <CenterContext.Provider value={{ selectedCenterId, selectedCenter, setSelectedCenterId, centers }}>
      {children}
    </CenterContext.Provider>
  );
}

export function useCenter() {
  const ctx = useContext(CenterContext);
  if (!ctx) throw new Error("useCenter must be used within CenterProvider");
  return ctx;
}
