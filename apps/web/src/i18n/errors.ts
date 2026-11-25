import type { MessageKey } from "./messages";

const codeOf = (error: unknown): string | null => {
  if (error !== null && typeof error === "object" && "code" in error) {
    return typeof error.code === "string" ? error.code : null;
  }

  return null;
};

/** Maps an oRPC error code to copy the interface can show without leaking server English. */
export const serverErrorKey = (error: unknown): MessageKey => {
  switch (codeOf(error)) {
    case "UNAUTHORIZED":
      return "serverError.unauthorized";
    case "FORBIDDEN":
      return "serverError.forbidden";
    case "NOT_FOUND":
      return "serverError.notFound";
    case "BAD_REQUEST":
    case "UNPROCESSABLE_CONTENT":
      return "serverError.badRequest";
    case "CONFLICT":
    case "PRECONDITION_FAILED":
      return "serverError.conflict";
    case "TOO_MANY_REQUESTS":
      return "serverError.tooManyRequests";
    case "BAD_GATEWAY":
    case "SERVICE_UNAVAILABLE":
    case "GATEWAY_TIMEOUT":
      return "serverError.unavailable";
    case "INTERNAL_SERVER_ERROR":
    case "NOT_IMPLEMENTED":
    case "TIMEOUT":
      return "serverError.internal";
    default:
      break;
  }

  // A fetch that never reached the API rejects as a TypeError.
  return error instanceof TypeError ? "serverError.network" : "serverError.generic";
};

/** Maps an HTTP status from the router error boundary to localized copy. */
export const statusErrorKey = (status: number): MessageKey => {
  if (status === 401) {
    return "serverError.unauthorized";
  }
  if (status === 403) {
    return "serverError.forbidden";
  }
  if (status === 429) {
    return "serverError.tooManyRequests";
  }
  if (status >= 500) {
    return "serverError.internal";
  }
  return "serverError.badRequest";
};
