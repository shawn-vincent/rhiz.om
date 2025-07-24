import { Bot, FileText, MapPinned, UserRound } from "lucide-react";
import { forwardRef } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { BeingType } from "../../../packages/entity-kit/src/types";

interface BeingTypeSelectProps {
	value?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

const typeOptions = [
	{ value: "guest", label: "Guest", icon: UserRound },
	{ value: "space", label: "Space", icon: MapPinned },
	{ value: "document", label: "Document", icon: FileText },
	{ value: "bot", label: "Bot", icon: Bot },
] as const;

function TypeOption({ type, label, icon: Icon }: { type: string; label: string; icon: typeof Bot }) {
	return (
		<div className="flex items-center gap-2">
			<Icon className="size-4 text-muted-foreground" />
			<span>{label}</span>
		</div>
	);
}

export const BeingTypeSelect = forwardRef<HTMLButtonElement, BeingTypeSelectProps>(
	({ value, onValueChange, placeholder = "Choose type", disabled }, ref) => {
		const selectedOption = typeOptions.find(opt => opt.value === value);
		

		return (
			<Select 
				key={value} 
				value={value} 
				onValueChange={onValueChange} 
				disabled={disabled}
			>
				<SelectTrigger ref={ref}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{typeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							<TypeOption 
								type={option.value}
								label={option.label}
								icon={option.icon}
							/>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}
);

BeingTypeSelect.displayName = "BeingTypeSelect";