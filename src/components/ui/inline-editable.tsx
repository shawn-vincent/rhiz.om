// src/components/ui/inline-editable.tsx
"use client";

import { Check, Edit3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

interface InlineEditableProps {
	value: string;
	onSave: (newValue: string) => Promise<void> | void;
	className?: string;
	placeholder?: string;
	displayClassName?: string;
	inputClassName?: string;
	disabled?: boolean;
	maxLength?: number;
	validation?: (value: string) => string | null;
}

export function InlineEditable({
	value,
	onSave,
	className,
	placeholder = "Click to edit",
	displayClassName,
	inputClassName,
	disabled = false,
	maxLength,
	validation,
}: InlineEditableProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditValue(value);
	}, [value]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleEdit = () => {
		if (disabled) return;
		setIsEditing(true);
		setError(null);
	};

	const handleCancel = () => {
		setEditValue(value);
		setIsEditing(false);
		setError(null);
	};

	const handleSave = async () => {
		if (validation) {
			const validationError = validation(editValue);
			if (validationError) {
				setError(validationError);
				return;
			}
		}

		if (editValue.trim() === value.trim()) {
			setIsEditing(false);
			return;
		}

		try {
			setIsLoading(true);
			setError(null);
			await onSave(editValue.trim());
			setIsEditing(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.preventDefault();
			handleCancel();
		}
	};

	if (isEditing) {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				<div className="flex-1">
					<Input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						maxLength={maxLength}
						className={cn("h-8", inputClassName)}
						disabled={isLoading}
					/>
					{error && <p className="mt-1 text-destructive text-xs">{error}</p>}
				</div>
				<div className="flex items-center gap-1">
					<Button
						size="icon"
						variant="ghost"
						className="size-8"
						onClick={handleSave}
						disabled={isLoading}
						aria-label="Save"
					>
						<Check className="size-3" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-8"
						onClick={handleCancel}
						disabled={isLoading}
						aria-label="Cancel"
					>
						<X className="size-3" />
					</Button>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={handleEdit}
			disabled={disabled}
			className={cn(
				"group flex items-center gap-2 text-left transition-colors",
				disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-80",
				displayClassName,
			)}
		>
			<span className="flex-1 truncate">{value || placeholder}</span>
			<Edit3 className="size-3 opacity-0 transition-opacity group-hover:opacity-50" />
		</button>
	);
}

// Simplified version for just text editing
interface InlineTextProps {
	value: string;
	onSave: (newValue: string) => Promise<void> | void;
	className?: string;
	placeholder?: string;
	disabled?: boolean;
}

export function InlineText({
	value,
	onSave,
	className,
	placeholder = "Click to edit",
	disabled = false,
}: InlineTextProps) {
	return (
		<InlineEditable
			value={value}
			onSave={onSave}
			displayClassName={className}
			placeholder={placeholder}
			disabled={disabled}
			validation={(val) => {
				if (!val.trim()) return "Value cannot be empty";
				if (val.length > 100) return "Value too long";
				return null;
			}}
		/>
	);
}
