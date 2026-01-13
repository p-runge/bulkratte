import fs from "node:fs/promises";

import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

async function run() {
  const data = await fs.readFile(
    `src/lib/i18n/extracted/${DEFAULT_LOCALE}.json`,
    "utf-8",
  );
  const messages = JSON.parse(data) as Record<string, string>;
  console.log("Translating", Object.keys(messages).length, "messages");

  const targetLocales = Object.values(LOCALES).filter(
    (locale) => locale !== DEFAULT_LOCALE,
  );
  console.log("Target locales:", targetLocales);

  await Promise.all(targetLocales.map((locale) => translate(locale, data)));
}

async function translate(locale: string, data: string) {
  // parse source messages to determine which keys still need translation
  const sourceMessages = JSON.parse(data) as Record<string, string>;

  // load existing translations (if any)
  let oldFileJSON: Record<string, string>;
  try {
    const oldFileContent = await fs.readFile(
      `src/lib/i18n/translated/${locale}.json`,
      "utf-8",
    );
    oldFileJSON = JSON.parse(oldFileContent) as Record<string, string>;
  } catch (e) {
    console.error(`No existing translation file for locale ${locale}`, e);
    oldFileJSON = {};
  }

  // determine keys that are present in source but missing in existing translations
  const keysToTranslate = Object.keys(sourceMessages).filter(
    (k) => !(k in oldFileJSON),
  );

  if (keysToTranslate.length === 0) {
    // nothing to translate; however ensure we remove any stale keys and write file
    const cleaned: Record<string, string> = {};
    for (const k of Object.keys(oldFileJSON)) {
      if (k in sourceMessages) cleaned[k] = oldFileJSON[k]!;
    }
    const path = `src/lib/i18n/translated/${locale}.json`;
    await fs.writeFile(path, JSON.stringify(cleaned, null, 2) + "\n");
    console.log(
      `No missing keys for ${locale}. Written existing file to ${path}`,
    );
    return;
  }

  // build a partial JSON containing only missing keys to minimize request size
  const partialSource: Record<string, string> = {};
  for (const k of keysToTranslate) partialSource[k] = sourceMessages[k]!;

  console.log(
    `Need to translate ${
      Object.keys(partialSource).length
    } messages to ${locale}`,
  );

  console.log("\n=== TRANSLATION REQUEST ===");
  console.log(`Target Language: ${locale}`);
  console.log(`Keys to translate: ${Object.keys(partialSource).length}`);
  console.log(
    "\nCopy the prompt below and use GitHub Copilot Chat to translate it:",
  );
  console.log(
    `\n\`\`\`\nTake a look at the files in src/lib/i18n/translated and check if have all the keys that are also defined in src/lib/i18n/extracted. If there are missing keys, translate them now and update the files accordingly. Make sure to keep the same keys and their order as in the extracted file. Make sure the translations match the tone and context of the application, which is a tool for managing trading card collections.\n\`\`\``,
  );
  console.log("\n=== END OF REQUEST ===\n");

  // Just preserve existing translations - user needs to manually add new ones
  const merged: Record<string, string> = { ...oldFileJSON };

  // ensure we only keep keys that still exist in the source messages
  for (const key of Object.keys(merged)) {
    if (!(key in sourceMessages)) delete merged[key];
  }

  const sortedKeys = Object.keys(merged).sort();
  const sortedMerged: Record<string, string> = {};
  for (const key of sortedKeys) {
    sortedMerged[key] = merged[key]!;
  }

  const newFileContent = JSON.stringify(sortedMerged, null, 2) + "\n";

  // write to file
  const path = `src/lib/i18n/translated/${locale}.json`;
  await fs.writeFile(path, newFileContent);
  console.log(`Written to ${path}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
