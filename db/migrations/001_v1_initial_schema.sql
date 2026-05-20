CREATE SCHEMA IF NOT EXISTS "fakturownia-ksef-invoices";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "fakturownia-ksef-invoices".invoice_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitrix_deal_id text NOT NULL,
  invoice_type text NOT NULL,
  status text NOT NULL,
  idempotency_key text NOT NULL,
  fakturownia_invoice_id text,
  fakturownia_invoice_url text,
  ksef_status text,
  ksef_last_checked_at timestamptz,
  validation_errors jsonb,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT invoice_processes_invoice_type_check CHECK (
    invoice_type IN ('FULL', 'ADVANCE', 'FINAL')
  ),
  CONSTRAINT invoice_processes_status_check CHECK (
    status IN (
      'TRIGGER_RECEIVED',
      'VALIDATION_FAILED',
      'INVOICE_CREATION_IN_PROGRESS',
      'FAKTUROWNIA_ERROR',
      'UNKNOWN_AFTER_TIMEOUT',
      'INVOICE_CREATED',
      'KSEF_SUBMISSION_CONFIRMED',
      'KSEF_SUBMISSION_ERROR',
      'KSEF_STATUS_UNKNOWN',
      'MANUAL_REVIEW_REQUIRED',
      'COMPLETED'
    )
  ),
  CONSTRAINT invoice_processes_bitrix_deal_id_invoice_type_key UNIQUE (bitrix_deal_id, invoice_type),
  CONSTRAINT invoice_processes_idempotency_key_key UNIQUE (idempotency_key)
);

CREATE TABLE "fakturownia-ksef-invoices".invoice_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_process_id uuid NOT NULL REFERENCES "fakturownia-ksef-invoices".invoice_processes (id),
  bitrix_deal_id text NOT NULL,
  invoice_type text NOT NULL,
  fakturownia_invoice_id text NOT NULL,
  fakturownia_invoice_url text NOT NULL,
  total_net numeric(12, 2) NOT NULL,
  total_gross numeric(12, 2) NOT NULL,
  vat_rate integer NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_records_invoice_process_id_key UNIQUE (invoice_process_id),
  CONSTRAINT invoice_records_fakturownia_invoice_id_key UNIQUE (fakturownia_invoice_id)
);

CREATE TABLE "fakturownia-ksef-invoices".invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_process_id uuid REFERENCES "fakturownia-ksef-invoices".invoice_processes (id),
  bitrix_deal_id text,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "fakturownia-ksef-invoices".bitrix_deal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_process_id uuid NOT NULL REFERENCES "fakturownia-ksef-invoices".invoice_processes (id),
  bitrix_deal_id text NOT NULL,
  bitrix_company_id text,
  raw_deal jsonb NOT NULL,
  raw_company jsonb,
  raw_product_rows jsonb,
  extracted_invoice_type text,
  extracted_advance_amount numeric(12, 2),
  extracted_products jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "fakturownia-ksef-invoices".client_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bitrix_paid_stage_id text NOT NULL,
  bitrix_field_mapping jsonb NOT NULL,
  invoice_type_mapping jsonb NOT NULL,
  default_vat_rate integer NOT NULL DEFAULT 23,
  default_currency text NOT NULL DEFAULT 'PLN',
  default_unit text NOT NULL DEFAULT 'szt.',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX client_configs_one_active_idx ON "fakturownia-ksef-invoices".client_configs (is_active)
WHERE is_active = true;

CREATE TABLE "fakturownia-ksef-invoices".technical_retry_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_process_id uuid NOT NULL REFERENCES "fakturownia-ksef-invoices".invoice_processes (id),
  requested_by text NOT NULL,
  reason text NOT NULL,
  from_status text NOT NULL,
  target_action text NOT NULL,
  allowed boolean NOT NULL,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technical_retry_attempts_target_action_check CHECK (
    target_action IN (
      'RETRY_VALIDATION_AND_PROCESS',
      'RETRY_FAKTUROWNIA_CREATION',
      'RETRY_BITRIX_SYNC'
    )
  )
);

CREATE TABLE "fakturownia-ksef-invoices".panel_admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT panel_admin_users_email_key UNIQUE (email)
);
