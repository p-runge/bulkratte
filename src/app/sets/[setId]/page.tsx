import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api/server";
import { db, setsTable } from "@/lib/db";
import { getIntl } from "@/lib/i18n/server";
import { not, eq, desc } from "drizzle-orm";
import Link from "next/link";
import Content from "./_components/content";
import { SetBreadcrumbCombobox } from "./_components/set-breadcrumb-combobox";

// Cache set pages for 24 hours. The daily cron job refreshes prices in the DB,
// and ISR background revalidation will pick them up within the next 24h window.
export const revalidate = 86400;

// Allow set pages that weren't pre-built to be generated on first request.
export const dynamicParams = true;

// Query the DB directly — generateStaticParams runs at build time outside a
// request scope, so the tRPC caller (which calls headers()) cannot be used.
export async function generateStaticParams() {
  const sets = await db
    .select({ id: setsTable.id })
    .from(setsTable)
    .where(not(eq(setsTable.series, "Pokémon TCG Pocket")))
    .orderBy(desc(setsTable.releaseDate));
  return sets.map((set) => ({ setId: set.id }));
}

export default async function SetIdPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  const intl = await getIntl();

  const [sets, cards] = await Promise.all([
    api.set.getList(),
    api.card.getList({ setIds: [setId] }),
  ]);
  const selectedSet = sets.find((set) => set.id === setId);

  if (!selectedSet) {
    return (
      <div>
        {intl.formatMessage({
          id: "page.set.error.not_found",
          defaultMessage: "Set not found",
        })}
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* breadcrumb */}
      <nav
        className="text-sm mb-4"
        aria-label={intl.formatMessage({
          id: "common.breadcrumb.label",
          defaultMessage: "Breadcrumb",
        })}
      >
        <ol className="list-reset flex text-muted-foreground">
          <li>
            <Link href="/sets" className="hover:underline">
              {intl.formatMessage({
                id: "page.sets.label",
                defaultMessage: "Sets",
              })}
            </Link>
          </li>
          <li className="font-semibold flex">
            <span className="mx-2">/</span>
            <SetBreadcrumbCombobox sets={sets} currentSetId={selectedSet.id} />
          </li>
        </ol>
      </nav>

      <Content set={selectedSet} initialCards={cards} />
    </TooltipProvider>
  );
}
