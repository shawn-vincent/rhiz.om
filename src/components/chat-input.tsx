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
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	placeholder?: string;
}

export interface ChatInputRef {
	focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
	(
		{
			value,
			onChange,
			onSubmit,
			disabled = false,
			placeholder = "Say something...",
		},
		ref,
	) => {
		const editorRef = useRef<any>(null);

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
		}, [disabled, onSubmit]); // Remove 'value' dependency to reduce recreation

		// Create custom dark theme using createTheme - memoize to avoid recreation
		const customDarkTheme = useMemo(() => createTheme({
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
		}), []);

		// Additional styling for border radius and layout with forced dark background - memoize
		const borderRadiusTheme = useMemo(() => EditorView.theme(
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
		), []);

		// CodeMirror extensions - memoize to avoid recreation
		const extensions = useMemo(() => [
			markdown(),
			customDarkTheme,
			borderRadiusTheme,
			chatKeymap,
			EditorView.lineWrapping,
		], [customDarkTheme, borderRadiusTheme, chatKeymap]);

		// Optimize onChange to avoid excessive re-renders
		const handleChange = useCallback((val: string) => {
			onChange(val);
		}, [onChange]);

		return (
			<div className="flex w-full min-w-0 items-end gap-2">
				<div className="[&_.cm-editor]:!bg-gray-800 [&_.cm-content]:!bg-gray-800 [&_.cm-content]:!text-white [&_.cm-scroller]:!bg-gray-800 [&_.cm-line]:!text-white [&_.cm-placeholder]:!text-gray-400 min-w-0 flex-1">
					<CodeMirror
						ref={editorRef}
						value={value}
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
					disabled={disabled || !value.trim()}
					aria-label={disabled ? "Sending..." : "Send message"}
				>
					<Send className="size-4" />
				</button>
			</div>
		);
	},
);

ChatInput.displayName = "ChatInput";
