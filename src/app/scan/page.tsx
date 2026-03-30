import { db, cardsTable, setsTable } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { ScanTester } from "./_components/scan-tester";

export default async function ScanPage() {
  // Pick 10 diverse sample cards from different sets for testing
  const samples = await db
    .select({
      id: cardsTable.id,
      name: cardsTable.name,
      number: cardsTable.number,
      imageLarge: cardsTable.imageLarge,
      setName: setsTable.name,
      setTotal: setsTable.total,
    })
    .from(cardsTable)
    .innerJoin(setsTable, eq(cardsTable.setId, setsTable.id))
    .where(
      sql`${cardsTable.imageLarge} IS NOT NULL
        AND ${setsTable.name} NOT LIKE '%trainer Kit%'
        AND ${setsTable.name} NOT LIKE '%McDonald%'
        AND ${setsTable.series} != 'Pokémon TCG Pocket'`,
    )
    .orderBy(sql`RANDOM()`)
    .limit(10);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Card Scanner — OCR Test</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Click a sample card or upload your own image to test OCR recognition.
        The scanner reads the card name (top) and number/total (bottom), then
        looks up the match in the database.
      </p>
      <ScanTester samples={samples} />
    </div>
  );
}
