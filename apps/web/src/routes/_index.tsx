import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { orpc } from "@/utils/orpc";

import type { Route } from "./+types/_index";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

export function meta({}: Route.MetaArgs) {
  return [{ title: "reelory" }, { name: "description", content: "reelory is a web application" }];
}

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const status = healthCheck.isLoading
    ? ({ label: "Checking", tone: "neutral" } as const)
    : healthCheck.data
      ? ({ label: "Connected", tone: "success" } as const)
      : ({ label: "Disconnected", tone: "danger" } as const);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">API status</h2>
            <Badge dot tone={status.tone}>
              {status.label}
            </Badge>
          </div>
          <div className="mt-4">
            <Button
              loading={healthCheck.isRefetching}
              onClick={() => {
                healthCheck.refetch();
              }}
              size="sm"
              variant="secondary"
            >
              Check again
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
