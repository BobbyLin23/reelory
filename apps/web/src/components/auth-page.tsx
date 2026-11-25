import type { ReactNode } from "react";

import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { BrandLockup } from "@/components/brand-lockup";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/i18n/i18n";

import styles from "@/components/auth-page.module.css";

interface AuthPageProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** The frame both auth screens share: brand bar and a calm, borderless form column. */
export const AuthPage = ({ title, description, children }: AuthPageProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <BrandLockup />
        <ThemeSwitch
          iconOnly
          label={resolvedTheme === "light" ? t("theme.switchToDark") : t("theme.switchToLight")}
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
