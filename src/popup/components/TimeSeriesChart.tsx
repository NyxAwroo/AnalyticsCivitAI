import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export interface TimeSeriesPoint {
  label: string;
  [key: string]: string | number | undefined;
}

export interface TimeSeriesLine {
  dataKey: string;
  label: string;
  color: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  lines?: TimeSeriesLine[];
}

const defaultLines: TimeSeriesLine[] = [
  { dataKey: 'downloads', label: 'Downloads', color: '#A78BFA' },
  { dataKey: 'likes', label: 'Likes', color: '#38BDF8' }
];

export default function TimeSeriesChart({
  data,
  lines = defaultLines
}: TimeSeriesChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded border border-dashed border-white/15 bg-gray-900/60 text-sm text-gray-400">
        Pas encore d’historique
      </div>
    );
  }

  return (
    <div className="h-44 rounded border border-white/10 bg-gray-900/60 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} tickLine={false} />
          <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: '#1F2937',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: '#F9FAFB'
            }}
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
