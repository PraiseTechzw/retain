begin;

-- Retention interventions are support records, not outputs of an attrition model.
-- Preserve action history while removing unsupported historical scores.
alter table public.retention_interventions
  drop column if exists risk_score;

commit;
