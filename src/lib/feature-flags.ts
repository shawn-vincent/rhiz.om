// Simple feature flags for testing new sync system
export const FEATURE_FLAGS = {
	// Enable new simple sync system
	USE_SIMPLE_SYNC: process.env.NEXT_PUBLIC_USE_SIMPLE_SYNC === "true" || false,
} as const;

export function useFeatureFlag(flag: keyof typeof FEATURE_FLAGS): boolean {
	return FEATURE_FLAGS[flag];
}
