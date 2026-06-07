import HealthBadge from './HealthBadge';
import type { HealthStatus } from '../../utils/analytics';

interface ModelRowProps {
  name: string;
  type: string;
  baseModel: string;
  downloads: number;
  likes: number;
  likesDelta: number;
  comments: number;
  rating: number;
  buzzTipped: number;
  engagementRate: number;
  periodDownloadsDelta: number;
  velocityChangePercent: number;
  status: HealthStatus;
}

function formatDelta(value: number): string {
  if (value === 0) {
    return '0';
  }

  return `${value > 0 ? '+' : ''}${value.toLocaleString('fr-FR')}`;
}

export default function ModelRow({
  name,
  type,
  baseModel,
  downloads,
  likes,
  likesDelta,
  comments,
  rating,
  buzzTipped,
  engagementRate,
  periodDownloadsDelta,
  velocityChangePercent,
  status
}: ModelRowProps): JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-3 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <HealthBadge status={status} />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {type} · {baseModel}
        </p>
        <p className="mt-1 text-[11px] text-gray-500">
          Rating {rating > 0 ? rating.toFixed(2) : 'n/a'} · Engagement{' '}
          {engagementRate.toFixed(2)}% · Buzz {buzzTipped.toLocaleString('fr-FR')}
        </p>
      </div>
      <div className="grid min-w-[174px] grid-cols-3 gap-2 text-right text-xs">
        <div>
          <p className="font-semibold text-white">{downloads.toLocaleString('fr-FR')}</p>
          <p className="text-gray-500">7j {formatDelta(periodDownloadsDelta)}</p>
        </div>
        <div>
          <p className="font-semibold text-white">{likes.toLocaleString('fr-FR')}</p>
          <p className="text-gray-500">Likes {formatDelta(likesDelta)}</p>
        </div>
        <div>
          <p className="font-semibold text-white">{comments.toLocaleString('fr-FR')}</p>
          <p className={`${velocityChangePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {velocityChangePercent >= 0 ? '▲' : '▼'} {Math.abs(Math.round(velocityChangePercent))}%
          </p>
        </div>
      </div>
    </div>
  );
}
