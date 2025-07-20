
import { Controller, useFormContext } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { EntityCard } from "../components/ui/EntityCard";
import { ResponsiveShell } from "../components/ui/ResponsiveShell";
import { EntitySelectPanel } from "../components/ui/EntitySelectPanel";
import type { EntitySummary } from "../types";
import { useState } from "react";
import { api } from "~/trpc/react";
import { BeingFiltersToolbar } from "~/app/_components/being-filters-toolbar";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  renderCard: (entity: EntitySummary) => React.ReactNode;
  useHook: (initialValue?: any) => any; // Simplified for now
}

export function createSelectField(
  useHook: (initialValue?: any) => any,
  renderCard: (entity: EntitySummary) => React.ReactNode,
) {
  const Select = ({
    value,
    onValueChange,
    renderCard,
    useHook,
  }: SelectProps) => {
    const [open, setOpen] = useState(false);
    const { items, isLoading, isError, query, setQuery, fetchNextPage } = useHook();

    const selectedEntity = items.find((item: EntitySummary) => item.id === value);

    const { data: fetchedEntity, isLoading: isFetchingEntity } = api.being.getById.useQuery(
      { id: value! },
      {
        enabled: !!value && !selectedEntity,
      },
    );

    const displayEntity = selectedEntity || fetchedEntity;

    const handleSelect = (id: string) => {
      onValueChange?.(id);
      setOpen(false);
    };

    return (
      <ResponsiveShell
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
          >
            {displayEntity ? renderCard(displayEntity) : isFetchingEntity ? "Loading..." : "Select entity..."}
          </Button>
        }
        panel={
          <EntitySelectPanel
            value={value}
            onSelect={handleSelect}
            fetchPage={fetchNextPage}
            items={items}
            isLoading={isLoading}
            isError={isError}
            isEmpty={items.length === 0 && !isLoading && !isError}
            onSearchChange={setQuery}
            filtersNode={<BeingFiltersToolbar />}
          />
        }
      />
    );
  };

  const SelectField = ({
    name,
    ...props
  }: {
    name: string;
    renderCard: (entity: EntitySummary) => React.ReactNode;
    useHook: (initialValue?: any) => any;
  }) => {
    const { control } = useFormContext();
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            {...props}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
    );
  };

  return { Select, SelectField };
}
