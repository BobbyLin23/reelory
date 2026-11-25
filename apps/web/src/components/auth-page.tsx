import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { BrandLockup } from "@/components/brand-lockup";
import { useTheme } from "@/components/theme-provider";
import styles from "@/components/auth-page.module.css";

import type { ReactNode } from "react";

interface AuthPageProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** The frame both auth screens share: brand bar and a calm, borderless form column. */
export const AuthPage = ({ title, description, children }: AuthPageProps) => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <BrandLockup />
        <ThemeSwitch
          iconOnly
          theme={resolvedTheme === "light" ? "light" : "dark"}
          onThemeChange={setTheme}
        />
      </header>
      <div className={styles.stage}>
        <div className={styles.form}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
};
