begin;

-- Retention interventions are support records, not outputs of an attrition model.
-- Preserve intervention history while removing unsupported historical scores.
alter table public.retention_interventions
  alter column risk_score drop not null;

update public.retention_interventions
set risk_score = null
where risk_score is not null;

commit;
