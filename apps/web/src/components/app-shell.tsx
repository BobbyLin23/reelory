import { useClerk, useUser } from "@clerk/react-router";
import { ChartNoAxesColumn, Compass, House, ListVideo, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { Button } from "@/components/arc/button/button";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { useTheme } from "@/components/theme-provider";

import styles from "./app-shell.module.css";

const destinations = [
  { to: "/", label: "Records", icon: House, end: true },
  { to: "/discover", label: "Discover", icon: Compass, end: false },
  { to: "/lists", label: "Lists", icon: ListVideo, end: false },
  { to: "/stats", label: "Stats", icon: ChartNoAxesColumn, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

/** Next-themes and Clerk both resolve after hydration, so their controls wait for the effect to keep the first render stable. */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

function DestinationLinks({ className, iconSize = 18 }: { className: string; iconSize?: number }) {
  return (
    <>
      {destinations.map(({ to, label, icon: Icon, end }) => {
        return (
          <NavLink key={to} to={to} end={end} className={className}>
            <Icon aria-hidden="true" size={iconSize} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

function SidebarNav() {
  return (
    <nav aria-label="Primary" className={styles.sidebarNav}>
      <DestinationLinks className={styles.navLink} />
    </nav>
  );
}

function TabBar() {
  return (
    <nav aria-label="Primary" className={styles.tabBar}>
      <DestinationLinks className={styles.tabLink} iconSize={20} />
    </nav>
  );
}

function AccountControls() {
  const hydrated = useHydrated();
  const { isLoaded, user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  if (!(hydrated && isLoaded)) {
    return <span aria-hidden="true" className={styles.accountPlaceholder} />;
  }

  if (!user) {
    return (
      <div className={styles.controls}>
        <ThemeSwitch
          iconOnly
          theme={resolvedTheme === "light" ? "light" : "dark"}
          onThemeChange={setTheme}
        />
        <Button variant="secondary" onClick={() => openSignIn()}>
          Sign in
        </Button>
      </div>
    );
  }

  const name =
    user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const themePreference = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <UserMenu
      user={{ name, email, avatarSrc: user.imageUrl }}
      theme={themePreference}
      onThemeChange={setTheme}
      items={[
        {
          label: "Settings",
          icon: <Settings aria-hidden="true" size={16} strokeWidth={1.75} />,
          onSelect: () => navigate("/settings"),
        },
      ]}
      onSignOut={() => signOut({ redirectUrl: "/" })}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.topBar}>
        <Link className={styles.brand} to="/">
          reelory
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
