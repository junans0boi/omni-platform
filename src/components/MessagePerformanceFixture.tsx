"use client";

import { useMemo } from "react";
import { useBoundedVirtualList } from "@/hooks/useBoundedVirtualList";

export function MessagePerformanceFixture() {
  const messages = useMemo(
    () => Array.from({ length: 10_000 }, (_, index) => ({
      id: `fixture-${index}`,
      content: index % 7 === 0
        ? `Long performance message ${index} `.repeat(8)
        : `Performance message ${index}`,
    })),
    [],
  );
  const { scrollRef, virtualizer } = useBoundedVirtualList(messages);

  return (
    <main className="h-screen bg-zinc-950 p-6 text-white">
      <div
        ref={scrollRef}
        data-testid="message-viewport"
        className="h-full overflow-y-auto"
      >
        <div
          data-testid="message-virtual-space"
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((row) => (
            <article
              key={messages[row.index].id}
              ref={virtualizer.measureElement}
              data-index={row.index}
              data-testid="message-row"
              style={{
                position: "absolute",
                top: 0,
                width: "100%",
                transform: `translateY(${row.start}px)`,
              }}
              className="border-b border-white/5 py-3"
            >
              {messages[row.index].content}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
