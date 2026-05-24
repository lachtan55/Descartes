/**
 * HealthContext — runs backend health checks once on app init.
 * SectionShell reads this context to show a non-blocking status banner.
 * Checks both FastAPI (:8000) and PocketBase (:8090) independently.
 */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export interface HealthState {
  backend: 'online' | 'offline' | 'checking';
  pocketbase: 'online' | 'offline' | 'checking';
}

const HealthContext = createContext<HealthState>({
  backend: 'checking',
  pocketbase: 'checking',
});

export function useHealth(): HealthState {
  return useContext(HealthContext);
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthState>({
    backend: 'checking',
    pocketbase: 'checking',
  });

  const backendFails = useRef(0);
  const pbFails = useRef(0);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health', {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          backendFails.current = 0;
          setHealth(h => ({ ...h, backend: 'online' }));
        } else {
          backendFails.current += 1;
          if (backendFails.current >= 2)
            setHealth(h => ({ ...h, backend: 'offline' }));
        }
      } catch {
        backendFails.current += 1;
        if (backendFails.current >= 2)
          setHealth(h => ({ ...h, backend: 'offline' }));
      }
    };

    const checkPocketBase = async () => {
      try {
        const res = await fetch('http://localhost:8090/api/health', {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          pbFails.current = 0;
          setHealth(h => ({ ...h, pocketbase: 'online' }));
        } else {
          pbFails.current += 1;
          if (pbFails.current >= 2)
            setHealth(h => ({ ...h, pocketbase: 'offline' }));
        }
      } catch {
        pbFails.current += 1;
        if (pbFails.current >= 2)
          setHealth(h => ({ ...h, pocketbase: 'offline' }));
      }
    };

    // Initial check on app init
    checkBackend();
    checkPocketBase();

    // Continue polling every 30s to detect recovery
    const id = setInterval(() => {
      checkBackend();
      checkPocketBase();
    }, 30_000);

    return () => clearInterval(id);
  }, []); // runs once on mount (app init)

  return (
    <HealthContext.Provider value={health}>
      {children}
    </HealthContext.Provider>
  );
}
