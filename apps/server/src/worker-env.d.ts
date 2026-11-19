interface Env {
  DB: D1Database;
  CORS_ORIGIN: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  TMDB_API_KEY: string;
  TMDB_CACHE: KVNamespace;
}
