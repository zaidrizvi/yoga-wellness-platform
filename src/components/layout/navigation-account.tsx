"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type AccountStatus = { authenticated?: boolean; role?: string; applicationPendingOrRejected?: boolean; unavailable?: boolean };
const AccountContext = createContext<AccountStatus | null>(null);
export function NavigationAccount({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/auth/status", { cache: "no-store", signal: controller.signal })
      .then(response => response.json()).then(setStatus)
      .catch(() => { if (!controller.signal.aborted) setStatus({ unavailable: true }); });
    return () => controller.abort();
  }, [pathname]);
  return <AccountContext.Provider value={status}>{children}</AccountContext.Provider>;
}
export const useNavigationAccount = () => useContext(AccountContext);
