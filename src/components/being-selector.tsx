import { useBeings } from "~/hooks/use-beings";
import { EntityCard } from "../../packages/entity-kit/src/components/ui/EntityCard";
import { createSelectField } from "../../packages/entity-kit/src/lib/create-select-field";
import type { EntitySummary } from "../../packages/entity-kit/src/types";

export const { Select: BeingSelect, SelectField: BeingSelectField } =
	createSelectField(useBeings, (entity: EntitySummary) => (
		<EntityCard entity={entity} variant="compact" />
	));
