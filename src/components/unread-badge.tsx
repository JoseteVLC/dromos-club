"use client";

import { useNoticesCleared } from "./notice-seen";

export function UnreadBadge({ count, latest, prefix }: { count: number; latest: string | null; prefix?: string }) {
  const hidden = useNoticesCleared(latest, prefix);
  if (!count || hidden) return null;
  return (
    <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
      {count > 9 ? "9+" : count}
    </span>
  );
}
