# Retention workflow deployment

The retention and exit workflows are implemented in the repository but are not active until their Supabase migration, Edge Function, secrets, and scheduled invocation are configured in the target project.

## Database migration

1. Confirm the target Supabase project and take a verified database backup.
2. Review pending migrations with `supabase migration list`.
3. Apply the migration through the approved release process: `supabase db push`.
4. Verify the new tables, report and early-warning RPCs, private `handover-guides` bucket, and RLS policies in the target project.

The retention migration adds historical exit imports, structured exit interviews, rehire eligibility, follow-up records, private handover guides and successor shares, single-use post-exit surveys, and all-time turnover aggregation. The engagement/employment migration adds effective-dated employment history, private employee documents, scheduled staff surveys, aggregate results, and HR-owned retention actions. The reporting migration suppresses small groups in quarterly and baseline reports, changes CSV exports to aggregate-only data, and adds HR-only department-level advisory warnings. Do not edit an applied migration; use a new versioned migration for future changes.

### If a policy-already-exists error appears

The migration drops and recreates its named policies so a partial manual SQL Editor run can be retried. Still, first check `supabase migration list`:

- If this migration is already recorded as applied, do not execute the SQL file again. Verify the schema and use the normal versioned migration flow for any further change.
- If it is not recorded, a previous SQL Editor attempt may have left partial objects behind. Confirm the target database and backup, then retry through `supabase db push`; do not delete policies or tables manually.

## Survey and reminder dispatcher

Deploy `dispatch-post-exit-surveys` after the migration:

```sh
supabase functions deploy dispatch-post-exit-surveys
```

Configure these Edge Function secrets in the target project using its approved secret-management process:

- `POST_EXIT_SURVEY_CRON_SECRET`: a high-entropy secret used to authenticate the scheduled request.
- `RESEND_API_KEY`: the transactional email provider key.
- `NOTIFICATION_FROM_EMAIL`: a verified sender address.
- `NEXT_PUBLIC_APP_URL`: the public application origin used to construct survey links.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: the project URL and server-only service role key if they are not already injected by the Edge Function runtime.

Never commit secret values or place them in client-side environment variables.

Enable `pg_cron`, `pg_net`, and Supabase Vault in the project. Store the project URL and the same cron secret in Vault under the names `supabase_url` and `post_exit_survey_cron_secret`. Then schedule the daily request in the SQL editor:

```sql
select cron.schedule(
  'dispatch-post-exit-surveys-daily',
  '15 6 * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'supabase_url'
      ) || '/functions/v1/dispatch-post-exit-surveys',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'post_exit_survey_cron_secret'
        ),
        'Content-Type',
        'application/json'
      ),
      body := '{}'::jsonb
    );
  $job$
);
```

Supabase cron uses UTC; `06:15 UTC` is `08:15` in Zimbabwe. Verify that the schedule exists in `cron.job` and inspect `cron.job_run_details` after the first run. Confirm a test invitation is sent once, submitted once, and then unavailable. Confirm guide reminders are sent only for due guides.

## Release checks

- Test in a non-production project first, using test employees and a verified test sender.
- Verify employment changes create correct history ranges, including multiple changes on the same day.
- Verify employee document uploads, signed-download expiry, access by the document owner and HR, and denial for unrelated employees and administrators.
- Verify employees can submit only one valid response to an open survey, cannot submit after closure, and cannot read another employee's response.
- Verify administrators cannot view identified survey responses or HR retention actions, and survey distributions remain hidden below five responses.
- Verify that the public survey route accepts only valid, unexpired, single-use links.
- Verify that only HR and HR Managers can manage imported exit data, interviews, rehire decisions, follow-ups, and CSV exports.
- Verify that quarterly and baseline reports suppress groups below five, and CSV files contain only department-quarter aggregates with no employee identifiers or free-text notes.
- Verify that early-warning calculations require at least two completed reportable quarters, use the approved threshold, suppress engagement aggregates below five respondents, and never assign an individual risk score.
- Test handover-guide uploads, successor access, signed-download expiry, and denial for unrelated employees.
- Check Edge Function logs, email delivery, database audit events, RLS behavior, and application logs before approving production use.
- Configure data-retention, email-provider, and privacy notices with CUT policy owners before inviting former employees.

Applying the migration and configuring the scheduled job are production operations. This repository change does not perform either operation.
