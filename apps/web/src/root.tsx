import { ClerkProvider, useAuth } from "@clerk/react-router";
import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";

import "./index.css";
import "@/components/arc/foundation.css";
import { Toaster } from "@reelory/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { clerkZh } from "@/i18n/clerk";
import { statusErrorKey } from "@/i18n/errors";
import { I18nProvider, useI18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locale";
import { DEFAULT_LOCALE, isLocale, requestLocale } from "@/i18n/locale";
import { translate } from "@/i18n/messages";
import { setClerkAuthTokenGetter } from "@/utils/clerk-auth";

import type { Route } from "./+types/root";
import { ThemeProvider } from "./components/theme-provider";
import { queryClient } from "./utils/orpc";

export const middleware: Route.MiddlewareFunction[] = [clerkMiddleware()];

export const loader = (args: Route.LoaderArgs) =>
  rootAuthLoader(args, ({ request }) => ({ locale: requestLocale(request) }));

interface RootData {
  locale?: Locale;
}

const useRootLocale = (): Locale => {
  const data = useRouteLoaderData<RootData>("root");
  return isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE;
};

function ClerkApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkAuthTokenGetter(getToken);

    return () => {
      setClerkAuthTokenGetter(null);
    };
  }, [getToken]);

  return null;
}

export const links: Route.LinksFunction = () => [
  { href: "/favicon.svg", rel: "icon", type: "image/svg+xml" },
  { href: "/favicon.ico", rel: "icon", sizes: "any" },
  { href: "https://fonts.googleapis.com", rel: "preconnect" },
  { crossOrigin: "anonymous", href: "https://fonts.gstatic.com", rel: "preconnect" },
  {
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    rel: "stylesheet",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const locale = useRootLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppProviders({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const { locale } = useI18n();

  return (
    <ClerkProvider loaderData={loaderData} localization={locale === "zh-CN" ? clerkZh : undefined}>
      <ClerkApiAuthBridge />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute={["class", "data-theme"]}
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <Outlet />
          <Toaster richColors />
        </ThemeProvider>
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <I18nProvider locale={loaderData.locale}>
      <AppProviders loaderData={loaderData} />
    </I18nProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const locale = useRootLocale();
  let message = translate(locale, "errors.title");
  let details = translate(locale, "errors.description");
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : translate(locale, "errors.label");
    details =
      error.status === 404
        ? translate(locale, "errors.notFoundDescription")
        : translate(locale, statusErrorKey(error.status));
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
