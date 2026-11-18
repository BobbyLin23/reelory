import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@reelory/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

const app = new Hono<{ Bindings: Env }>();

app.use("*", (c, next) =>
  cors({
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
    origin: c.env.CORS_ORIGIN,
  })(c, next)
);

app.get("/", (c) => c.text("OK"));

app.all("/rpc/*", async (c) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    context: await createContext(c.req.raw, c.env),
    prefix: "/rpc",
  });
  return matched ? c.newResponse(response.body, response) : c.notFound();
});

app.all("/api-reference/*", async (c) => {
  const { matched, response } = await apiHandler.handle(c.req.raw, {
    context: await createContext(c.req.raw, c.env),
    prefix: "/api-reference",
  });
  return matched ? c.newResponse(response.body, response) : c.notFound();
});

export default app;
