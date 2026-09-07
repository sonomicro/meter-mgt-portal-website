/*
  # Add "no flow" detection alongside leak (continuous flow) detection

  1. Changes
    - Add to `leak_detection_settings`:
      - `no_flow_enabled` (boolean, default true) - independent on/off switch,
        separate from the existing `enabled` (continuous-flow/leak) switch
      - `no_flow_duration_threshold` (integer, hours, default 1) - how long flow
        must stay at/below the threshold before alerting
      - `max_flow_rate_threshold` (numeric, L/min, default 0.1) - flow at or
        below this counts as "no flow"

  2. Notes
    - Some pipes are expected to run continuously (so the existing leak/
      continuous-flow alert should be raised or its threshold increased), but
      should still alert if flow drops out entirely - this is the mirror image
      of the existing continuous-flow check, stored on the same row so a
      device/tenant can independently enable/tune either or both.
*/

ALTER TABLE leak_detection_settings ADD COLUMN IF NOT EXISTS no_flow_enabled boolean DEFAULT true;
ALTER TABLE leak_detection_settings ADD COLUMN IF NOT EXISTS no_flow_duration_threshold integer DEFAULT 1;
ALTER TABLE leak_detection_settings ADD COLUMN IF NOT EXISTS max_flow_rate_threshold numeric(10,2) DEFAULT 0.1;
