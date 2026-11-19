import type { ReactNode } from "react";

import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { useTheme } from "@/components/theme-provider";

import styles from "@/components/auth-page.module.css";

const ringRadii = [150, 300, 450, 600, 750];

interface AuthPageProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** The frame both auth screens share: brand bar, quiet rings, and the card that holds Clerk's form. */
export const AuthPage = ({ title, description, children }: AuthPageProps) => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <main className={styles.page}>
      <div aria-hidden="true" className={styles.backdrop}>
        <svg
          className={styles.rings}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          {ringRadii.map((radius) => (
            <circle key={radius} className={styles.ring} cx="500" cy="500" r={radius} />
          ))}
        </svg>
      </div>
      <header className={styles.bar}>
        <span className={styles.brand}>reelory</span>
        <ThemeSwitch
          iconOnly
          theme={resolvedTheme === "light" ? "light" : "dark"}
          onThemeChange={setTheme}
        />
      </header>
      <div className={styles.stage}>
        <div className={styles.card}>
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
