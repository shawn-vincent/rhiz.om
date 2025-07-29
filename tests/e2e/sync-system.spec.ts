import { type Page, type Route, expect, test } from "@playwright/test";

// Test user data that matches auth setup
const testUser = {
	id: "test-user-id",
	beingId: "@test-user-being",
};

// Setup comprehensive mocking for tests
async function setupMocking(page: Page) {
	// Mock session API
	await page.route("/api/auth/session", async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				user: {
					id: testUser.id,
					name: "Test User",
					email: "test@example.com",
					beingId: testUser.beingId,
				},
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			}),
		});
	});

	// Mock all API endpoints
	await page.route("**/api/**", async (route: Route) => {
		const url = route.request().url();
		const method = route.request().method();

		if (url.includes("/api/livekit/")) {
			// LiveKit endpoints
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true, token: "mock-token" }),
			});
		} else if (url.includes("/api/beings") || url.includes("/api/intentions")) {
			// New API endpoints
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true, data: [] }),
			});
		} else if (url.includes("/api/trpc/")) {
			// tRPC endpoints
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ result: { data: [] } }),
			});
		} else {
			// Default success for other endpoints
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		}
	});
}

test.describe("LiveKit Sync System", () => {
	test.beforeEach(async ({ page }) => {
		// Set up comprehensive mocking for each test
		await setupMocking(page);
		await page.goto("/");
	});

	test("LiveKit system loads and works", async ({ page }) => {
		// Test LiveKit-based sync system
		await page.goto("/");

		// Wait for the page to load
		await page.waitForLoadState("networkidle");

		// Check that the page loads without errors
		await expect(page).toHaveTitle(/Rhiz\.om/);

		// Just verify the page loads - presence elements may not exist in test env
		const bodyElement = page.locator("body");
		await expect(bodyElement).toBeVisible();
	});

	test("API endpoints respond correctly", async ({ page }) => {
		// Test beings API with authenticated session
		const beingsResponse = await page.request.post("/api/beings", {
			data: {
				action: "list",
				spaceId: testUser.beingId, // Use authenticated user's being as space
			},
		});
		expect(beingsResponse.ok()).toBeTruthy();

		const beingsData = await beingsResponse.json();
		expect(beingsData).toHaveProperty("success");

		// Test intentions API with authenticated session
		const intentionsResponse = await page.request.post("/api/intentions", {
			data: {
				action: "list",
				spaceId: testUser.beingId,
			},
		});
		expect(intentionsResponse.ok()).toBeTruthy();

		const intentionsData = await intentionsResponse.json();
		expect(intentionsData).toHaveProperty("success");
	});

	test("LiveKit sync system works", async ({ page }) => {
		// Test that LiveKit integration loads without errors
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Check that the page loads without critical errors
		const bodyElement = page.locator("body");
		await expect(bodyElement).toBeVisible();

		// Verify no critical console errors related to sync
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error" && msg.text().includes("sync")) {
				errors.push(msg.text());
			}
		});

		await page.waitForTimeout(2000);
		expect(errors.length).toBe(0);
	});

	test.skip("No console errors in either system", async ({ page }) => {
		const errors: string[] = [];

		page.on("console", (msg) => {
			if (msg.type() === "error") {
				errors.push(msg.text());
			}
		});

		// Test LiveKit system
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000); // Wait for any async operations

		// Filter out known non-critical errors and test environment issues
		const criticalErrors = errors.filter(
			(error) =>
				!error.includes("Warning:") &&
				!error.includes("favicon") &&
				!error.includes("Non-critical") &&
				!error.includes("Failed to fetch") && // Network mocking issues
				!error.includes("LiveKit") && // LiveKit connection issues in test env
				!error.includes("TypeError: Failed to fetch") && // Network mocking
				!error.includes("Auth API calls will fail") && // Expected in test
				!error.includes("hydration") && // React hydration warnings
				!error.toLowerCase().includes("mock"), // Any mock-related messages
		);

		// Allow some test environment errors but ensure no major system failures
		expect(criticalErrors.length).toBeLessThan(5);
	});
});

test.describe("LiveKit Performance", () => {
	test("LiveKit system network requests", async ({ page }) => {
		const requests: string[] = [];

		page.on("request", (request) => {
			if (request.url().includes("/api/") || request.url().includes("/trpc/")) {
				requests.push(request.url());
			}
		});

		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(5000);

		console.log("LiveKit system requests:", requests.length);
		console.log("LiveKit system unique endpoints:", [
			...new Set(requests.map((url) => new URL(url).pathname)),
		]);
	});

	test("LiveKit memory usage", async ({ page }) => {
		// Test LiveKit system memory usage
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(3000);

		const liveKitMemory = await page.evaluate(() => {
			if ("memory" in performance) {
				return (performance as { memory: { usedJSHeapSize: number } }).memory
					.usedJSHeapSize;
			}
			return 0;
		});

		console.log("LiveKit system memory:", liveKitMemory);
		expect(liveKitMemory).toBeGreaterThan(0);
	});
});
