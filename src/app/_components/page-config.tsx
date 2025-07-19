// src/app/_components/page-config.tsx
"use client";

import { useParams } from "next/navigation";
import { Separator } from "~/components/ui/separator";
import { BeingEditor } from "./being-editor";

export function PageConfig() {
  const params = useParams();
  const beingId =
    params.beingId ? decodeURIComponent(params.beingId as string) : undefined;

  if (!beingId) {
    return (
      <div className="p-4 text-center text-white/70">
        No being selected.
      </div>
    );
  }

  return (
    <>
      <Separator className="bg-white/20" />
      <BeingEditor beingId={beingId} />
    </>
  );
}
