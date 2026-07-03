import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  function cleanup() {
    if (interval) { clearInterval(interval); interval = null; }
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: {\"type\":\"connected\"}\n\n"));

      unsubscribe = eventBus.subscribe((data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          cleanup();
        }
      });

      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
