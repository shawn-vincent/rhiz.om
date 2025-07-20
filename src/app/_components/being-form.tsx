import { useEffect } from "react";
import { z } from "zod/v4";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { BeingSelectField } from "~/components/being-selector";
import { useBeings } from "~/hooks/use-beings";
import { EntityCard } from "packages/entity-kit/src/components/ui/EntityCard";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";

import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";

import { insertBeingSchema } from "~/server/db/types";

/* ---------- Types ---------- */
type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingForm() {
  const { control, register, formState: { errors } } = useFormContext<BeingFormData>();
  /* ---------- FieldArray for extIds ---------- */
  const {
    fields: extIdFields,
    append: addExtId,
    remove: removeExtId,
  } = useFieldArray({
    control,
    name: "extIds",
  });

  /* ---------- render ---------- */
  return (
    <div className="space-y-6">
      {/* ----- Simple scalars ----- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="id">ID (slug)</Label>
          <Input id="id" placeholder="@new-being" {...register("id")} />
          {errors.id && (
            <p className="text-red-600 text-sm">{errors.id.message}</p>
          )}
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
          <BeingSelectField
            name="ownerId"
            useHook={useBeings}
            renderCard={(entity) => <EntityCard entity={entity} variant="compact" />}
          />
          {errors.ownerId && (
            <p className="text-red-600 text-sm">{errors.ownerId.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="locationId">Location ID</Label>
          <Input
            id="locationId"
            placeholder="@space"
            {...register("locationId")}
          />
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
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
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
                theme="dark"
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
    </div>
  );
}

