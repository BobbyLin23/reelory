import { MEDIA_TYPES } from "@reelory/db/schema";
import { z } from "zod";

export const titleKey = z.object({
  mediaType: z.enum(MEDIA_TYPES),
  tmdbId: z.int().positive(),
});
