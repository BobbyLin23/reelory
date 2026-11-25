import { expect, test } from "bun:test";

import { serverErrorKey, statusErrorKey } from "./errors";

test("maps oRPC error codes to localized copy", () => {
  expect(serverErrorKey({ code: "UNAUTHORIZED" })).toBe("serverError.unauthorized");
  expect(serverErrorKey({ code: "NOT_FOUND" })).toBe("serverError.notFound");
  expect(serverErrorKey({ code: "BAD_REQUEST" })).toBe("serverError.badRequest");
  expect(serverErrorKey({ code: "BAD_GATEWAY" })).toBe("serverError.unavailable");
  expect(serverErrorKey({ code: "INTERNAL_SERVER_ERROR" })).toBe("serverError.internal");
  expect(serverErrorKey(new TypeError("Failed to fetch"))).toBe("serverError.network");
  expect(serverErrorKey(new Error("boom"))).toBe("serverError.generic");
  expect(serverErrorKey(null)).toBe("serverError.generic");
});

test("maps router statuses to localized copy", () => {
  expect(statusErrorKey(401)).toBe("serverError.unauthorized");
  expect(statusErrorKey(403)).toBe("serverError.forbidden");
  expect(statusErrorKey(429)).toBe("serverError.tooManyRequests");
  expect(statusErrorKey(500)).toBe("serverError.internal");
  expect(statusErrorKey(422)).toBe("serverError.badRequest");
});
