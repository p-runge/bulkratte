import { AppRouter } from "@/lib/api/routers/_app";
import { Card } from "@/lib/db";

export type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
export type UserCard = Awaited<
  ReturnType<AppRouter["userCard"]["getList"]>
>[number];

export type BinderCard = Pick<Card, "id" | "name" | "imageSmall">;
export type BinderCardData = {
  card: BinderCard;
  order: number;
};
