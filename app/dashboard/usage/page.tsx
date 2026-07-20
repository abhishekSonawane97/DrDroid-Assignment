import { redirect } from "next/navigation";

import { getUsageSummary } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export default async function UsagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { creditsRemaining, totals, byModel } = await getUsageSummary(user.id);

  return (
    <div className="max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Usage</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Credits remaining" value={String(creditsRemaining)} />
        <StatTile label="Total requests" value={String(totals.totalRequests)} />
        <StatTile
          label="Estimated cost"
          value={`$${Number(totals.totalCost).toFixed(4)}`}
        />
        <StatTile
          label="Prompt tokens"
          value={totals.promptTokens.toLocaleString()}
        />
        <StatTile
          label="Completion tokens"
          value={totals.completionTokens.toLocaleString()}
        />
        <StatTile
          label="Cache tokens (r/w)"
          value={`${totals.cacheReadTokens.toLocaleString()} / ${totals.cacheWriteTokens.toLocaleString()}`}
        />
      </div>

      <h2 className="text-muted-foreground mb-2 text-sm font-medium">
        By model
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-2 font-medium">Model</th>
            <th className="py-2 font-medium">Requests</th>
            <th className="py-2 font-medium">Prompt</th>
            <th className="py-2 font-medium">Completion</th>
            <th className="py-2 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {byModel.map((row) => (
            <tr key={row.model} className="border-b">
              <td className="py-2">{row.model}</td>
              <td className="py-2">{row.requests}</td>
              <td className="py-2">{row.promptTokens.toLocaleString()}</td>
              <td className="py-2">{row.completionTokens.toLocaleString()}</td>
              <td className="py-2">${Number(row.cost).toFixed(4)}</td>
            </tr>
          ))}
          {byModel.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="text-muted-foreground py-4 text-center"
              >
                No usage yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
