-- quality.qo sub-scores (amplitude, lock, repeatability, plausibility), the
-- per-family problem flag counts and missed quality blocks. The firmware has
-- sent these since 2.7; they were dropped by the webhook. Cumulative columns
-- are stored as received, interval_* are derived against the previous note.
ALTER TABLE device_quality_data
  ADD COLUMN IF NOT EXISTS sub_amp_sum bigint,
  ADD COLUMN IF NOT EXISTS sub_lock_sum bigint,
  ADD COLUMN IF NOT EXISTS sub_rep_sum bigint,
  ADD COLUMN IF NOT EXISTS sub_plaus_sum bigint,
  ADD COLUMN IF NOT EXISTS sub_amp_min integer,
  ADD COLUMN IF NOT EXISTS sub_lock_min integer,
  ADD COLUMN IF NOT EXISTS sub_rep_min integer,
  ADD COLUMN IF NOT EXISTS sub_plaus_min integer,
  ADD COLUMN IF NOT EXISTS family_amp_hits bigint,
  ADD COLUMN IF NOT EXISTS family_lock_hits bigint,
  ADD COLUMN IF NOT EXISTS family_rep_hits bigint,
  ADD COLUMN IF NOT EXISTS family_plaus_hits bigint,
  ADD COLUMN IF NOT EXISTS missed_blocks bigint,
  ADD COLUMN IF NOT EXISTS interval_sub_amp numeric(5,1),
  ADD COLUMN IF NOT EXISTS interval_sub_lock numeric(5,1),
  ADD COLUMN IF NOT EXISTS interval_sub_rep numeric(5,1),
  ADD COLUMN IF NOT EXISTS interval_sub_plaus numeric(5,1),
  ADD COLUMN IF NOT EXISTS interval_missed_blocks bigint;
