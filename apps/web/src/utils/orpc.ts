import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@reelory/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { serverErrorKey } from "@/i18n/errors";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locale";
import { translate } from "@/i18n/messages";
import { getClerkAuthToken } from "@/utils/clerk-auth";

import { ENV } from "../env";

const toastLocale = () => {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const { lang } = document.documentElement;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
};

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const locale = toastLocale();
        toast.error(translate(locale, serverErrorKey(error)), {
          action: {
            label: translate(locale, "common.retryAction"),
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
  headers: async () => {
    const token = await getClerkAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
