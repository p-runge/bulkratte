import fs from "node:fs/promises";

import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : undefined;

async function run() {
  if (!client) {
    console.error("Env var OPENAI_API_KEY is not set");

    // Just copy the source file to the translated folder
    const data = await fs.readFile(
      `src/lib/i18n/extracted/${DEFAULT_LOCALE}.json`,
      "utf-8"
    );
    fs.writeFile(`src/lib/i18n/translated/${DEFAULT_LOCALE}.json`, data);
    console.log(`Written to src/lib/i18n/translated/${DEFAULT_LOCALE}.json`);
    return;
  }

  const data = await fs.readFile(
    `src/lib/i18n/extracted/${DEFAULT_LOCALE}.json`,
    "utf-8"
  );
  const messages = JSON.parse(data) as Record<string, string>;
  console.log("Translating", Object.keys(messages).length, "messages");

  const targetLocales = Object.values(LOCALES).filter(
    (locale) => locale !== DEFAULT_LOCALE
  );
  console.log("Target locales:", targetLocales);

  await Promise.all(targetLocales.map((locale) => translate(locale, data)));
  fs.writeFile(`src/lib/i18n/translated/${DEFAULT_LOCALE}.json`, data);
  console.log(`Written to src/lib/i18n/translated/${DEFAULT_LOCALE}.json`);
}

async function translate(locale: string, data: string) {
  if (!client) throw new Error("OpenAI client is not initialized");

  // parse source messages to determine which keys still need translation
  const sourceMessages = JSON.parse(data) as Record<string, string>;

  // load existing translations (if any)
  let oldFileJSON: Record<string, string>;
  try {
    const oldFileContent = await fs.readFile(
      `src/lib/i18n/translated/${locale}.json`,
      "utf-8"
    );
    oldFileJSON = JSON.parse(oldFileContent) as Record<string, string>;
  } catch (e) {
    console.error(`No existing translation file for locale ${locale}`, e);
    oldFileJSON = {};
  }

  // determine keys that are present in source but missing in existing translations
  const keysToTranslate = Object.keys(sourceMessages).filter(
    (k) => !(k in oldFileJSON)
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
      `No missing keys for ${locale}. Written existing file to ${path}`
    );
    return;
  }

  // build a partial JSON containing only missing keys to minimize request size
  const partialSource: Record<string, string> = {};
  for (const k of keysToTranslate) partialSource[k] = sourceMessages[k]!;

  console.log(
    `Translating ${Object.keys(partialSource).length} messages to ${locale}`
  );
  // return

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    instructions: `You are a translation engine.
The input will be a JSON object containing only the keys that need translation, for example:

\`\`\`
{
  "some.key": "Text to translate",
  "another.key": "Another text"
}
\`\`\`

Make sure to escape any special characters properly so that the output is valid JSON.

Translate the whole file from the source language (${DEFAULT_LOCALE}) to the target language (${locale}).
Only respond with the translated text. Do not include any other text.

The application this text is used in is a web application for collection trading cards, so please use appropriate translations for that context.`,
    input: JSON.stringify(partialSource),
  });

  // validate response is valid JSON
  let newFileJSON: Record<string, string>;
  try {
    newFileJSON = JSON.parse(response.output_text) as Record<string, string>;
  } catch (e) {
    console.error("Response is not valid JSON", response.output_text);
    throw e;
  }

  const merged: Record<string, string> = { ...newFileJSON, ...oldFileJSON };

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
