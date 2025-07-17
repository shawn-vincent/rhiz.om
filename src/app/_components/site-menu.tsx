// src/app/_components/site-menu.tsx
"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";

function AllBeingsList() {
  const [beings] = api.being.getAll.useSuspenseQuery();

  return (
    <ScrollArea className="flex-grow">
      <div className="flex flex-col gap-2 pr-4">
        {beings.map((being) => (
          <Link href={`/being/${being.id}`} key={being.id} className="text-sm p-2 rounded-md hover:bg-white/5">
            <p className="font-semibold truncate">{being.name}</p>
            <p className="text-xs text-white/60">{being.id}</p>
          </Link>
        ))}
      </div>
    </ScrollArea>
  );
}

export function SiteMenu() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
         <h2 className="text-lg font-semibold">Site Menu</h2>
      </div>
      <Separator className="bg-white/20" />
      <div className="p-4">
        <h3 className="mb-2 font-medium text-white/80">All Beings</h3>
        <AllBeingsList />
      </div>
      <div className="mt-auto p-4">
        <Link
          href="/api/auth/signout"
          className="w-full"
        >
          <Button variant="outline" className="w-full border-white/20 bg-transparent hover:bg-white/10">
            Sign Out
          </Button>
        </Link>
      </div>
    </div>
  );
}