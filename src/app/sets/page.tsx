import { api } from "@/lib/api/server";
import Content from "./_components/content";

export default async function SetsPage() {
  const sets = await api.set.getList();

  // Group sets by series
  const setsBySeries: Record<string, typeof sets> = {};
  sets.forEach((set) => {
    if (!setsBySeries[set.series]) setsBySeries[set.series] = [];
    setsBySeries[set.series]!.push(set);
  });

  return <Content sets={sets} />;
}
