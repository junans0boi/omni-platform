"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function useBoundedVirtualList<T extends { id: string }>(
  items: T[],
  estimateSize = 72,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => items[index]?.id ?? index,
    overscan: 8,
  });

  return { scrollRef, virtualizer };
}
