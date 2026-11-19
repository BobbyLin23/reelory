/** Single-fetch data requests append `.data` to the page path, so a return destination must drop it. */
export const toPagePath = (pathname: string) => {
  if (pathname.endsWith("/_.data")) {
    return pathname.slice(0, -"/_.data".length) || "/";
  }

  return pathname.replace(/\.data$/u, "") || "/";
};
