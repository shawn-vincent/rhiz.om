// src/app/_components/being-editor-modal.tsx
"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { BeingEditor } from "./being-editor";

interface BeingEditorModalProps {
  beingId: string;
  title: string;
}

export function BeingEditorModal({ beingId, title }: BeingEditorModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{title}</Button>
      </DialogTrigger>
      <DialogContent className="h-[90vh] max-w-[80vw] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <BeingEditor beingId={beingId} />
      </DialogContent>
    </Dialog>
  );
}
