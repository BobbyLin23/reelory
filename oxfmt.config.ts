import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Match `vp check`/`vp fmt`, which use oxfmt's defaults, so the pre-commit
  // hook and CI format files the same way.
  printWidth: 100,
  trailingComma: "all",
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), ".agents/**", ".claude/**"],
});
