import { z } from "zod/v4";
// src/server/api/routers/presence.ts
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getCurrentPresence, isBeingOnline } from "~/server/lib/presence";

export const presenceRouter = createTRPCRouter({
	/**
	 * Get all beings with their current online status
	 */
	getAll: publicProcedure.query(async () => {
		return await getCurrentPresence();
	}),

	/**
	 * Get beings in a specific location/space with their connection status
	 */
	getByLocation: publicProcedure
		.input(
			z.object({
				locationId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const allPresence = await getCurrentPresence();

			// Filter by location and always include spaces/bots
			const beingsInLocation = allPresence.filter(
				(being) =>
					// Always show spaces and bots
					being.type === "space" ||
					being.type === "bot" ||
					// Show guests that are in this location
					(being.type === "guest" && being.locationId === input.locationId),
			);

			return beingsInLocation;
		}),

	/**
	 * Check if a specific being is online
	 */
	checkOnline: publicProcedure
		.input(
			z.object({
				beingId: z.string(),
				beingType: z.string(),
			}),
		)
		.query(({ input }) => {
			return {
				beingId: input.beingId,
				isOnline: isBeingOnline(input.beingId, input.beingType),
			};
		}),

	/**
	 * Get online beings count by type
	 */
	getStats: publicProcedure.query(async () => {
		const allPresence = await getCurrentPresence();

		const stats = {
			total: allPresence.length,
			online: allPresence.filter((b) => b.isOnline).length,
			byType: {
				space: allPresence.filter((b) => b.type === "space" && b.isOnline)
					.length,
				bot: allPresence.filter((b) => b.type === "bot" && b.isOnline).length,
				guest: allPresence.filter((b) => b.type === "guest" && b.isOnline)
					.length,
				document: allPresence.filter((b) => b.type === "document" && b.isOnline)
					.length,
			},
		};

		return stats;
	}),
});
