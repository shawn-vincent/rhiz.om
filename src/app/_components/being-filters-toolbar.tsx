import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useBeings } from "~/hooks/use-beings";

export function BeingFiltersToolbar() {
  const { kind, setKind, sort, setSort } = useBeings();

  return (
    <div className="flex gap-2 p-2">
      <Select value={kind || "all"} onValueChange={(value) => setKind(value === "all" ? undefined : (value as any))}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="space">Spaces</SelectItem>
          <SelectItem value="guest">Guests</SelectItem>
          <SelectItem value="bot">Bots</SelectItem>
          <SelectItem value="document">Docs</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => setSort(value as any)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name A-Z</SelectItem>
          <SelectItem value="createdAt">Newest</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
