import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { readGateState, tryUnlock, lockGate } from "@/lib/gate";

interface GateContextValue {
  unlocked: boolean;
  ready: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

const GateContext = createContext<GateContextValue | null>(null);

export function GateProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnlocked(readGateState().unlocked);
    setReady(true);
  }, []);

  const unlock = useCallback(async (password: string) => {
    const ok = await tryUnlock(password);
    if (ok) setUnlocked(true);
    return ok;
  }, []);

  const lock = useCallback(() => {
    lockGate();
    setUnlocked(false);
  }, []);

  return (
    <GateContext.Provider value={{ unlocked, ready, unlock, lock }}>
      {children}
    </GateContext.Provider>
  );
}

export function useGate() {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useGate must be used inside GateProvider");
  return ctx;
}
