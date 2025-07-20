
import { useState, useMemo, useDeferredValue } from "react";
import { api } from "~/trpc/react";
import type { BeingKind, EntitySummary } from "../../packages/entity-kit/src/types";
import { useRecents } from "../../packages/entity-kit/src/hooks/use-recents";

export function useBeings(initialKind?: BeingKind) {
  // local state
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<BeingKind | undefined>(initialKind);
  const [sort, setSort] = useState<"name" | "createdAt">("name");

  const qDeferred = useDeferredValue(query); // avoids instant refetch

  const rq = api.being.search.useInfiniteQuery(
    { q: qDeferred, kind, sort, limit: 50 },
    {
      getNextPageParam: (last) => last.nextCursor,
      staleTime: 5 * 60 * 1000,
    },
  );

  // flatten pages for VirtualList
  const items = useMemo(
    () => rq.data?.pages.flatMap((p) => p.items) ?? [],
    [rq.data],
  );

  const { recents, addRecent } = useRecents<EntitySummary>("beings", 20);

  return { query, setQuery, kind, setKind, sort, setSort, ...rq, items, recents, addRecent };
}
