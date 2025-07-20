
"use client";

import { useForm } from "react-hook-form";
import { FormProvider } from "react-hook-form";
import { BeingSelectField } from "~/components/being-selector";
import { useBeings } from "~/hooks/use-beings";
import { EntityCard } from "packages/entity-kit/src/components/ui/EntityCard";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  selectedBeing: z.string().min(1, { message: "Please select a being." }),
  otherField: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function DemoPage() {
  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedBeing: "",
      otherField: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    console.log(data);
    alert(JSON.stringify(data, null, 2));
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        <div>
          <Label htmlFor="selectedBeing">Select Being</Label>
          <BeingSelectField
            name="selectedBeing"
            useHook={useBeings}
            renderCard={(entity) => <EntityCard entity={entity} variant="compact" />}
          />
          {methods.formState.errors.selectedBeing && (
            <p className="text-red-500">
              {methods.formState.errors.selectedBeing.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="otherField">Other Field</Label>
          <Input id="otherField" {...methods.register("otherField")} />
        </div>
        <Button type="submit">Submit</Button>
      </form>
    </FormProvider>
  );
}
