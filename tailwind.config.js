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
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
