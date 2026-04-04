import { api } from "@/lib/api/server";
import Content from "./_components/content";

export const revalidate = 31536000; // 1 year — revalidated on-demand by cron job

export default async function SetsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const [sets, { s }] = await Promise.all([api.set.getList(), searchParams]);

  return <Content sets={sets} initialSearch={s ?? ""} />;
}
