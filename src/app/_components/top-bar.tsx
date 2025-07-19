// src/app/_components/top-bar.tsx
"use client";

import type { Session } from "next-auth";
import Link from "next/link";
import { Menu, Settings } from "lucide-react";
import { useParams } from "next/navigation"; // Import useParams

import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Config } from "./config";
import { SiteMenu } from "./site-menu";

export function TopBar({ session }: { session: Session | null }) {
  const params = useParams();
  const beingId = params.beingId ? decodeURIComponent(params.beingId as string) : undefined;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-white/20 bg-background/80 px-4 backdrop-blur">
      {session && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r-white/20 bg-background/80 text-white">
            <SheetHeader>
              <SheetTitle>Site Menu</SheetTitle>
              <SheetDescription>
                Navigate to different parts of the site.
              </SheetDescription>
            </SheetHeader>
            <SiteMenu />
          </SheetContent>
        </Sheet>
      )}

      <h1 className="flex-1 text-2xl font-extrabold tracking-tight text-white sm:text-[2rem]">
        {beingId || "Rhiz.om"}
      </h1>

      {session ? (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Page settings">
              <Settings className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-l-white/20 bg-background/80 text-white">
            <SheetHeader>
              <SheetTitle>Page Configuration</SheetTitle>
              <SheetDescription>
                Manage the settings for the current page.
              </SheetDescription>
            </SheetHeader>
            <Config />
          </SheetContent>
        </Sheet>
      ) : (
        <Link
          href="/api/auth/signin"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}