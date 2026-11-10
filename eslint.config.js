const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "dist/**",
      "neem-pressure-pulse/**",
      "convex/_generated/**",
      "dist-native/**",
      "supabase/functions/**",
      "assets/**",
      "docs/**",
    ],
  },
]);
