
import { useState, useMemo, useDeferredValue } from "react";
import { api } from "~/trpc/react";
import type { BeingKind, EntitySummary } from "../../packages/entity-kit/src/types";
import { useRecents } from "../../packages/entity-kit/src/hooks/use-recents";

export function useBeings(initialKind?: BeingKind) {
  // local state
  const [query, setQuery] = useState("");
  const qDeferred = useDeferredValue(query); // avoids instant refetch

  const rq = api.being.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => {
    if (!rq.data) return [];
    return rq.data.filter((being) =>
      being.name.toLowerCase().includes(qDeferred.toLowerCase())
    );
  }, [rq.data, qDeferred]);

  const { recents, addRecent } = useRecents<EntitySummary>("beings", 20);

  return { query, setQuery, ...rq, items, recents, addRecent };
}
