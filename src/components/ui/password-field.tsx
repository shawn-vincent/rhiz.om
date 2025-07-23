"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { Eye, EyeOff } from "lucide-react";

export function PasswordField(props: React.ComponentProps<typeof Input>) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="relative">
			<Input
				type={visible ? "text" : "password"}
				autoComplete="current-password"
				{...props}
			/>
			<Button
				type="button"
				size="icon"
				variant="ghost"
				onClick={() => setVisible(!visible)}
				className="absolute right-2 top-1/2 -translate-y-1/2"
			>
				{visible ? (
					<EyeOff className="h-4 w-4" />
				) : (
					<Eye className="h-4 w-4" />
				)}
			</Button>
		</div>
	);
}