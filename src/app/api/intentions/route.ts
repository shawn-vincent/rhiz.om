import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { intentions, users } from "~/server/db/schema";
import type { BeingId, IntentionId } from "~/server/db/types";
import { activateBots } from "~/server/lib/bots";
import { triggerSpaceUpdate } from "~/server/lib/simple-sync";

// Request/Response schemas
const intentionRequestSchema = z.object({
	action: z.enum(["get", "list", "create", "update", "delete"]),
	spaceId: z.string().optional(),
	intentionId: z.string().optional(),
	data: z
		.object({
			name: z.string().optional(),
			type: z.enum(["utterance", "error"]).optional(),
			state: z
				.enum(["draft", "active", "paused", "complete", "cancelled", "failed"])
				.optional(),
			content: z.array(z.any()).optional(),
			ownerId: z.string().optional(),
			locationId: z.string().optional(),
		})
		.optional(),
});

const intentionResponseSchema = z.object({
	success: z.boolean(),
	data: z.any().optional(),
	error: z.string().optional(),
	version: z.number().optional(),
});

export async function POST(request: Request) {
	try {
		const session = await getServerAuthSession();
		const body = await request.json();
		const { action, spaceId, intentionId, data } =
			intentionRequestSchema.parse(body);

		switch (action) {
			case "get": {
				if (!intentionId) {
					return Response.json({
						success: false,
						error: "intentionId required for get action",
					});
				}

				const intention = await db.query.intentions.findFirst({
					where: eq(intentions.id, intentionId),
				});

				if (!intention) {
					return Response.json({
						success: false,
						error: `Intention with ID "${intentionId}" not found`,
					});
				}

				return Response.json({
					success: true,
					data: intention,
				});
			}

			case "list": {
				if (!spaceId) {
					return Response.json({
						success: false,
						error: "spaceId required for list action",
					});
				}

				const spaceIntentions = await db.query.intentions.findMany({
					where: eq(intentions.locationId, spaceId),
					orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
				});

				return Response.json({
					success: true,
					data: spaceIntentions,
				});
			}

			case "create": {
				if (!session?.user?.beingId) {
					return Response.json(
						{ success: false, error: "Authentication required" },
						{ status: 401 },
					);
				}

				if (!data) {
					return Response.json({
						success: false,
						error: "data required for create action",
					});
				}

				if (!spaceId) {
					return Response.json({
						success: false,
						error: "spaceId required for create action",
					});
				}

				// Get user's being ID
				const userRecord = await db.query.users.findFirst({
					where: eq(users.id, session.user.id),
				});

				if (!userRecord?.beingId) {
					return Response.json({
						success: false,
						error: "User does not have an associated Being",
					});
				}

				// Create new intention
				const newIntentionId: IntentionId = `/${crypto.randomUUID()}`;

				await db.insert(intentions).values({
					id: newIntentionId,
					name: data.name || `Utterance by ${session.user.name ?? "user"}`,
					type: data.type || "utterance",
					state: data.state || "complete",
					ownerId: userRecord.beingId,
					locationId: spaceId,
					content: data.content || [],
				});

				// Fetch created intention
				const result = await db.query.intentions.findFirst({
					where: eq(intentions.id, newIntentionId),
				});

				if (!result) {
					return Response.json({
						success: false,
						error: "Failed to create intention",
					});
				}

				// Trigger space update
				await triggerSpaceUpdate(spaceId as BeingId);

				// Activate bots if this is an utterance
				if (data.type === "utterance" || !data.type) {
					activateBots(spaceId as BeingId, newIntentionId).catch((error) => {
						console.error("Bot activation failed:", error);
					});
				}

				return Response.json({
					success: true,
					data: result,
				});
			}

			case "update": {
				if (!session?.user?.beingId) {
					return Response.json(
						{ success: false, error: "Authentication required" },
						{ status: 401 },
					);
				}

				if (!intentionId) {
					return Response.json({
						success: false,
						error: "intentionId required for update action",
					});
				}

				if (!data) {
					return Response.json({
						success: false,
						error: "data required for update action",
					});
				}

				// Get existing intention
				const existingIntention = await db.query.intentions.findFirst({
					where: eq(intentions.id, intentionId),
				});

				if (!existingIntention) {
					return Response.json({
						success: false,
						error: `Intention with ID "${intentionId}" not found`,
					});
				}

				// Check if user owns this intention or is superuser
				const sessionBeingId = session.user.beingId;
				if (existingIntention.ownerId !== sessionBeingId) {
					// For now, only owners can edit intentions
					return Response.json(
						{
							success: false,
							error: "You can only modify intentions you own",
						},
						{ status: 403 },
					);
				}

				// Update intention
				await db
					.update(intentions)
					.set({
						...data,
						modifiedAt: new Date(),
					})
					.where(eq(intentions.id, intentionId));

				// Fetch updated intention
				const result = await db.query.intentions.findFirst({
					where: eq(intentions.id, intentionId),
				});

				if (!result) {
					return Response.json({
						success: false,
						error: "Failed to update intention",
					});
				}

				// Trigger space update
				await triggerSpaceUpdate(existingIntention.locationId as BeingId);

				return Response.json({
					success: true,
					data: result,
				});
			}

			case "delete": {
				if (!session?.user?.beingId) {
					return Response.json(
						{ success: false, error: "Authentication required" },
						{ status: 401 },
					);
				}

				if (!intentionId) {
					return Response.json({
						success: false,
						error: "intentionId required for delete action",
					});
				}

				// Get intention to delete
				const intentionToDelete = await db.query.intentions.findFirst({
					where: eq(intentions.id, intentionId),
				});

				if (!intentionToDelete) {
					return Response.json({
						success: false,
						error: `Intention with ID "${intentionId}" not found`,
					});
				}

				// Check if user owns this intention
				const sessionBeingId = session.user.beingId;
				if (intentionToDelete.ownerId !== sessionBeingId) {
					return Response.json(
						{
							success: false,
							error: "You can only delete intentions you own",
						},
						{ status: 403 },
					);
				}

				// Delete intention
				await db.delete(intentions).where(eq(intentions.id, intentionId));

				// Trigger space update
				await triggerSpaceUpdate(intentionToDelete.locationId as BeingId);

				return Response.json({
					success: true,
				});
			}

			default:
				return Response.json({
					success: false,
					error: `Invalid action: ${action}`,
				});
		}
	} catch (error) {
		console.error("Intentions API error:", error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 },
		);
	}
}
