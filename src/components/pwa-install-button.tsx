// src/components/pwa-install-button.tsx
"use client";

import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePWAInstall } from "~/hooks/use-pwa-install";

export function PWAInstallButton() {
	const { isInstallable, installPWA } = usePWAInstall();

	if (!isInstallable) {
		return null;
	}

	const handleInstall = async () => {
		const success = await installPWA();
		if (success) {
			console.log("PWA installed successfully");
		}
	};

	return (
		<Button
			variant="outline"
			className="w-full gap-2 border-white/20 bg-transparent hover:bg-white/10"
			onClick={handleInstall}
		>
			<Download className="h-4 w-4" />
			Install App
		</Button>
	);
}
