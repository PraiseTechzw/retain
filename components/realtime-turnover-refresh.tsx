"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeTurnoverRefresh() {
  const router = useRouter();

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel("turnover-analysis")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exit_cases" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [router]);

  return null;
}
