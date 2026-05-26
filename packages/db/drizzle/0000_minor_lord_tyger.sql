CREATE TABLE "funds" (
	"scheme_code" text PRIMARY KEY NOT NULL,
	"scheme_name" text NOT NULL,
	"amc_name" text,
	"category" varchar(32) DEFAULT 'OTHER' NOT NULL,
	"sub_category" varchar(64),
	"isin_growth" varchar(12),
	"isin_div" varchar(12),
	"latest_nav" numeric(12, 4),
	"latest_nav_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"as_of_date" date NOT NULL,
	"instrument" text NOT NULL,
	"ticker" varchar(32),
	"isin" varchar(12),
	"asset_type" varchar(16) DEFAULT 'OTHER' NOT NULL,
	"weight_pct" numeric(7, 4),
	"market_value" numeric(18, 2),
	"quantity" numeric(18, 4),
	CONSTRAINT "holdings_scheme_date_instrument_uniq" UNIQUE("scheme_code","as_of_date","instrument")
);
--> statement-breakpoint
CREATE TABLE "nav_history" (
	"scheme_code" text NOT NULL,
	"nav_date" date NOT NULL,
	"nav" numeric(12, 4) NOT NULL,
	CONSTRAINT "nav_history_scheme_code_nav_date_pk" PRIMARY KEY("scheme_code","nav_date")
);
--> statement-breakpoint
CREATE TABLE "stock_price_cache" (
	"ticker" varchar(32) PRIMARY KEY NOT NULL,
	"price" numeric(12, 4) NOT NULL,
	"prev_close" numeric(12, 4),
	"fetched_at" timestamp with time zone NOT NULL,
	"source" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticker_overrides" (
	"instrument_name" text PRIMARY KEY NOT NULL,
	"ticker" varchar(32) NOT NULL,
	"isin" varchar(12),
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider_id" text NOT NULL,
	"email_encrypted" "bytea" NOT NULL,
	"email_hash" text NOT NULL,
	"display_name" text,
	"disclaimer_accepted_at" timestamp with time zone,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id"),
	CONSTRAINT "users_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"config" jsonb NOT NULL,
	"channels" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(18, 2) NOT NULL,
	"target_date" date NOT NULL,
	"portfolio_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"portfolio_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_invested" numeric(18, 2) NOT NULL,
	"total_value" numeric(18, 2) NOT NULL,
	CONSTRAINT "portfolio_snapshots_portfolio_id_snapshot_date_pk" PRIMARY KEY("portfolio_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "portfolio_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"scheme_code" text NOT NULL,
	"txn_type" varchar(16) NOT NULL,
	"txn_date" date NOT NULL,
	"units" numeric(18, 6) NOT NULL,
	"nav_at_txn" numeric(12, 4) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scheme_code" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_scheme_uniq" UNIQUE("user_id","scheme_code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"actor_type" varchar(16) NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_id" uuid,
	"source" varchar(32) NOT NULL,
	"status" varchar(24) NOT NULL,
	"raw_file_path" text,
	"parsed_payload" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"operation" varchar(64) NOT NULL,
	"success" text NOT NULL,
	"latency_ms" text,
	"error" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_scheme_code_funds_scheme_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."funds"("scheme_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_history" ADD CONSTRAINT "nav_history_scheme_code_funds_scheme_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."funds"("scheme_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transactions" ADD CONSTRAINT "portfolio_transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transactions" ADD CONSTRAINT "portfolio_transactions_scheme_code_funds_scheme_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."funds"("scheme_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_scheme_code_funds_scheme_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."funds"("scheme_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funds_scheme_name_idx" ON "funds" USING btree ("scheme_name");--> statement-breakpoint
CREATE INDEX "funds_category_idx" ON "funds" USING btree ("category");--> statement-breakpoint
CREATE INDEX "funds_amc_idx" ON "funds" USING btree ("amc_name");--> statement-breakpoint
CREATE INDEX "holdings_scheme_date_idx" ON "holdings" USING btree ("scheme_code","as_of_date");--> statement-breakpoint
CREATE INDEX "holdings_ticker_idx" ON "holdings" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "nav_history_date_idx" ON "nav_history" USING btree ("nav_date");--> statement-breakpoint
CREATE INDEX "users_auth_provider_idx" ON "users" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE INDEX "portfolio_txn_portfolio_idx" ON "portfolio_transactions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolio_txn_scheme_idx" ON "portfolio_transactions" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "portfolio_txn_date_idx" ON "portfolio_transactions" USING btree ("txn_date");--> statement-breakpoint
CREATE INDEX "portfolios_user_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "provider_health_provider_idx" ON "provider_health" USING btree ("provider","occurred_at");