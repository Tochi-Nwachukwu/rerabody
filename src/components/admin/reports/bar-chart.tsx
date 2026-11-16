/** Simple accessible bar chart: bars for sighted users, a table for everyone. */
export function BarChart({
  data,
  format,
  label,
}: {
  data: { label: string; value: number }[];
  format: (n: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-muted-foreground text-sm">No data in this period.</p>;
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-1" aria-hidden>
        {data.map((d) => (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${format(d.value)}`}
          >
            <div
              className="bg-primary/80 w-full rounded-t"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <details>
        <summary className="text-muted-foreground cursor-pointer text-xs">Show as table</summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b">
                <th scope="row" className="py-1 text-left font-normal">
                  {d.label}
                </th>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
