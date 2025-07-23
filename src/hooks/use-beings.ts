import { useDeferredValue, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useRecents } from "../../packages/entity-kit/src/hooks/use-recents";
import type {
	BeingType,
	EntitySummary,
} from "../../packages/entity-kit/src/types";

export function useBeings(initialType?: BeingType) {
	// local state
	const [query, setQuery] = useState("");
	const [type, setType] = useState<BeingType | undefined>(initialType);
	const qDeferred = useDeferredValue(query); // avoids instant refetch

	const rq = api.being.getAll.useQuery(undefined, {
		staleTime: 5 * 60 * 1000,
	});

	const items = useMemo(() => {
		if (!rq.data) return [];
		return rq.data
			.filter((being) => {
				const matchesQuery = being.name
					.toLowerCase()
					.includes(qDeferred.toLowerCase());
				const matchesType = !type || (being.type as BeingType) === type;
				return matchesQuery && matchesType;
			})
			.map(
				(being) =>
					({
						...being,
						type: being.type as BeingType,
					}) as EntitySummary,
			);
	}, [rq.data, qDeferred, type]);

	const { recents, addRecent } = useRecents<EntitySummary>("beings", 20);

	return { query, setQuery, type, setType, ...rq, items, recents, addRecent };
}
