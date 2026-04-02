import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// Only available in development. Returns 403 in production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    groupId: string;
    region: { x: number; y: number; w: number; h: number };
  };

  const { groupId, region } = body;
  if (!groupId || !region) {
    return NextResponse.json(
      { error: "Missing groupId or region" },
      { status: 400 },
    );
  }

  const filePath = path.resolve(
    process.cwd(),
    "src/app/scan/_components/scan-tester.tsx",
  );

  const src = await fs.readFile(filePath, "utf-8");

  // Match the exact group block: id: "groupId", ..., region: { x: ..., y: ..., w: ..., h: ... },
  // and replace only the region line.
  const regionLine = `    region: { x: ${region.x}, y: ${region.y}, w: ${region.w}, h: ${region.h} },`;

  // Regex: find `id: "groupId"` then (lazily) the next `region: { ... }` line and replace it.
  const pattern = new RegExp(
    `(id:\\s*"${groupId}"[\\s\\S]*?)(    region:\\s*\\{[^}]*\\},)`,
  );

  if (!pattern.test(src)) {
    return NextResponse.json(
      { error: `Group "${groupId}" not found in source file` },
      { status: 404 },
    );
  }

  const updated = src.replace(pattern, `$1${regionLine}`);
  await fs.writeFile(filePath, updated, "utf-8");

  return NextResponse.json({ ok: true });
}
