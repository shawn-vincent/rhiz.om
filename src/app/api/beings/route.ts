import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { canEdit } from "~/lib/permissions";
import { getAuthContext } from "~/server/lib/auth";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";
import type { BeingId } from "~/server/db/types";
import { triggerSpaceUpdate } from "~/server/lib/simple-sync";

// Request/Response schemas
const beingRequestSchema = z.object({
	action: z.enum(["get", "list", "create", "update", "delete"]),
	spaceId: z.string().optional(),
	beingId: z.string().optional(),
	data: insertBeingSchema.partial().optional(),
});

const beingResponseSchema = z.object({
	success: z.boolean(),
	data: z.union([selectBeingSchema, z.array(selectBeingSchema)]).optional(),
	error: z.string().optional(),
	version: z.number().optional(),
});

export async function POST(request: Request) {
	try {
		const session = await getServerAuthSession();
		const body = await request.json();
		const { action, spaceId, beingId, data } = beingRequestSchema.parse(body);

		switch (action) {
			case "get": {
				if (!beingId) {
					return Response.json({
						success: false,
						error: "beingId required for get action",
					});
				}

				const being = await db.query.beings.findFirst({
					where: eq(beings.id, beingId),
				});

				if (!being) {
					return Response.json({
						success: false,
						error: `Being with ID "${beingId}" not found`,
					});
				}

				return Response.json({
					success: true,
					data: selectBeingSchema.parse(being),
				});
			}

			case "list": {
				if (!spaceId) {
					return Response.json({
						success: false,
						error: "spaceId required for list action",
					});
				}

				const spaceBeings = await db.query.beings.findMany({
					where: eq(beings.locationId, spaceId),
					orderBy: (beings, { asc }) => [asc(beings.name)],
				});

				return Response.json({
					success: true,
					data: spaceBeings.map((being) => selectBeingSchema.parse(being)),
				});
			}

			case "create":
			case "update": {
				if (!session?.user?.beingId) {
					return Response.json(
						{ success: false, error: "Authentication required" },
						{ status: 401 },
					);
				}

				if (!data) {
					return Response.json({
						success: false,
						error: "data required for create/update action",
					});
				}

				// For create, generate ID if not provided
				const targetId = beingId || data.id || `@${crypto.randomUUID()}`;
				const { sessionBeingId, isCurrentUserSuperuser } = await getAuthContext(
					session.user.beingId,
				);

				// Authorization check
				if (!canEdit(sessionBeingId, data.ownerId, isCurrentUserSuperuser)) {
					return Response.json(
						{
							success: false,
							error: `You can only modify beings you own or have superuser access to`,
						},
						{ status: 403 },
					);
				}

				// Get existing being for location change detection
				const existingBeing = await db.query.beings.findFirst({
					where: eq(beings.id, targetId),
				});

				// Perform upsert - ensure required fields are present
				const upsertData = {
					id: targetId,
					name: data.name || "Unnamed Being",
					type: data.type || "guest",
					modifiedAt: new Date(),
					...data,
				};

				await db
					.insert(beings)
					.values(upsertData)
					.onConflictDoUpdate({
						target: beings.id,
						set: {
							...upsertData,
							modifiedAt: new Date(),
						},
					});

				// Fetch result
				const result = await db.query.beings.findFirst({
					where: eq(beings.id, targetId),
				});

				if (!result) {
					return Response.json({
						success: false,
						error: "Failed to create or update being",
					});
				}

				const parsedResult = selectBeingSchema.parse(result);

				// Trigger sync updates for affected spaces
				if (existingBeing?.locationId) {
					await triggerSpaceUpdate(existingBeing.locationId as BeingId);
				}
				if (
					parsedResult.locationId &&
					parsedResult.locationId !== existingBeing?.locationId
				) {
					await triggerSpaceUpdate(parsedResult.locationId as BeingId);
				}

				return Response.json({
					success: true,
					data: parsedResult,
				});
			}

			case "delete": {
				if (!session?.user?.beingId) {
					return Response.json(
						{ success: false, error: "Authentication required" },
						{ status: 401 },
					);
				}

				if (!beingId) {
					return Response.json({
						success: false,
						error: "beingId required for delete action",
					});
				}

				const { sessionBeingId, isCurrentUserSuperuser } = await getAuthContext(
					session.user.beingId,
				);

				// Get being to delete
				const beingToDelete = await db.query.beings.findFirst({
					where: eq(beings.id, beingId),
				});

				if (!beingToDelete) {
					return Response.json({
						success: false,
						error: `Being with ID "${beingId}" not found`,
					});
				}

				// Authorization check
				if (
					!canEdit(
						sessionBeingId,
						beingToDelete.ownerId,
						isCurrentUserSuperuser,
					)
				) {
					return Response.json(
						{
							success: false,
							error: `You can only delete beings you own or have superuser access to`,
						},
						{ status: 403 },
					);
				}

				// Delete being
				await db.delete(beings).where(eq(beings.id, beingId));

				// Trigger sync update for the space
				if (beingToDelete.locationId) {
					await triggerSpaceUpdate(beingToDelete.locationId as BeingId);
				}

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
		console.error("Beings API error:", error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 },
		);
	}
}
