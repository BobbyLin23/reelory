import { useClerk, useUser } from "@clerk/react-router";
import { ChartNoAxesColumn, Compass, House, ListVideo, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { Button } from "@/components/arc/button/button";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { BrandLockup } from "@/components/brand-lockup";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/i18n/i18n";
import type { MessageKey } from "@/i18n/messages";

import styles from "./app-shell.module.css";

const destinations = [
  { end: true, icon: House, label: "nav.records", to: "/" },
  { end: false, icon: Compass, label: "nav.discover", to: "/discover" },
  { end: false, icon: ListVideo, label: "nav.lists", to: "/lists" },
  { end: false, icon: ChartNoAxesColumn, label: "nav.stats", to: "/stats" },
  { end: false, icon: Settings, label: "nav.settings", to: "/settings" },
] as const satisfies readonly {
  to: string;
  label: MessageKey;
  icon: typeof House;
  end: boolean;
}[];

/** Next-themes and Clerk both resolve after hydration, so their controls wait for the effect to keep the first render stable. */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

function DestinationLinks({ className, iconSize = 18 }: { className: string; iconSize?: number }) {
  const { t } = useI18n();

  return (
    <>
      {destinations.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={className}>
          <Icon aria-hidden="true" size={iconSize} strokeWidth={1.75} />
          <span>{t(label)}</span>
        </NavLink>
      ))}
    </>
  );
}

function SidebarNav() {
  const { t } = useI18n();

  return (
    <nav aria-label={t("nav.primary")} className={styles.sidebarNav}>
      <DestinationLinks className={styles.navLink} />
    </nav>
  );
}

function TabBar() {
  const { t } = useI18n();

  return (
    <nav aria-label={t("nav.primary")} className={styles.tabBar}>
      <DestinationLinks className={styles.tabLink} iconSize={20} />
    </nav>
  );
}

function AccountControls() {
  const hydrated = useHydrated();
  const { isLoaded, user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!(hydrated && isLoaded)) {
    return <span aria-hidden="true" className={styles.accountPlaceholder} />;
  }

  const switchLabel =
    resolvedTheme === "light" ? t("theme.switchToDark") : t("theme.switchToLight");

  if (!user) {
    return (
      <div className={styles.controls}>
        <ThemeSwitch
          iconOnly
          label={switchLabel}
          theme={resolvedTheme === "light" ? "light" : "dark"}
          onThemeChange={setTheme}
        />
        <Button variant="secondary" onClick={() => openSignIn()}>
          {t("nav.signIn")}
        </Button>
      </div>
    );
  }

  const name =
    user.fullName || user.username || user.primaryEmailAddress?.emailAddress || t("nav.account");
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const themePreference = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <UserMenu
      labels={{
        account: t("nav.accountMenuLabel"),
        dark: t("menu.dark"),
        light: t("menu.light"),
        signOut: t("menu.signOut"),
        signingOut: t("menu.signingOut"),
        system: t("menu.system"),
        theme: t("menu.theme"),
      }}
      user={{ avatarSrc: user.imageUrl, email, name }}
      theme={themePreference}
      onThemeChange={setTheme}
      items={[
        {
          icon: <Settings aria-hidden="true" size={16} strokeWidth={1.75} />,
          label: t("menu.settings"),
          onSelect: () => navigate("/settings"),
        },
      ]}
      onSignOut={() => signOut({ redirectUrl: "/" })}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        {t("nav.skip")}
      </a>
      <header className={styles.topBar}>
        <Link aria-label={t("nav.brandHome")} className={styles.brand} to="/">
          <BrandLockup />
        </Link>
        <AccountControls />
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <SidebarNav />
        </aside>
        <main className={styles.main} id="main-content" tabIndex={-1}>
          <div className={styles.container}>{children}</div>
        </main>
      </div>
      <TabBar />
    </div>
  );
}
