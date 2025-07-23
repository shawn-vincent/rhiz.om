/**
 * Permission utilities for checking user access rights
 */

import type { Being } from "~/server/db/types";

/**
 * Check if a being is a superuser
 */
export function isSuperuser(being: Being | null | undefined): boolean {
	if (!being) return false;

	// Check if the being has a superuser property set to true
	const properties = being.properties as Record<string, unknown> | null;
	return properties?.superuser === true;
}

/**
 * Check if a user can edit a specific being
 * @param currentUserBeing - The being of the current user
 * @param targetBeing - The being to check edit permissions for
 * @returns true if the user can edit the target being
 */
export function canEditBeing(
	currentUserBeing: Being | null | undefined,
	targetBeing: { ownerId: string | null | undefined } | null | undefined,
): boolean {
	if (!currentUserBeing || !targetBeing) return false;

	// Superusers can edit anything
	if (isSuperuser(currentUserBeing)) return true;

	// Regular users can only edit beings they own
	return currentUserBeing.id === targetBeing.ownerId;
}

/**
 * Check if a user being ID has edit permissions for a target
 * This is a simplified version for components that only have IDs
 */
export function canEdit(
	currentUserBeingId: string | null | undefined,
	targetOwnerId: string | null | undefined,
	currentUserIsSuperuser = false,
): boolean {
	if (!currentUserBeingId) return false;

	// Superusers can edit anything
	if (currentUserIsSuperuser) return true;

	// Regular users can only edit beings they own
	return currentUserBeingId === targetOwnerId;
}
