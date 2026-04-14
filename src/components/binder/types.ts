import { AppRouter } from "@/lib/api/routers/_app";
import { Card } from "@/lib/db";

export type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>;
export type UserCard = Awaited<
  ReturnType<AppRouter["userCard"]["getList"]>
>[number];
export type UserCardList = Awaited<
  ReturnType<AppRouter["userCard"]["getList"]>
>;
export type PlacedUserCardIds = Awaited<
  ReturnType<AppRouter["userSet"]["getPlacedUserCardIds"]>
>;

export type BinderCard = Pick<
  Card,
  "id" | "name" | "image" | "number" | "rarity" | "image" | "setId"
>;
export type BinderCardData = {
  // the card prop is potentially undefined during the loading state of the getByIds query
  card?: BinderCard;
  order: number;
};
