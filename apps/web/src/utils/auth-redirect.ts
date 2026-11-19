import { redirect } from "react-router";

import { toPagePath } from "@/utils/page-path";

const FALLBACK_PATH = "/";

/** Keeps the post-auth destination on this origin, and never back on the sign-in or sign-up screen. */
const toSafeReturnPath = (value: string | null, origin: string) => {
  if (!value) {
    return FALLBACK_PATH;
  }

  try {
    const target = new URL(value, origin);

    if (target.origin !== origin) {
      return FALLBACK_PATH;
    }

    const path = `${toPagePath(target.pathname)}${target.search}${target.hash}`;
    return path.startsWith("/sign-in") || path.startsWith("/sign-up") ? FALLBACK_PATH : path;
  } catch {
    return FALLBACK_PATH;
  }
};

/** Clerk reads redirect_url from the query string, so an untrusted value is normalized before the form renders. */
export const normalizeAuthRedirect = (request: Request) => {
  const url = new URL(request.url);
  const requested = url.searchParams.get("redirect_url");

  if (requested === null) {
    return null;
  }

  const returnTo = toSafeReturnPath(requested, url.origin);

  if (returnTo === requested) {
    return null;
  }

  if (returnTo === FALLBACK_PATH) {
    url.searchParams.delete("redirect_url");
  } else {
    url.searchParams.set("redirect_url", returnTo);
  }

  throw redirect(`${toPagePath(url.pathname)}${url.search}`);
};
