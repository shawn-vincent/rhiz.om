/* ── src/app/_components/being-form.tsx ─────────────────────────── */
"use client";

import { useEffect } from "react"; // 1. Import useEffect
import { z } from "zod/v4";
import {
  useForm,
  Controller,
  useFieldArray,
  type SubmitHandler,
  type DefaultValues,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";

import { insertBeingSchema, type Being } from "~/server/db/types";

/* ---------- Types ---------- */
// Use InsertBeing for form data type consistency
type BeingFormData = z.infer<typeof insertBeingSchema>;

interface BeingFormProps {
  /** Pass the full Being object when editing. */
  initialData?: Being; // Changed to Being to reflect fetched data type
  /** Called with parsed / validated data. */
  onSubmit: (data: BeingFormData) => void | Promise<void>;
}

/* ── Component ─────────────────────────────────────────────────── */
export function BeingForm({ initialData, onSubmit }: BeingFormProps) {
  /* ---------- defaultValues (typed) ---------- */
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

  /* ---------- useForm ---------- */
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset, // 2. Get the reset function from useForm
    formState: { errors, isSubmitting },
  } = useForm<BeingFormData>({
    resolver: zodResolver(insertBeingSchema) as Resolver<BeingFormData>,
    defaultValues: baseDefaults,
  });

  // This useEffect correctly handles populating the form with fetched data
  // and transforms it to be compatible with our form's schema.
  useEffect(() => {
    if (initialData) {
      // Create a form-compatible version of the data from the database
      const formValues: BeingFormData = {
        ...initialData,
        // Coalesce null values from the DB to undefined for the form
        ownerId: initialData.ownerId ?? undefined,
        locationId: initialData.locationId ?? undefined,
        extIds: initialData.extIds ?? undefined,
        idHistory: initialData.idHistory ?? undefined,
        metadata: initialData.metadata ?? undefined,
        properties: initialData.properties ?? undefined,
        content: initialData.content ?? undefined,
      };
      reset(formValues);
    }
  }, [initialData, reset]);


  /* ---------- FieldArray for extIds ---------- */
  const {
    fields: extIdFields,
    append: addExtId,
    remove: removeExtId,
  } = useFieldArray({
    control,
    name: "extIds",
  });

  /* ---------- submit ---------- */
  const submit: SubmitHandler<BeingFormData> = async (data) => {
    await onSubmit(data);
  };

  /* ---------- render ---------- */
  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="space-y-6"
      autoComplete="off"
    >
      {/* ----- Simple scalars ----- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="id">ID (slug)</Label>
          <Input id="id" placeholder="@new-being" {...register("id")} readOnly={!!initialData} />
          {errors.id && <p className="text-red-600 text-sm">{errors.id.message}</p>}
        </div>

        <div>
          <Label htmlFor="name">Display Name</Label>
          <Input id="name" placeholder="Soulspace" {...register("name")} />
          {errors.name && (
            <p className="text-red-600 text-sm">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="type">Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value ?? "guest"}
                onValueChange={(v) =>
                  field.onChange(v as BeingFormData["type"])
                }
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">guest</SelectItem>
                  <SelectItem value="space">space</SelectItem>
                  <SelectItem value="document">document</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-red-600 text-sm">{errors.type.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="ownerId">Owner ID</Label>
          <Input id="ownerId" placeholder="@owner" {...register("ownerId")} />
          {errors.ownerId && (
            <p className="text-red-600 text-sm">{errors.ownerId.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="locationId">Location ID</Label>
          <Input id="locationId" placeholder="@space" {...register("locationId")} />
          {errors.locationId && (
            <p className="text-red-600 text-sm">{errors.locationId.message}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* ----- FieldArray: extIds ----- */}
      <fieldset className="space-y-4">
        <legend className="font-medium text-sm">External IDs</legend>

        {extIdFields.map((field, idx) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_1fr_auto] gap-2"
          >
            <Input
              placeholder="provider"
              {...register(`extIds.${idx}.provider` as const)}
            />
            <Input
              placeholder="id"
              {...register(`extIds.${idx}.id` as const)}
            />
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeExtId(idx)}
            >
              ✕
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() => addExtId({ provider: "", id: "" })}
        >
          + Add
        </Button>

        {errors.extIds && (
          <p className="text-red-600 text-sm">{errors.extIds.message}</p>
        )}
      </fieldset>

      <Separator />

      {/* ----- JSON blobs via CodeMirror ----- */}
      {(
        [
          { name: "metadata", label: "Metadata (JSON)" },
          { name: "properties", label: "Properties (JSON)" },
          { name: "content", label: "Content (nested JSON)" },
          { name: "idHistory", label: "ID History (array JSON)" },
        ] as const
      ).map(({ name, label }) => (
        <Controller
          key={name}
          control={control}
          name={name as keyof BeingFormData}
          render={({ field }) => (
            <div className="space-y-2">
              <Label>{label}</Label>
              <CodeMirror
                basicSetup={{ lineNumbers: true }}
                extensions={[jsonLang()]}
                height="200px"
                value={
                  field.value !== null && field.value !== undefined
                    ? JSON.stringify(field.value, null, 2)
                    : ""
                }
                onChange={(value) => {
                  try {
                    if (value.trim() === "") {
                        field.onChange(undefined);
                        return;
                    }
                    const parsed = JSON.parse(value);
                    field.onChange(parsed);
                  } catch {
                    // Invalid JSON will be caught by Zod validation on submit
                  }
                }}
              />
              {(errors as any)?.[name] && (
                <p className="text-red-600 text-sm">
                  {(errors as any)[name].message as string}
                </p>
              )}
            </div>
          )}
        />
      ))}

      <Separator />

      {/* ----- Submit ----- */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save Being"}
      </Button>
    </form>
  );
}

