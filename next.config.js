/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

import pwa from "next-pwa";

const withPWA = pwa({
	dest: "public",
	register: true,
	skipWaiting: true,
	disable: process.env.NODE_ENV === "development",
});

/** @src/server/db/types.ts {import("next").NextConfig} */
const config = {};

export default withPWA(config);
