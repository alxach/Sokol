import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCenters, type Center } from "@/lib/api/organizations.functions";

interface CenterContextValue {
  selectedCenterId: string;
  selectedCenter: Center;
  setSelectedCenterId: (id: string) => void;
  centers: Center[];
}

const CenterContext = createContext<CenterContextValue | null>(null);

function normalizeCenters(raw: unknown): Center[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter((c): c is Center =>
    typeof c === "object" &&
    c !== null &&
    typeof (c as Record<string, unknown>).id === "string" &&
    typeof (c as Record<string, unknown>).name === "string",
  ) as Center[];
}

export function CenterProvider({ children }: { children: ReactNode }) {
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");

  useEffect(() => {
    if (centers.length > 0) return;
    fetchCenters().then((list) => {
      const norm = normalizeCenters(list);
      if (norm.length > 0) {
        setCenters(norm);
        if (!selectedCenterId) setSelectedCenterId(norm[0].id);
      }
    }).catch(() => {
      setCenters(normalizeCenters([]));
    });
  }, [centers.length, selectedCenterId]);

  const selectedCenter = useMemo(
    () => centers.find((c) => c.id === selectedCenterId) ?? centers[0],
    [centers, selectedCenterId],
  );

  return (
    <CenterContext.Provider
      value={{
        selectedCenterId,
        selectedCenter,
        setSelectedCenterId,
        centers,
      }}
    >
      {children}
    </CenterContext.Provider>
  );
}

export function useCenter() {
  const ctx = useContext(CenterContext);
  if (!ctx) throw new Error("useCenter must be used within CenterProvider");
  return ctx;
}
