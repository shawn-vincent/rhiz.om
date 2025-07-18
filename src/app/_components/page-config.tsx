// src/app/_components/page-config.tsx
import { Separator } from "~/components/ui/separator";
import { BeingForm } from "./being-form";

export function PageConfig() {
  return (
    <>
      <Separator className="bg-white/20" />
      <div className="h-[calc(100vh-8rem)] overflow-y-auto p-4">
        <BeingForm />
      </div>
    </>
  );
}
