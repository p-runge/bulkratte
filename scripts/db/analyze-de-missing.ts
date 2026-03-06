import { db, setsTable, cardsTable, localizationsTable } from "@/lib/db";
import { eq, and, count, not } from "drizzle-orm";

type Status =
  | "complete"
  | "missing_images"
  | "missing_names"
  | "not_seeded"
  | "nonexistent";

function getStatus(
  total: number,
  img: number,
  name: number,
  processed: boolean,
): Status {
  if (total === 0) return "nonexistent";
  if (img >= total) return "complete";
  if (img > 0 || name > 0)
    return name >= total ? "missing_images" : "missing_names";
  return processed ? "nonexistent" : "not_seeded";
}

async function run() {
  const sets = await db
    .select()
    .from(setsTable)
    .where(not(eq(setsTable.series, "Pokémon TCG Pocket")))
    .orderBy(setsTable.releaseDate);

  const cardCountRows = await db
    .select({ setId: cardsTable.setId, total: count() })
    .from(cardsTable)
    .groupBy(cardsTable.setId);
  const cardCountMap = new Map(cardCountRows.map((r) => [r.setId, r.total]));

  const imageRows = await db
    .select({ setId: cardsTable.setId, n: count() })
    .from(localizationsTable)
    .innerJoin(cardsTable, eq(localizationsTable.record_id, cardsTable.id))
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, "image_small"),
        eq(localizationsTable.language, "de"),
      ),
    )
    .groupBy(cardsTable.setId);
  const imageMap = new Map(imageRows.map((r) => [r.setId, r.n]));

  const nameRows = await db
    .select({ setId: cardsTable.setId, n: count() })
    .from(localizationsTable)
    .innerJoin(cardsTable, eq(localizationsTable.record_id, cardsTable.id))
    .where(
      and(
        eq(localizationsTable.table_name, "cards"),
        eq(localizationsTable.column_name, "name"),
        eq(localizationsTable.language, "de"),
      ),
    )
    .groupBy(cardsTable.setId);
  const nameMap = new Map(nameRows.map((r) => [r.setId, r.n]));

  const processedRows = await db
    .select({ setId: localizationsTable.record_id })
    .from(localizationsTable)
    .where(
      and(
        eq(localizationsTable.table_name, "sets"),
        eq(localizationsTable.column_name, "_processed"),
        eq(localizationsTable.language, "de"),
      ),
    );
  const processedSet = new Set(processedRows.map((r) => r.setId));

  const results = sets.map((set) => {
    const total = cardCountMap.get(set.id) ?? 0;
    const deImages = imageMap.get(set.id) ?? 0;
    const deNames = nameMap.get(set.id) ?? 0;
    return {
      id: set.id,
      name: set.name,
      series: set.series,
      total,
      deImages,
      deNames,
      status: getStatus(total, deImages, deNames, processedSet.has(set.id)),
    };
  });

  const summary: Record<string, number> = {};
  for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;
  console.log("\n=== STATUS SUMMARY ===");
  for (const [s, n] of Object.entries(summary).sort()) {
    console.log(`  ${s.padEnd(20)} ${n} sets`);
  }

  const actionable = results.filter((r) =>
    ["missing_images", "missing_names", "not_seeded"].includes(r.status),
  );
  console.log(
    `\n=== ACTIONABLE (${actionable.length} sets with missing DE data) ===`,
  );
  console.log(
    "Status               | Set ID               | Name                                    | Total | DE img | DE names | Missing img",
  );
  console.log(
    "---------------------|----------------------|-----------------------------------------|-------|--------|----------|------------",
  );
  for (const r of actionable) {
    console.log(
      `${r.status.padEnd(20)} | ${r.id.padEnd(20)} | ${r.name.padEnd(39)} | ${String(r.total).padStart(5)} | ${String(r.deImages).padStart(6)} | ${String(r.deNames).padStart(8)} | ${String(r.total - r.deImages).padStart(11)}`,
    );
  }

  const totalMissingImages = actionable
    .filter((r) => r.status === "missing_images" || r.status === "missing_names")
    .reduce((acc, r) => acc + (r.total - r.deImages), 0);
  const notSeeded = actionable.filter((r) => r.status === "not_seeded");
  console.log(`\nTotal cards missing DE images: ${totalMissingImages}`);
  console.log(`Sets not yet seeded: ${notSeeded.length}`);
  if (notSeeded.length) {
    console.log("\nNot-seeded sets:");
    for (const r of notSeeded)
      console.log(`  ${r.id.padEnd(22)} ${r.name} (${r.series})`);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
