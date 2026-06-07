import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  detail?: string;
}

export default function StatCard({ label, value, icon, detail }: StatCardProps): JSX.Element {
  return (
    <article className="rounded border border-white/10 bg-gray-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <strong className="mt-1 block text-xl font-semibold text-white">{value}</strong>
        </div>
        {icon ? <div className="rounded bg-violet-500/15 p-2 text-violet-200">{icon}</div> : null}
      </div>
      {detail ? <p className="mt-2 text-xs text-gray-400">{detail}</p> : null}
    </article>
  );
}
