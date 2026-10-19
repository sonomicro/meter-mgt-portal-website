/*
  # env.qo period statistics

  Firmware 2.8.0 samples the SHT40 every 10 s and sends with each env.qo the
  min / max / mean of every sample since the previous env.qo, so what happens
  between cloud syncs is no longer lost.

  1. Changes
    - `device_env_data`: temperature_{min,max,avg}_c, humidity_{min,max,avg}_rh,
      samples, period_s (null for notes from older firmware).
    - temperature_c / humidity_rh (the snapshot at the sync) become nullable: a
      note whose last read failed still carries the period statistics.
*/

ALTER TABLE device_env_data ALTER COLUMN temperature_c DROP NOT NULL;
ALTER TABLE device_env_data ALTER COLUMN humidity_rh DROP NOT NULL;

ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS temperature_min_c numeric(6,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS temperature_max_c numeric(6,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS temperature_avg_c numeric(6,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS humidity_min_rh numeric(5,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS humidity_max_rh numeric(5,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS humidity_avg_rh numeric(5,2);
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS samples integer;
ALTER TABLE device_env_data ADD COLUMN IF NOT EXISTS period_s integer;
