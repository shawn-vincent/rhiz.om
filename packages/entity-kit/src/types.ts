export type BeingType = "space" | "guest" | "bot" | "document";

import type { BeingId } from "../../../src/lib/types/ids";

export interface EntitySummary {
	id: BeingId;
	name: string;
	type: BeingType;
	avatarUrl?: string;
}
