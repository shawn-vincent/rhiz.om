// src/app/_components/page-config.tsx
import { Separator } from "~/components/ui/separator";

export function PageConfig() {
    return (
        <div>
            <Separator className="bg-white/20" />
            <div className="p-4">
                <p className="text-sm text-white/70">Page settings will be available here.</p>
            </div>
        </div>
    );
}