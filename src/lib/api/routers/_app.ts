import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
} from "@/lib/api/trpc";
import { cardRouter } from "./card";
import { setRouter } from "./set";
import { userCardRouter } from "./user-card";
import { userSetRouter } from "./user-set";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  card: cardRouter,
  set: setRouter,
  userCard: userCardRouter,
  userSet: userSetRouter,
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.session.user;
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
