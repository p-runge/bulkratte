import { api } from "@/lib/api/server";
import Content from "./_components/content";
import { Suspense } from "react";

export default async function SetsPage() {
  const sets = await api.set.getList();

  return (
    <Suspense>
      <Content sets={sets} />
    </Suspense>
  );
}
