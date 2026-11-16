"use client";

import { Download } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportCsvAction } from "@/server/actions/reports";

export function ExportButtons({ from, to }: { from: string; to: string }) {
  const [pending, start] = useTransition();
  const download = (kind: "orders" | "customers") =>
    start(async () => {
      const res = await exportCsvAction({ kind, from, to });
      if (!res.ok) return void toast.error(res.error);
      const url = URL.createObjectURL(new Blob([res.data.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => download("orders")}>
        <Download /> Orders CSV
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => download("customers")}>
        <Download /> Customers CSV
      </Button>
    </div>
  );
}
