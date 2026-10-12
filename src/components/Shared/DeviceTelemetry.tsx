import { Thermometer, Droplets } from 'lucide-react';

interface EnvironmentCellProps {
  temperatureC: number | null | undefined;
  humidityRh: number | null | undefined;
  updatedAt: string | null | undefined;
}

// Latest env.qo reading (SHT40 on carrier E). Boards without the sensor never
// report one, so "—" is the normal state for them, not an error.
export function EnvironmentCell({ temperatureC, humidityRh, updatedAt }: EnvironmentCellProps) {
  if (temperatureC == null || humidityRh == null) {
    return <span className="text-sm text-gray-400">—</span>;
  }
  const title = updatedAt
    ? `Measured ${new Date(updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : undefined;
  return (
    <div className="flex items-center space-x-3 text-sm text-gray-900" title={title}>
      <span className="flex items-center space-x-1">
        <Thermometer className="h-4 w-4 text-red-500" />
        <span>{Number(temperatureC).toFixed(1)} °C</span>
      </span>
      <span className="flex items-center space-x-1">
        <Droplets className="h-4 w-4 text-blue-500" />
        <span>{Number(humidityRh).toFixed(0)} %</span>
      </span>
    </div>
  );
}
