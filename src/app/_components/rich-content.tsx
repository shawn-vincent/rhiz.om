"use client";

import { type FC } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Define the types needed for the component right here for clarity.
// These can also live in a shared types file like `src/server/db/content-types.ts`.
export type ContentNode = string | ContentDataIsland;

export interface ContentDataIsland {
  type: string;
  props?: Record<string, any>;
  content?: ContentNode[];
}

/** colour + border palette per island type */
const typeClass: Record<string, string> = {
  error:
    "not-prose inline-flex items-center gap-1 px-2 py-0.5 rounded-md border " +
    "bg-red-50 border-red-300 text-red-800 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-900/30",
  // …add more types here
  default:
    "not-prose inline-flex items-center gap-1 px-2 py-0.5 rounded-md border " +
    "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-600/50 dark:text-slate-200 dark:hover:bg-slate-800",
};

export const RichContent: FC<{ nodes: ContentNode[] }> = ({ nodes }) => (
  <article className="prose prose-slate dark:prose-invert max-w-none">
    {nodes.map((n, i) =>
      typeof n === "string" ? (
        <ReactMarkdown
          key={i}
          // GitHub-flavoured markdown, safe raw HTML allowed
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          // Map tags to Tailwind-friendly components for better styling control
          components={{
            a: (p) => (
              <a
                {...p}
                className="text-sky-500 underline hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
            code: ({ inline, children, ...p }) =>
              inline ? (
                <code
                  {...p}
                  className="not-prose font-mono bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded"
                >
                  {children}
                </code>
              ) : (
                <pre
                  {...p}
                  className="not-prose bg-slate-900 dark:bg-gray-800/70 text-white p-4 rounded-lg overflow-x-auto"
                >
                  <code>{children}</code>
                </pre>
              ),
            // Add any other custom component overrides here
          }}
        >
          {n}
        </ReactMarkdown>
      ) : (
        <DataIsland key={i} island={n} />
      ),
    )}
  </article>
);

const DataIsland: FC<{ island: ContentDataIsland }> = ({ island }) => {
  const cls = typeClass[island.type] ?? typeClass.default;
  return (
    <span
      tabIndex={0}
      role="button"
      aria-label={`${island.type} data island`}
      title={island.type}
      className={cls}
    >
      {island.content ? <RichContent nodes={island.content} /> : island.type}
    </span>
  );
};
