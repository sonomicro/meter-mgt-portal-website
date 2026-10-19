type BatteryFields = {
  battery_level: number | null;
  battery_present?: boolean | null;
};

export const hasBatteryBoard = (d: BatteryFields) => d.battery_present !== false;

// null when the device has no battery board or sent no reading (monitoring off)
export const batteryReading = (d: BatteryFields): number | null =>
  hasBatteryBoard(d) && typeof d.battery_level === 'number' && d.battery_level >= 0 && d.battery_level <= 100
    ? d.battery_level
    : null;

export const batteryLabel = (d: BatteryFields) => {
  if (!hasBatteryBoard(d)) return 'No battery';
  const level = batteryReading(d);
  return level === null ? '—' : `${level}%`;
};

export const averageBattery = (devices: BatteryFields[]): number | null => {
  const readings = devices.map(batteryReading).filter((b): b is number => b !== null);
  return readings.length > 0 ? Math.round(readings.reduce((sum, b) => sum + b, 0) / readings.length) : null;
};
