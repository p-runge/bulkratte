import { db, localizationsTable } from "./index";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { Language } from "./enums";
import type { Locale } from "../i18n";

/**
 * Get a single localized value for a specific record field
 * Falls back to the original value if no translation exists
 */
export async function getLocalizedValue<T extends Record<string, any>>(
  record: T,
  tableName: string,
  columnName: keyof T,
  locale: Locale,
): Promise<string> {
  // Extract language code (e.g., "en" from "en-US")
  const langCode = locale.split("-")[0] as Language;

  const translation = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
        eq(localizationsTable.column_name, columnName as string),
        eq(localizationsTable.record_id, record.id),
        eq(localizationsTable.language, langCode),
      ),
    )
    .limit(1);

  // Fallback to original value if no translation exists
  return translation[0]?.value ?? record[columnName];
}

/**
 * Localize a single record by replacing specified columns with their translations
 * Falls back to original values for any missing translations
 */
export async function localizeRecord<T extends Record<string, any>>(
  record: T,
  tableName: string,
  columns: (keyof T)[],
  locale: Locale,
): Promise<T> {
  // Extract language code (e.g., "en" from "en-US")
  const langCode = locale.split("-")[0] as Language;

  const translations = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
        eq(localizationsTable.record_id, record.id),
        eq(localizationsTable.language, langCode),
      ),
    );

  const localized = { ...record };

  for (const translation of translations) {
    if (columns.includes(translation.column_name as keyof T)) {
      localized[translation.column_name as keyof T] = translation.value as any;
    }
  }

  return localized;
}

/**
 * Localize multiple records efficiently with a single query
 * Falls back to original values for any missing translations
 */
export async function localizeRecords<T extends Record<string, any>>(
  records: T[],
  tableName: string,
  columns: (keyof T)[],
  locale: Locale,
): Promise<T[]> {
  if (records.length === 0) return [];

  // Extract language code (e.g., "en" from "en-US")
  const langCode = locale.split("-")[0] as Language;
  const recordIds = records.map((r) => r.id);

  const translations = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
        eq(localizationsTable.language, langCode),
        inArray(localizationsTable.record_id, recordIds),
      ),
    );

  // Create a map for quick lookups: recordId -> columnName -> value
  const translationMap = new Map<string, Map<string, string>>();

  for (const translation of translations) {
    if (!translationMap.has(translation.record_id)) {
      translationMap.set(translation.record_id, new Map());
    }
    translationMap
      .get(translation.record_id)!
      .set(translation.column_name, translation.value);
  }

  // Apply translations to each record
  return records.map((record) => {
    const recordTranslations = translationMap.get(record.id);
    if (!recordTranslations) return record;

    const localized = { ...record };
    for (const column of columns) {
      const translation = recordTranslations.get(column as string);
      if (translation) {
        localized[column] = translation as any;
      }
    }
    return localized;
  });
}

/**
 * Create or update a localization entry
 */
export async function upsertLocalization(
  tableName: string,
  columnName: string,
  recordId: string,
  locale: Locale,
  value: string,
): Promise<void> {
  // Extract language code (e.g., "en" from "en-US")
  const langCode = locale.split("-")[0] as Language;

  const existing = await db
    .select()
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, tableName),
        eq(localizationsTable.column_name, columnName),
        eq(localizationsTable.record_id, recordId),
        eq(localizationsTable.language, langCode),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // Update existing translation
    await db
      .update(localizationsTable)
      .set({
        value,
        updated_at: sql`NOW()`,
      })
      .where(eq(localizationsTable.id, existing[0].id));
  } else {
    // Insert new translation
    await db.insert(localizationsTable).values({
      table_name: tableName,
      column_name: columnName,
      record_id: recordId,
      language: langCode,
      value,
    });
  }
}
