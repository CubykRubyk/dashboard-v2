"use client";

import { MobilePreferencesProvider } from "./MobilePreferences";
import styles from "./mobile.module.css";

export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <MobilePreferencesProvider>
      <div className={styles.shell}>{children}</div>
    </MobilePreferencesProvider>
  );
}
