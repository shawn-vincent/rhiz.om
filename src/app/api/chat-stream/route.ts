import type { NextRequest } from "next/server";
import { emitter } from "~/lib/events";

// This forces the route to be dynamic and not cached
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const intentionId = searchParams.get("intentionId");

	if (!intentionId) {
		return new Response("Missing intentionId parameter", { status: 400 });
	}

	const stream = new ReadableStream({
		start(controller) {
			const onUpdate = (data: {
				type: "token" | "end" | "error";
				data?: string;
			}) => {
				const chunk = `data: ${JSON.stringify(data)}

`;
				controller.enqueue(new TextEncoder().encode(chunk));

				// If the background task is done or failed, close the connection
				if (data.type === "end" || data.type === "error") {
					emitter.off(`update.${intentionId}`, onUpdate); // Important: clean up the listener
					controller.close();
				}
			};

			// Start listening to events for this specific intention
			emitter.on(`update.${intentionId}`, onUpdate);

			// Clean up when the client closes the connection
			request.signal.addEventListener("abort", () => {
				emitter.off(`update.${intentionId}`, onUpdate);
				controller.close();
			});
		},
	});

	// Return the stream with the correct headers for SSE
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}
