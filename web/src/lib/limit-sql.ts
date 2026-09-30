export const RESERVE_SQL = `
SELECT gtm_enrichment_demo.reserve($1::uuid, $2, $3) AS outcome,
 extract(epoch FROM date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day' - (now() AT TIME ZONE 'UTC'))::integer AS reset_seconds`;
export const RELEASE_SQL = `UPDATE gtm_enrichment_demo.requests SET active_until = '-infinity'::timestamptz WHERE id = $1::uuid AND scope = $2`;
