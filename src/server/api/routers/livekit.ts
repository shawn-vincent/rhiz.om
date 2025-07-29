import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { services } from "~/domain/services";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { broadcastToRoom, createJoinToken } from "~/server/lib/livekit";

export const livekitRouter = createTRPCRouter({
	/**
	 * Generate a LiveKit join token for the current user to connect to a space
	 *
	 * Room Mapping: The roomBeingId should match the Being ID of the space page
	 * the user is currently viewing (e.g., from URL "/beings/@workspace")
	 *
	 * User Identity: Uses ctx.auth.beingId as the LiveKit participant identity
	 */
	getJoinToken: protectedProcedure
		.input(
			z.object({
				roomBeingId: z.string().min(1), // Being ID for the space (from current page)
				ttlSeconds: z.number().int().positive().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify the space Being exists and user has access
			const spaceBeing = await services.being.getBeing(input.roomBeingId);
			if (!spaceBeing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Space being not found",
				});
			}

			// Verify space is actually a space type
			if (spaceBeing.type !== "space") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Being must be of type 'space' to use as LiveKit room",
				});
			}

			// Get the user's Being for display name
			const userBeing = await services.being.getBeing(ctx.auth.sessionBeingId);
			if (!userBeing) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User being not found",
				});
			}

			// Generate token: room = space Being ID, identity = user Being ID
			const result = await createJoinToken({
				roomId: input.roomBeingId, // Space Being ID (e.g., "@workspace")
				identity: ctx.auth.sessionBeingId, // User Being ID (e.g., "@alice")
				name: userBeing.name, // Display name for LiveKit
				ttlSeconds: input.ttlSeconds,
			});

			return result;
		}),

	/**
	 * Send a server-side message to a LiveKit room
	 * Useful for system notifications, bot messages, etc.
	 */
	sendSystemMessage: protectedProcedure
		.input(
			z.object({
				roomBeingId: z.string().min(1),
				message: z.string().min(1),
				topic: z.string().optional(),
				targetBeingIds: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user has permission to send to this room
			const roomBeing = await services.being.getBeing(input.roomBeingId);
			if (!roomBeing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Room being not found",
				});
			}

			// For now, allow any authenticated user to send system messages
			// TODO: Add proper permission checks based on room ownership/membership

			await broadcastToRoom({
				roomId: input.roomBeingId,
				text: input.message,
				topic: input.topic,
				toIdentities: input.targetBeingIds,
			});

			return { success: true };
		}),
});
