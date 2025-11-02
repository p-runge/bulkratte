"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Set as PokemonSet } from "@/lib/db";
import Fuse from "fuse.js";
import { Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";

type Props = {
  sets: PokemonSet[];
};
export default function Content({ sets }: Props) {
  const [search, setSearch] = useState("");
  const intl = useIntl();

  const fuse = useMemo(() => {
    return new Fuse(sets, {
      keys: ["name", "abbreviation", "id", "series"],
      threshold: 0.3,
      ignoreLocation: false,
    });
  }, [sets]);

  const filteredSets = useMemo(() => {
    const results =
      search.trim().length > 0 ? fuse.search(search).map((r) => r.item) : sets;
    return results.slice().sort((a, b) => {
      return b.releaseDate.localeCompare(a.releaseDate);
    });
  }, [search, fuse, sets]);

  // Group sets by series (using map + filter)
  const seriesList = Array.from(new Set(filteredSets.map((s) => s.series)));
  const setsBySeries: Record<string, PokemonSet[]> = Object.fromEntries(
    seriesList.map((series) => [
      series,
      filteredSets.filter((s) => s.series === series),
    ])
  ) as Record<string, PokemonSet[]>;
  console.log("setsBySeries", setsBySeries);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {intl.formatMessage({
            id: "browseSets.title",
            defaultMessage: "Browse Sets",
          })}
        </h1>
        <p className="text-muted-foreground">
          {intl.formatMessage({
            id: "browseSets.description",
            defaultMessage:
              "Browse all available Pokémon card sets. Click on a set to view its cards or mark sets you're actively collecting.",
          })}
        </p>

        {/* --- Search Bar --- */}
        <input
          type="text"
          autoFocus
          placeholder={intl.formatMessage({
            id: "search.placeholder",
            defaultMessage: "Search set names...",
          })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-4 w-full max-w-md px-3 py-2 border rounded shadow-sm focus:outline-none focus:ring"
        />
      </div>

      {Object.entries(setsBySeries)
        // hide series with no sets
        .filter(([, seriesSets]) => seriesSets.length > 0)
        .map(([series, seriesSets]) => (
          <div key={series} className="mb-10">
            <div className="text-xl font-semibold mb-4 border-b pb-2 flex items-center">
              {seriesSets[0]!.logo && (
                <Image
                  src={seriesSets[0]!.logo}
                  alt={intl.formatMessage(
                    {
                      id: "series.logoAlt",
                      defaultMessage: "{series} logo",
                    },
                    { series }
                  )}
                  width={64}
                  height={64}
                  className="inline-block w-16 h-16 object-contain object-center mr-2"
                />
              )}

              <span>{series}</span>

              {/* year range */}
              <span className="text-muted-foreground ml-2">
                {`(${new Date(seriesSets[seriesSets.length - 1]!.releaseDate).getFullYear()} - ${new Date(
                  seriesSets[0]!.releaseDate
                ).getFullYear()
                  })`}
              </span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {seriesSets.map((set) => {
                const extras =
                  (set.totalWithSecretRares ?? 0) - (set.total ?? 0);
                const cardsText =
                  set.total != null
                    ? extras > 0
                      ? intl.formatMessage(
                        {
                          id: "set.cardsCountWithExtras",
                          defaultMessage: "{total} (+{extras}) cards",
                        },
                        { total: set.total, extras }
                      )
                      : intl.formatMessage(
                        {
                          id: "set.cardsCount",
                          defaultMessage: "{total} cards",
                        },
                        { total: set.total }
                      )
                    : "";

                return (
                  <Link href={`/sets/${set.id}`} key={set.id}>
                    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col justify-between">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center">
                              {set.logo && (
                                <Image
                                  src={set.logo}
                                  alt={intl.formatMessage(
                                    {
                                      id: "set.logoAlt",
                                      defaultMessage: "{setName} logo",
                                    },
                                    { setName: set.name }
                                  )}
                                  width={48}
                                  height={48}
                                  className="inline-block w-12 h-12 object-contain object-center mr-2"
                                />
                              )}
                              <span>{set.name}</span>
                            </CardTitle>
                            <CardDescription className="mt-1 flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {
                                intl.formatDate(new Date(set.releaseDate), {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })
                              }
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-sm flex items-center">
                            {set.symbol && (
                              <Image
                                src={set.symbol}
                                alt={intl.formatMessage(
                                  {
                                    id: "set.symbolAlt",
                                    defaultMessage: "{setName} symbol",
                                  },
                                  { setName: set.name }
                                )}
                                width={24}
                                height={24}
                                className="inline-block w-6 h-6 object-contain object-center mr-2"
                              />
                            )}
                            <span>{cardsText}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </main>
  );
}
