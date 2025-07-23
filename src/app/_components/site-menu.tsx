// src/app/_components/site-menu.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BeingSelectField } from "~/components/being-selector";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { FormProvider, useForm } from "react-hook-form";

function NavigationSelector() {
	const router = useRouter();
	const [selectedBeing, setSelectedBeing] = useState<string>("");
	
	const form = useForm({
		defaultValues: {
			beingId: "",
		},
	});

	const handleGoTo = () => {
		const beingId = form.getValues("beingId");
		if (beingId) {
			router.push(`/being/${beingId}`);
		}
	};

	return (
		<div>
			<FormProvider {...form}>
				<div className="flex items-center gap-2">
					<div className="flex-1">
						<BeingSelectField name="beingId" defaultTypeFilter="space" />
					</div>
					<Button 
						onClick={handleGoTo}
						size="sm"
						className="h-16 w-10 p-0"
						disabled={!form.watch("beingId")}
					>
						<ArrowRight className="h-4 w-4" />
					</Button>
				</div>
			</FormProvider>
		</div>
	);
}

export function SiteMenu() {
	return (
		<ErrorBoundary>
			<div className="flex h-full flex-col">
				<Separator className="bg-white/20" />
				<div className="p-4">
					<h3 className="mb-4 font-medium text-white/80">Navigate To</h3>
					<NavigationSelector />
				</div>
				<div className="mt-auto p-4">
					<Button
						variant="outline"
						className="w-full border-white/20 bg-transparent hover:bg-white/10"
						onClick={() => window.location.href = "/api/auth/signout"}
					>
						Sign Out
					</Button>
				</div>
			</div>
		</ErrorBoundary>
	);
}
