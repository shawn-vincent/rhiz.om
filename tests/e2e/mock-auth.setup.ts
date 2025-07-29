// tests/mock-auth.setup.ts
import { test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("mock authentication", async ({ page }) => {
	console.log("🔧 Setting up mock authentication...");

	// Navigate to the app
	await page.goto("/");

	// Mock NextAuth session by setting cookies directly
	const sessionToken = `mock-session-${Date.now()}`;
	const csrfToken = `mock-csrf-${Date.now()}`;

	await page.context().addCookies([
		{
			name: "authjs.session-token",
			value: sessionToken,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
		},
		{
			name: "authjs.csrf-token",
			value: csrfToken,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
		},
	]);

	// Mock the session API response
	await page.route("/api/auth/session", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				user: {
					id: "test-user-id",
					name: "Test User",
					email: "test@example.com",
					beingId: "@test-user-being",
				},
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			}),
		});
	});

	// Mock API endpoints to return success for testing
	await page.route("/api/beings", async (route) => {
		const request = route.request();
		if (request.method() === "POST") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					data: [],
				}),
			});
		} else {
			await route.continue();
		}
	});

	await page.route("/api/intentions", async (route) => {
		const request = route.request();
		if (request.method() === "POST") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					data: [],
				}),
			});
		} else {
			await route.continue();
		}
	});

	// Mock LiveKit endpoints
	await page.route("**/api/trpc/livekit.**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				result: {
					data: {
						token: "mock-livekit-token",
						url: "wss://mock-livekit-server",
						success: true,
					},
				},
			}),
		});
	});

	// Mock tRPC endpoints
	await page.route("**/api/trpc/**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				result: { data: [] },
			}),
		});
	});

	// Save the state with mocked authentication
	await page.context().storageState({ path: authFile });

	console.log("✅ Mock authentication setup complete");
});
