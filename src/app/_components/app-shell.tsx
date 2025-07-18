// src/app/_components/app-shell.tsx
import { BottomBar } from "~/app/_components/bottom-bar";
import { TopBar } from "~/app/_components/top-bar";
import { auth } from "~/server/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-black text-white">
      <TopBar session={session} />
      <main className="overflow-y-auto">{children}</main>
      {session && <BottomBar />}
    </div>
  );
}