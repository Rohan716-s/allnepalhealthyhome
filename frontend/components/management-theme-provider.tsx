"use client";

/* eslint-disable react-hooks/set-state-in-effect -- reset and hydrate the shared staff theme when the protected route changes. */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getManagementSidebarTheme,
  ManagementSidebarTheme,
} from "@/services/api";

export const defaultManagementSidebarTheme: ManagementSidebarTheme = {
  sidebarBackground: "#003893",
  sidebarText: "#FFFFFF",
  sidebarIcon: "#BFDBFE",
  sidebarHoverBackground: "#1D4ED8",
  sidebarHoverText: "#FFFFFF",
  sidebarActiveBackground: "#DBEAFE",
  sidebarActiveText: "#003893",
  sidebarActiveIcon: "#003893",
  sidebarBorder: "#1E40AF",
  sidebarDivider: "#2563EB",
  sidebarHeaderBackground: "#002B6F",
  sidebarHeaderText: "#FFFFFF",
  sidebarFooterBackground: "#00275F",
  sidebarFooterText: "#DBEAFE",
  sidebarBadgeBackground: "#DBEAFE",
  sidebarBadgeText: "#003893",
};

export const sidebarThemePresets: Record<string, ManagementSidebarTheme> = {
  "Default Healthcare": defaultManagementSidebarTheme,
  "Professional Blue": {
    ...defaultManagementSidebarTheme,
    sidebarBackground: "#003893",
    sidebarText: "#FFFFFF",
    sidebarIcon: "#BFDBFE",
    sidebarHoverBackground: "#1D4ED8",
    sidebarHoverText: "#FFFFFF",
    sidebarBorder: "#1E40AF",
    sidebarDivider: "#2563EB",
    sidebarFooterBackground: "#00275F",
  },
  "Light Healthcare": {
    ...defaultManagementSidebarTheme,
    sidebarBackground: "#FFFFFF",
    sidebarText: "#0F172A",
    sidebarIcon: "#475569",
    sidebarHoverBackground: "#EFF6FF",
    sidebarHoverText: "#003893",
    sidebarActiveBackground: "#DBEAFE",
    sidebarActiveText: "#1E3A8A",
    sidebarActiveIcon: "#1D4ED8",
    sidebarBorder: "#BFDBFE",
    sidebarDivider: "#DBEAFE",
    sidebarHeaderBackground: "#003893",
    sidebarFooterBackground: "#F8FAFC",
    sidebarFooterText: "#475569",
  },
  "Dark Professional": {
    ...defaultManagementSidebarTheme,
    sidebarBackground: "#111827",
    sidebarText: "#F3F4F6",
    sidebarIcon: "#CBD5E1",
    sidebarHoverBackground: "#1F2937",
    sidebarBorder: "#374151",
    sidebarDivider: "#374151",
    sidebarHeaderBackground: "#0B1220",
    sidebarFooterBackground: "#0B1220",
  },
};

type ManagementThemeContextValue = {
  theme: ManagementSidebarTheme;
  loaded: boolean;
  setTheme: (theme: ManagementSidebarTheme) => void;
};
const ManagementThemeContext = createContext<ManagementThemeContextValue>({
  theme: defaultManagementSidebarTheme,
  loaded: false,
  setTheme: () => undefined,
});

export function ManagementThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const [theme, setTheme] = useState(defaultManagementSidebarTheme);
  const [loaded, setLoaded] = useState(false);
  const managementRoute =
    /^(\/admin|\/superadmin|\/supervisor|\/pharmacist|\/delivery)(\/|$)/.test(
      pathname,
    );

  useEffect(() => {
    if (!managementRoute) {
      setTheme(defaultManagementSidebarTheme);
      setLoaded(false);
      return;
    }
    const token = window.localStorage.getItem("anhh-staff-access-token") ?? "";
    if (!token) {
      setTheme(defaultManagementSidebarTheme);
      setLoaded(false);
      return;
    }
    let active = true;
    setLoaded(false);
    getManagementSidebarTheme(token)
      .then((saved) => {
        if (active) {
          setTheme(saved);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [managementRoute]);

  const value = useMemo(() => ({ theme, loaded, setTheme }), [theme, loaded]);
  return (
    <ManagementThemeContext.Provider value={value}>
      {children}
    </ManagementThemeContext.Provider>
  );
}

export function useManagementTheme() {
  return useContext(ManagementThemeContext);
}
