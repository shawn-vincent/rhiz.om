"use client";

import type { ClassAttributes, FC, HTMLAttributes, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export type ContentNode = string | ContentDataIsland;

export interface ContentDataIsland {
	type: string;
	props?: Record<string, unknown>;
	content?: ContentNode[];
}

const typeClass: Record<string, string> = {
	error:
		"not-prose inline-flex items-center gap-1 px-2 py-0.5 rounded-md border " +
		"bg-red-50 border-red-300 text-red-800 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-900/30",
	default:
		"not-prose inline-flex items-center gap-1 px-2 py-0.5 rounded-md border " +
		"bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-600/50 dark:text-slate-200 dark:hover:bg-slate-800",
};

import ErrorBoundary from "~/components/ui/error-boundary";

export const RichContent: FC<{ nodes: ContentNode[] }> = ({ nodes }) => (
	<ErrorBoundary>
		<article className="prose prose-slate dark:prose-invert max-w-none">
			{nodes.map((n, i) => {
				const key =
					typeof n === "string" ? `string-${i}` : `island-${i}-${n.type}`;
				return typeof n === "string" ? (
					<ReactMarkdown
						key={key}
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeRaw, rehypeSanitize]}
						components={{
							a: (props) => (
								<a
									{...props}
									className="text-sky-500 underline hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
									target="_blank"
									rel="noopener noreferrer"
								/>
							),
							code: (props) => {
								const { children, className } = props;
								// Check for language class to determine if it's a block or inline
								const isBlock = /language-/.test(className || "");

								if (isBlock) {
									return (
										<pre className="not-prose overflow-x-auto rounded-lg bg-slate-900 p-4 text-white dark:bg-gray-800/70">
											<code className={className}>{children}</code>
										</pre>
									);
								}

								return (
									<code className="not-prose rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-800 dark:bg-slate-700 dark:text-slate-200">
										{children}
									</code>
								);
							},
						}}
					>
						{n}
					</ReactMarkdown>
				) : (
					<DataIsland key={key} island={n} />
				);
			})}
		</article>
	</ErrorBoundary>
);

const DataIsland: FC<{ island: ContentDataIsland }> = ({ island }) => {
	const cls = typeClass[island.type] ?? typeClass.default;
	return (
		<button
			type="button"
			aria-label={`${island.type} data island`}
			title={island.type}
			className={cls}
		>
			{island.content ? <RichContent nodes={island.content} /> : island.type}
		</button>
	);
};
