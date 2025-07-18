// src/app/_components/being-form.tsx
"use client";

import { Field, Form } from "houseform";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { insertBeingSchema } from "~/server/db/types";

import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";

// Small utility to map Zod type definitions to a widget "kind"
function fieldKind(t: z.ZodTypeAny): string {
  const def = t._def;
  switch (def.typeName) {
    case "ZodEnum":
      return "enum";
    case "ZodString":
    case "ZodNumber":
      return "scalar";
    case "ZodArray":
      return "array";
    case "ZodObject":
    case "ZodRecord":
    case "ZodAny":
    case "ZodDate": // Treat dates as JSON for now
      return "json";
    case "ZodNullable":
    case "ZodOptional":
      return fieldKind((t as z.ZodOptional<any> | z.ZodNullable<any>)._def.innerType);
    default:
      return "json";
  }
}

export function BeingForm() {
  // Use .omit() to hide fields that should not be user-editable
  const shape = insertBeingSchema.omit({ id: true, createdAt: true, modifiedAt: true }).shape;

  return (
    <Form onSubmit={(values) => console.log(" Being Form Preview", values)}>
      {({ submit }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-6"
        >
          {Object.entries(shape).map(([key, zodType]) => (
            <DynamicField key={key} name={key} schema={zodType as unknown as z.ZodTypeAny} />
          ))}

          <Button type="submit">Preview JSON in Console</Button>
        </form>
      )}
    </Form>
  );
}

type DynamicFieldProps = { name: string; schema: z.ZodTypeAny };

function DynamicField({ name, schema }: DynamicFieldProps) {
  const kind = fieldKind(schema);
  const label = name.charAt(0).toUpperCase() + name.slice(1);

  // HouseForm handles arrays using the standard <Field> component.
  // We access array-specific methods like `add` and `remove` from the render prop.
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
                    setValue((prev) => prev.filter((_, i) => i !== index))
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
              onClick={() => setValue((prev) => [...prev, ""])}
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

  // Fallback for all other types
  return (
    <Field name={name} initialValue="">
      {({ value, setValue, onBlur, errors }) => (
        <div className="grid gap-1.5">
          <Label htmlFor={name}>{label}</Label>

          {kind === "scalar" && (
            <Input
              id={name}
              value={value as string}
              onBlur={onBlur}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          {kind === "enum" && (
            <Select onValueChange={setValue} value={value as string}>
              <SelectTrigger id={name} onBlur={onBlur}>
                <SelectValue placeholder={`Select a ${name}`} />
              </SelectTrigger>
              <SelectContent>
                {(schema as z.ZodEnum<[string, ...string[]]>).options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {kind === "json" && (
            <CodeMirror
              id={name}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              height="120px"
              theme="dark"
              extensions={[json()]}
              onBlur={onBlur}
              onChange={(val: string) => setValue(val)}
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