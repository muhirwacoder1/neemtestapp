import { readFile, mkdir, writeFile } from "node:fs/promises";
const sdk = await readFile(
  new URL(
    "../node_modules/@daily-co/daily-js/dist/daily-iframe.js",
    import.meta.url,
  ),
  "utf8",
);
await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../src/generated/dailyBrowserSdk.ts", import.meta.url),
  `/* Generated from the pinned @daily-co/daily-js package. Run npm run bundle:daily after upgrades. */\nexport default ${JSON.stringify(sdk)};\n`,
);

await mkdir(new URL("../docs/licenses/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../docs/licenses/daily-js-BSD-2-Clause.txt", import.meta.url),
  await readFile(
    new URL("../node_modules/@daily-co/daily-js/LICENSE", import.meta.url),
    "utf8",
  ),
);
