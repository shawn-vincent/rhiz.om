
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useRef } from "react";

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  overscan?: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  onEndReach?: () => void;
}

export function VirtualList<T>({
  items,
  rowHeight,
  overscan = 3,
  renderRow,
  onEndReach,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  React.useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= items.length - 1 - overscan &&
      onEndReach &&
      items.length > 0
    ) {
      onEndReach();
    }
  }, [items.length, overscan, onEndReach, virtualItems]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index] && renderRow(items[virtualItem.index]!, virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
