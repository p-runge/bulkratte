import { AppRouter } from "@/lib/api/routers/_app";

export type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
export type UserCard = Awaited<
  ReturnType<AppRouter["userCard"]["getList"]>
>[number];
