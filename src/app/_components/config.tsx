// src/app/_components/config.tsx
"use client";

import { useParams } from "next/navigation";
import { Separator } from "~/components/ui/separator";
import { BeingEditorModal } from "./being-editor-modal";

export function Config() {
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
      <div className="p-4">
        <BeingEditorModal beingId={beingId} title="Edit Space" />
      </div>
    </>
  );
}
