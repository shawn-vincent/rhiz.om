/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			borderRadius: {
				"entity-card": "var(--entity-card-radius)",
			},
			colors: {
				"entity-accent-space": "var(--entity-accent-space)",
				"entity-accent-guest": "var(--entity-accent-guest)",
				"entity-accent-bot": "var(--entity-accent-bot)",
				"entity-accent-doc": "var(--entity-accent-doc)",
			},
			spacing: {
				// 4px grid system for precise mobile spacing
				0.5: "2px", // 0.5 * 4px
				1: "4px", // 1 * 4px
				1.5: "6px", // 1.5 * 4px
				2: "8px", // 2 * 4px
				3: "12px", // 3 * 4px
				4: "16px", // 4 * 4px
				5: "20px", // 5 * 4px
				6: "24px", // 6 * 4px
				7: "28px", // 7 * 4px
				8: "32px", // 8 * 4px
				10: "40px", // 10 * 4px
				12: "48px", // 12 * 4px
				14: "56px", // 14 * 4px
				16: "64px", // 16 * 4px
				20: "80px", // 20 * 4px
				// Mobile-optimized component sizes
				"mobile-touch": "44px", // iOS/Android minimum touch target
				"mobile-margin": "16px", // Standard mobile side margins
				"mobile-gap": "12px", // Standard mobile component gaps
			},
			screens: {
				// Mobile-first breakpoints based on real device data
				xs: "320px", // Small phones
				sm: "375px", // iPhone SE, standard phones
				md: "768px", // iPad portrait, large phones landscape
				lg: "1024px", // iPad landscape, small laptops
				xl: "1280px", // Standard desktop
				"2xl": "1536px", // Large desktop
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
