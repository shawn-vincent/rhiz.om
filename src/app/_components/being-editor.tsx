// src/app/_components/being-editor.tsx
import { useEffect } from "react";
import { useForm, type SubmitHandler, type DefaultValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import { api } from "~/trpc/react";
import { BeingForm } from "./being-form";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { insertBeingSchema, type Being, type InsertBeing } from "~/server/db/types";

interface BeingEditorProps {
  beingId: string;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingEditor({ beingId }: BeingEditorProps) {
  const utils = api.useUtils();

  const { data: being, isLoading, error } = api.being.getById.useQuery(
    { id: beingId },
    { enabled: !!beingId },
  );

  const upsertBeing = api.being.upsert.useMutation({
    onSuccess: async () => {
      await utils.being.getById.invalidate({ id: beingId });
      await utils.being.getAll.invalidate();
    },
    onError: (err) => {
      console.error("Failed to save being:", err);
    },
  });

  const baseDefaults: DefaultValues<BeingFormData> = {
    id: "",
    name: "",
    type: "guest",
    ownerId: undefined,
    locationId: undefined,
    extIds: [],
    idHistory: [],
    metadata: {},
    properties: {},
    content: [],
  };

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BeingFormData>({
    resolver: zodResolver(insertBeingSchema) as Resolver<BeingFormData>,
    defaultValues: baseDefaults,
  });

  useEffect(() => {
    if (being) {
      const formValues: BeingFormData = {
        ...being,
        ownerId: being.ownerId ?? undefined,
        locationId: being.locationId ?? undefined,
        extIds: being.extIds ?? undefined,
        idHistory: being.idHistory ?? undefined,
        metadata: being.metadata ?? undefined,
        properties: being.properties ?? undefined,
        content: being.content ?? undefined,
      };
      reset(formValues);
    }
  }, [being, reset]);

  const submit: SubmitHandler<BeingFormData> = async (data) => {
    await upsertBeing.mutateAsync(data);
  };

  if (isLoading) {
    return <div className="p-4 text-center text-white/70">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-400">Error: {error.message}</div>;
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex h-full flex-col">
      <div className="flex-grow overflow-y-auto p-4">
        <BeingForm control={control} register={register} errors={errors} />
      </div>
      <DialogFooter className="p-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save Being"}
        </Button>
      </DialogFooter>
    </form>
  );
}
