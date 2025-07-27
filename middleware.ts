import { auth } from "~/server/auth";

export default auth((req) => {
	const { pathname } = req.nextUrl;

	// Allow access to auth routes, API routes, and static assets
	if (
		pathname.startsWith("/auth") ||
		pathname.startsWith("/api") ||
		pathname.startsWith("/_next") ||
		pathname.startsWith("/favicon") ||
		pathname.startsWith("/manifest") ||
		pathname.endsWith(".ico") ||
		pathname.endsWith(".png") ||
		pathname.endsWith(".jpg") ||
		pathname.endsWith(".jpeg") ||
		pathname.endsWith(".svg") ||
		pathname.endsWith(".css") ||
		pathname.endsWith(".js") ||
		pathname.endsWith(".json")
	) {
		return;
	}

	// If not authenticated, redirect to sign in
	if (!req.auth) {
		const signInUrl = new URL("/auth/signin", req.url);
		signInUrl.searchParams.set("callbackUrl", req.url);
		return Response.redirect(signInUrl);
	}
});

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
};
