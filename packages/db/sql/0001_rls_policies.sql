--> statement-breakpoint
-- Row-level security policies.
--
-- Supabase exposes `auth.uid()` (the authenticated user's UUID) in PostgREST
-- requests. Our `users` table mirrors that id in the `auth_provider_id` column,
-- so policies join through `users.id = portfolios.user_id` and verify the
-- requesting user owns the row.
--
-- Service-role (cron / admin) bypasses RLS automatically because Supabase
-- sets `bypassrls = true` on that role.

-- ============ enable RLS ============
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolio_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolio_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watchlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

-- Fund-catalog tables are public-read; only the service role can write.
ALTER TABLE "funds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holdings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nav_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_price_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticker_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_health" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- ============ helper: current isp user id ============
-- Maps the Supabase auth.uid() to our users.id. Used by every owner policy.
CREATE OR REPLACE FUNCTION public.current_isp_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.users WHERE auth_provider_id = (SELECT auth.uid()::text) AND deleted_at IS NULL
$$;

--> statement-breakpoint
-- ============ users: only owner can read/update their own row ============
CREATE POLICY "users_self_select" ON "users" FOR SELECT
  USING (auth_provider_id = (SELECT auth.uid()::text));

CREATE POLICY "users_self_update" ON "users" FOR UPDATE
  USING (auth_provider_id = (SELECT auth.uid()::text))
  WITH CHECK (auth_provider_id = (SELECT auth.uid()::text));

-- Insert is done by the auth-bootstrap trigger on first login (service role).

--> statement-breakpoint
-- ============ portfolios + child tables ============
CREATE POLICY "portfolios_owner_all" ON "portfolios" FOR ALL
  USING (user_id = public.current_isp_user_id())
  WITH CHECK (user_id = public.current_isp_user_id());

CREATE POLICY "portfolio_txn_owner_all" ON "portfolio_transactions" FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = public.current_isp_user_id()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = public.current_isp_user_id()));

CREATE POLICY "portfolio_snap_owner_select" ON "portfolio_snapshots" FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = public.current_isp_user_id()));

CREATE POLICY "watchlist_owner_all" ON "watchlist" FOR ALL
  USING (user_id = public.current_isp_user_id())
  WITH CHECK (user_id = public.current_isp_user_id());

CREATE POLICY "goals_owner_all" ON "goals" FOR ALL
  USING (user_id = public.current_isp_user_id())
  WITH CHECK (user_id = public.current_isp_user_id());

CREATE POLICY "alerts_owner_all" ON "alerts" FOR ALL
  USING (user_id = public.current_isp_user_id())
  WITH CHECK (user_id = public.current_isp_user_id());

CREATE POLICY "import_jobs_owner_all" ON "import_jobs" FOR ALL
  USING (user_id = public.current_isp_user_id())
  WITH CHECK (user_id = public.current_isp_user_id());

CREATE POLICY "audit_log_owner_select" ON "audit_log" FOR SELECT
  USING (user_id = public.current_isp_user_id());
-- audit_log INSERT is service-role only (writes happen via privileged server code).

--> statement-breakpoint
-- ============ public-read fund catalog ============
CREATE POLICY "funds_public_read" ON "funds" FOR SELECT USING (true);
CREATE POLICY "nav_history_public_read" ON "nav_history" FOR SELECT USING (true);
CREATE POLICY "holdings_public_read" ON "holdings" FOR SELECT USING (true);

-- stock_price_cache, ticker_overrides, provider_health are service-role only
-- (no SELECT policy created -> default deny for anon and authenticated).
