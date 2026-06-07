import type { HealthStatus } from '../../utils/analytics';

interface HealthBadgeProps {
  status: HealthStatus;
}

const labels: Record<HealthStatus, string> = {
  growing: 'Croissance',
  stable: 'Stable',
  declining: 'Déclin',
  unknown: 'Inconnu'
};

const classes: Record<HealthStatus, string> = {
  growing: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30',
  stable: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
  declining: 'bg-rose-500/15 text-rose-200 ring-rose-400/30',
  unknown: 'bg-gray-500/15 text-gray-200 ring-gray-400/30'
};

export default function HealthBadge({ status }: HealthBadgeProps): JSX.Element {
  return (
    <span className={`rounded px-2 py-1 text-[11px] font-medium ring-1 ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}
