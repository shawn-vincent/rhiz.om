// src/hooks/use-pwa-install.ts
"use client";

import { useEffect, useState } from "react";
import { isMobileDevice, isPWAInstallable } from "~/lib/device-detection";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isInstallable, setIsInstallable] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);

	useEffect(() => {
		// Check if we're on mobile and PWA is installable
		const shouldShowInstall = isMobileDevice() && isPWAInstallable();

		if (!shouldShowInstall) {
			setIsInstallable(false);
			return;
		}

		// Check if already installed
		const checkIfInstalled = () => {
			// Check for standalone mode (already installed)
			const isStandalone = window.matchMedia(
				"(display-mode: standalone)",
			).matches;
			// Check for iOS Safari standalone
			const isIOSStandalone = (window.navigator as any).standalone === true;

			setIsInstalled(isStandalone || isIOSStandalone);
		};

		checkIfInstalled();

		// Listen for beforeinstallprompt event
		const handleBeforeInstallPrompt = (e: Event) => {
			const event = e as BeforeInstallPromptEvent;
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Save the event so it can be triggered later
			setDeferredPrompt(event);
			setIsInstallable(true);
		};

		// Listen for app installed event
		const handleAppInstalled = () => {
			setIsInstalled(true);
			setIsInstallable(false);
			setDeferredPrompt(null);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleAppInstalled);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, []);

	const installPWA = async () => {
		if (!deferredPrompt) return false;

		try {
			// Show the install prompt
			await deferredPrompt.prompt();

			// Wait for the user to respond to the prompt
			const { outcome } = await deferredPrompt.userChoice;

			// Clean up
			setDeferredPrompt(null);
			setIsInstallable(false);

			return outcome === "accepted";
		} catch (error) {
			console.error("Error installing PWA:", error);
			return false;
		}
	};

	return {
		isInstallable: isInstallable && !isInstalled,
		isInstalled,
		installPWA,
	};
}
