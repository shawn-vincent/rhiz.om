"use client";

import { markdown } from "@codemirror/lang-markdown";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "@uiw/codemirror-themes";
import CodeMirror from "@uiw/react-codemirror";
import { Send } from "lucide-react";
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { Avatar } from "~/components/ui/avatar";
import type { BeingId } from "~/lib/types";
import { EntityCard } from "../../packages/entity-kit/src/components/ui/EntityCard";
import type { EntitySummary } from "../../packages/entity-kit/src/types";
import { useBeing } from "~/hooks/use-beings";
import { BeingEditModal } from "~/components/being-edit-modal";
import { canEdit as canEditPermission, isSuperuser } from "~/lib/permissions";
import { useSession } from "next-auth/react";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	placeholder?: string;
	currentUserBeingId?: BeingId;
}

export interface ChatInputRef {
	focus: () => void;
}

const ChatInputComponent = forwardRef<ChatInputRef, ChatInputProps>(
	(
		{
			value,
			onChange,
			onSubmit,
			disabled = false,
			placeholder = "Say something...",
			currentUserBeingId,
		},
		ref,
	) => {
		const editorRef = useRef<{ view?: any }>(null);
		const [showPopover, setShowPopover] = useState(false);
		const [selectedBeingId, setSelectedBeingId] = useState<BeingId | null>(null);
		const [editingBeingId, setEditingBeingId] = useState<BeingId | null>(null);
		const popoverRef = useRef<HTMLDivElement>(null);

		// Get session data for permissions
		const { data: session } = useSession();

		// Fetch current user's being data
		const { data: currentUserBeing } = useBeing(currentUserBeingId || "@");

		// Expose focus method via ref
		useImperativeHandle(ref, () => ({
			focus: () => {
				if (editorRef.current?.view) {
					editorRef.current.view.focus();
				}
			},
		}));

		// Create keymap for Enter/Shift+Enter handling - memoize to avoid recreating on value changes
		const chatKeymap = useMemo(() => {
			return Prec.high(
				keymap.of([
					{
						key: "Enter",
						run: (view) => {
							const currentValue = view.state.doc.toString();
							if (!disabled && currentValue.trim()) {
								// Immediately sync the current value before submit
								if (currentValue !== value) {
									onChange(currentValue);
								}
								onSubmit();
								return true; // Prevent default newline insertion
							}
							return false; // Allow default behavior if no text
						},
					},
					{
						key: "Shift-Enter",
						run: (view) => {
							// Let CodeMirror handle the newline insertion
							return false;
						},
					},
				]),
			);
		}, [disabled, onSubmit, onChange]); // Include onChange dependency

		// Create custom dark theme using createTheme - memoize to avoid recreation
		const customDarkTheme = useMemo(
			() =>
				createTheme({
					theme: "dark",
					settings: {
						background: "#1f2937", // gray-800
						foreground: "#ffffff",
						caret: "#3b82f6", // blue-500
						selection: "rgba(59, 130, 246, 0.2)",
						selectionMatch: "rgba(59, 130, 246, 0.1)",
						lineHighlight: "transparent",
						gutterBackground: "#1f2937",
						gutterForeground: "#9ca3af",
						fontFamily:
							"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
					},
					styles: [
						{ tag: t.comment, color: "#6b7280" },
						{ tag: t.variableName, color: "#ffffff" },
						{ tag: t.string, color: "#34d399" },
						{ tag: t.number, color: "#fbbf24" },
						{ tag: t.bool, color: "#f87171" },
						{ tag: t.null, color: "#f87171" },
						{ tag: t.keyword, color: "#818cf8" },
						{ tag: t.operator, color: "#ffffff" },
						{ tag: t.className, color: "#60a5fa" },
						{ tag: t.definition(t.typeName), color: "#60a5fa" },
						{ tag: t.typeName, color: "#60a5fa" },
						{ tag: t.angleBracket, color: "#9ca3af" },
						{ tag: t.tagName, color: "#f472b6" },
						{ tag: t.attributeName, color: "#fbbf24" },
					],
				}),
			[],
		);

		// Additional styling for border radius and layout with forced dark background - memoize
		const borderRadiusTheme = useMemo(
			() =>
				EditorView.theme(
					{
						"&": {
							borderRadius: "9999px",
							overflow: "hidden",
							backgroundColor: "#1f2937 !important", // Force dark background
						},
						".cm-editor": {
							borderRadius: "9999px",
							border: "1px solid #374151", // gray-700
							transition: "border-color 0.2s ease-in-out",
							backgroundColor: "#1f2937 !important", // Force dark background
						},
						".cm-editor.cm-focused": {
							borderColor: "#3b82f6", // blue-500
							boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
							backgroundColor: "#1f2937 !important", // Force dark background
						},
						".cm-content": {
							padding: "12px 16px",
							minHeight: "44px",
							maxHeight: "calc(2.5 * 1.5em + 24px)",
							overflow: "auto",
							backgroundColor: "#1f2937 !important", // Force dark background
							color: "#ffffff !important", // Force white text
						},
						".cm-focused": {
							outline: "none",
						},
						".cm-line": {
							lineHeight: "1.5",
							color: "#ffffff !important", // Force white text
						},
						".cm-placeholder": {
							fontStyle: "normal",
							color: "#9ca3af !important", // Force gray placeholder
						},
						".cm-scroller": {
							backgroundColor: "#1f2937 !important", // Force dark background
						},
					},
					{ dark: true },
				),
			[],
		);

		// CodeMirror extensions - memoize to avoid recreation
		const extensions = useMemo(
			() => [
				markdown(),
				customDarkTheme,
				borderRadiusTheme,
				chatKeymap,
				EditorView.lineWrapping,
			],
			[customDarkTheme, borderRadiusTheme, chatKeymap],
		);

		// Add debounced onChange to reduce performance impact
		const [localValue, setLocalValue] = useState(value);

		// Sync local value with prop value when it changes externally
		useEffect(() => {
			setLocalValue(value);
		}, [value]);

		// Debounce onChange calls to reduce performance impact
		useEffect(() => {
			const timer = setTimeout(() => {
				if (localValue !== value) {
					onChange(localValue);
				}
			}, 50); // 50ms debounce

			return () => clearTimeout(timer);
		}, [localValue, value, onChange]);

		// Optimize onChange to avoid excessive re-renders
		const handleChange = useCallback((val: string) => {
			setLocalValue(val);
		}, []);

		// Handle avatar click to show/hide popover
		const handleTogglePopover = useCallback(() => {
			setShowPopover(!showPopover);
		}, [showPopover]);

		const handleClosePopover = useCallback(() => {
			setShowPopover(false);
			setSelectedBeingId(null);
		}, []);

		const handleEditBeing = useCallback((beingId: BeingId) => {
			setEditingBeingId(beingId);
			setShowPopover(false);
		}, []);

		const handleCloseEditModal = useCallback(() => {
			setEditingBeingId(null);
		}, []);

		// Click outside handler for popover
		useEffect(() => {
			function handleClickOutside(event: MouseEvent) {
				if (
					popoverRef.current &&
					!popoverRef.current.contains(event.target as Node)
				) {
					handleClosePopover();
				}
			}

			if (showPopover) {
				document.addEventListener("mousedown", handleClickOutside);
				return () =>
					document.removeEventListener("mousedown", handleClickOutside);
			}
		}, [showPopover, handleClosePopover]);

		// Convert being data to EntitySummary format
		const userEntitySummary = useMemo((): EntitySummary | null => {
			if (!currentUserBeing) return null;
			return {
				id: currentUserBeing.id,
				name: currentUserBeing.name,
				type: currentUserBeing.type as any,
			};
		}, [currentUserBeing]);

		// Check if current user can edit their own being
		const canEditCurrentUser = useMemo(() => {
			if (!currentUserBeing || !session?.user?.beingId) return false;
			const isCurrentUserSuperuser = isSuperuser(currentUserBeing);
			return canEditPermission(
				session.user.beingId,
				currentUserBeing.ownerId,
				isCurrentUserSuperuser,
			);
		}, [currentUserBeing, session]);

		return (
			<div className="flex w-full min-w-0 items-end gap-2">
				<div className="[&_.cm-editor]:!bg-gray-800 [&_.cm-content]:!bg-gray-800 [&_.cm-content]:!text-white [&_.cm-scroller]:!bg-gray-800 [&_.cm-line]:!text-white [&_.cm-placeholder]:!text-gray-400 min-w-0 flex-1">
					<CodeMirror
						ref={editorRef}
						value={localValue}
						onChange={handleChange}
						placeholder={placeholder}
						theme="dark"
						extensions={extensions}
						basicSetup={{
							lineNumbers: false,
							autocompletion: false,
							highlightSelectionMatches: false,
							searchKeymap: false,
							foldGutter: false,
							dropCursor: false,
							allowMultipleSelections: false,
							indentOnInput: false,
							bracketMatching: false,
							closeBrackets: false,
							rectangularSelection: false,
							highlightActiveLine: false,
							tabSize: 2,
						}}
						editable={!disabled}
					/>
				</div>
				<button
					type="button"
					onClick={onSubmit}
					className="shrink-0 rounded-full bg-blue-500 p-2 text-white transition hover:bg-blue-600 disabled:opacity-50"
					disabled={disabled || !localValue.trim()}
					aria-label={disabled ? "Sending..." : "Send message"}
				>
					<Send className="size-4" />
				</button>
				{currentUserBeingId && (
					<div className="relative shrink-0">
						<div
							className="cursor-pointer"
							onClick={handleTogglePopover}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									handleTogglePopover();
								}
							}}
							tabIndex={0}
							role="button"
							aria-label="Show user details"
						>
							<Avatar
								beingId={currentUserBeingId}
								beingType="guest"
								size="md"
								className="transition-opacity hover:opacity-80"
							/>
						</div>

						{/* Popover for user card */}
						{showPopover && userEntitySummary && (
							<div
								ref={popoverRef}
								className="absolute bottom-full right-full z-50 mb-2 mr-2 w-64 rounded-md border bg-popover p-2 shadow-md"
							>
								<EntityCard
									entity={userEntitySummary}
									variant="compact"
									isOnline={true}
									onClick={() => setSelectedBeingId(userEntitySummary.id)}
									onEdit={
										canEditCurrentUser
											? () => handleEditBeing(userEntitySummary.id)
											: undefined
									}
									isSelected={selectedBeingId === userEntitySummary.id}
									showEditButton={
										!!(selectedBeingId === userEntitySummary.id && canEditCurrentUser)
									}
								/>
							</div>
						)}
					</div>
				)}

				{/* Edit modal */}
				<BeingEditModal
					beingId={editingBeingId}
					isOpen={!!editingBeingId}
					onClose={handleCloseEditModal}
				/>
			</div>
		);
	},
);

ChatInputComponent.displayName = "ChatInput";

// Memoize the component to prevent unnecessary re-renders
export const ChatInput = memo(ChatInputComponent);
