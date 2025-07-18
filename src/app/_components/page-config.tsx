// src/app/_components/page-config.tsx
"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Separator } from "~/components/ui/separator";
import { BeingForm } from "./being-form";
import { type InsertBeing } from "~/server/db/types";

export function PageConfig() {
  const params = useParams();
  const beingId =
    params.beingId ? decodeURIComponent(params.beingId as string) : undefined;

  const utils = api.useUtils();

  // 1. Fetch the being's data using the new tRPC query hook.
  const { data: being, isLoading, error } = api.being.getById.useQuery(
    { id: beingId! },
    {
      enabled: !!beingId, // Only run the query if beingId is present
    },
  );

  // 2. Create a mutation for saving the being's data.
  const upsertBeing = api.being.upsert.useMutation({
    onSuccess: async () => {
      // 3. On success, invalidate queries to refetch fresh data.
      // This is a key best practice to keep the UI in sync.
      await utils.being.getById.invalidate({ id: beingId });
      await utils.being.getAll.invalidate();
      // Optionally: show a success toast message here.
    },
    onError: (err) => {
      // Optionally: show an error toast message here.
      console.error("Failed to save being:", err);
    },
  });

  // 4. Define the submit handler to pass to the form.
  const handleSubmit = (data: InsertBeing) => {
    upsertBeing.mutate(data);
  };

  if (!beingId) {
    return (
      <div className="p-4 text-center text-white/70">
        No being selected.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-white/70">Loading configuration...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        Error: {error.message}
      </div>
    );
  }

  return (
    <>
      <Separator className="bg-white/20" />
      <div className="h-[calc(100vh-8rem)] overflow-y-auto p-4">
        {/* 5. Pass the fetched data and the submit handler to the form. */}
        <BeingForm initialData={being} onSubmit={handleSubmit} />
      </div>
    </>
  );
}
