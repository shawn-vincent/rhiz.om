
import { createSelectField } from "../../packages/entity-kit/src/lib/create-select-field";
import { EntityCard } from "../../packages/entity-kit/src/components/ui/EntityCard";
import { useBeings } from "~/hooks/use-beings";
import type { EntitySummary } from "../../packages/entity-kit/src/types";

export const { Select: BeingSelect, SelectField: BeingSelectField } = createSelectField(
  useBeings,
  (entity: EntitySummary) => <EntityCard entity={entity} variant="compact" />,
);
