// src/app/_components/being-form.tsx
"use client";

// CORRECTED IMPORT: Aligned to v4 to match the schema source
import { z } from "zod/v4";
import { Field, Form } from "houseform";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { insertBeingSchema } from "~/server/db/types";

import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";

/**
 * Recursively unwraps a Zod type to get the innermost type using the public API.
 * This works for both Zod v3 and v4.
 * @param t The Zod type to unwrap.
 * @returns The base Zod type.
 */
function unwrapZodType(t: z.ZodType): z.ZodType {
  if ("unwrap" in t && typeof t.unwrap === "function") {
    return unwrapZodType(t.unwrap());
  }
  return t;
}

/**
 * Determines the kind of form widget to render using version-safe `instanceof` checks.
 * This is the correct, public API-based approach.
 * @param t The Zod type for the form field.
 * @returns A string representing the widget kind.
 */
function fieldKind(t: z.ZodType): string {
  const unwrappedType = unwrapZodType(t);

  // Using instanceof is the correct, version-agnostic way to check types
  if (unwrappedType instanceof z.ZodEnum) return "enum";
  if (unwrappedType instanceof z.ZodString) return "scalar";
  if (unwrappedType instanceof z.ZodNumber) return "scalar";
  if (unwrappedType instanceof z.ZodArray) return "array";
  if (unwrappedType instanceof z.ZodObject) return "json";
  if (unwrappedType instanceof z.ZodRecord) return "json";
  if (unwrappedType instanceof z.ZodDate) return "json";
  
  // Default for any other complex or unknown types
  return "json";
}

export function BeingForm() {
  const shape = insertBeingSchema.omit({ id: true, createdAt: true, modifiedAt: true }).shape;

  return (
    <Form onSubmit={(values) => console.log("🔮 Being Form Preview", values)}>
      {({ submit }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-6"
        >
          {Object.entries(shape).map(([key, zodType]) => (
            <DynamicField key={key} name={key} schema={zodType as unknown as z.ZodType} />
          ))}

          <Button type="submit">Preview JSON in Console</Button>
        </form>
      )}
    </Form>
  );
}

type DynamicFieldProps = { name: string; schema: z.ZodType };

function DynamicField({ name, schema }: DynamicFieldProps) {
  const kind = fieldKind(schema);
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const unwrappedSchema = unwrapZodType(schema);

  if (kind === "array") {
    return (
      <Field<string[]> name={name} initialValue={[]}>
        {({ value, setValue, errors }) => (
          <div className="grid gap-2">
            <Label>{label} (List of items)</Label>
            {(value ?? []).map((_, index) => (
              <div key={index} className="flex gap-2">
                <Field<string> name={`${name}[${index}]`} initialValue="">
                  {({ value: itemValue, setValue: setItemValue }) => (
                    <Input
                      value={itemValue}
                      onChange={(e) => setItemValue(e.target.value)}
                      placeholder="Enter value"
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setValue((prev) => (prev ?? []).filter((_, i) => i !== index))
                  }
                >
                  −
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue((prev) => [...(prev ?? []), ""])}
            >
              + Add Item
            </Button>
            {errors.map((error) => (
                <p key={error} className="text-sm text-destructive">{error}</p>
            ))}
            <Separator className="my-2 bg-white/20" />
          </div>
        )}
      </Field>
    );
  }

  return (
    <Field name={name} initialValue="">
      {({ value, setValue, onBlur, errors }) => (
        <div className="grid gap-1.5">
          <Label htmlFor={name}>{label}</Label>

          {kind === "scalar" && (
            <Input
              id={name}
              value={(value as string) ?? ""}
              onBlur={onBlur}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          {kind === "enum" && unwrappedSchema instanceof z.ZodEnum && (
            <Select onValueChange={setValue} value={value as string}>
              <SelectTrigger id={name} onBlur={onBlur}>
                <SelectValue placeholder={`Select a ${name}`} />
              </SelectTrigger>
              <SelectContent>
                {/* FINAL FIX: Explicitly convert enum option to a string */}
                {unwrappedSchema.options.map((option) => (
                  <SelectItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {kind === "json" && (
             <CodeMirror
              id={name}
              value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
              height="120px"
              theme="dark"
              extensions={[json()]}
              onBlur={onBlur}
              onChange={(val: string) => {
                try {
                  setValue(JSON.parse(val));
                } catch (e) {
                  setValue(val);
                }
              }}
              className="rounded-md border border-input bg-background p-1 font-mono text-sm"
            />
          )}

          {errors.map((error) => (
            <p key={error} className="text-sm text-destructive">
              {error}
            </p>
          ))}
        </div>
      )}
    </Field>
  );
}