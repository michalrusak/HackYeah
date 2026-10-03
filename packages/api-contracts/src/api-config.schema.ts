import { z } from "zod";

export const PublicApiConfigSchema = z
  .object({
    apiUrl: z.string().refine((value) => {
      if (value === "/api") return true;
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }),
  })
  .strict();
