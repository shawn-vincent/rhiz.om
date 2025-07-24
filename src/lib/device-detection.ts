// src/lib/device-detection.ts
"use client";

/**
 * Detects if the user is on a mobile device based on user agent,
 * not screen size. This is more reliable for PWA install prompts.
 */
export function isMobileDevice(): boolean {
	if (typeof window === "undefined") return false;

	const userAgent = navigator.userAgent.toLowerCase();

	// Check for mobile user agents
	const mobileRegex =
		/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

	// Additional specific checks
	const isAndroid = /android/i.test(userAgent);
	const isIOS = /iphone|ipad|ipod/i.test(userAgent);
	const isWindowsPhone = /windows phone/i.test(userAgent);
	const isBlackBerry = /blackberry/i.test(userAgent);

	return (
		mobileRegex.test(userAgent) ||
		isAndroid ||
		isIOS ||
		isWindowsPhone ||
		isBlackBerry
	);
}

/**
 * Checks if the PWA install prompt is available
 */
export function isPWAInstallable(): boolean {
	if (typeof window === "undefined") return false;

	// Check if beforeinstallprompt event is supported
	return "onbeforeinstallprompt" in window;
}
