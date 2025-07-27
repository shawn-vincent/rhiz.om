import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},

	projects: [
		// Setup project to create mock authenticated state
		{
			name: "setup",
			testMatch: /mock-auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "playwright/.auth/user.json",
			},
			dependencies: ["setup"],
		},
		{
			name: "firefox",
			use: {
				...devices["Desktop Firefox"],
				storageState: "playwright/.auth/user.json",
			},
			dependencies: ["setup"],
		},
		{
			name: "webkit",
			use: {
				...devices["Desktop Safari"],
				storageState: "playwright/.auth/user.json",
			},
			dependencies: ["setup"],
		},
	],

	webServer: {
		command: "npm run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
	},
});
