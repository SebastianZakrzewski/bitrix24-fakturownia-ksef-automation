# Database Schema V1

Database: PostgreSQL/Supabase.

## invoice_processes
```sql
invoice_processes
- id uuid primary key
- bitrix_deal_id text not null
- invoice_type text not null
- status text not null
- idempotency_key text not null
- fakturownia_invoice_id text null
- fakturownia_invoice_url text null
- ksef_status text null
- ksef_last_checked_at timestamptz null
- validation_errors jsonb null
- last_error_message text null
- created_at timestamptz not null
- updated_at timestamptz not null
- completed_at timestamptz null
```

Constraints:
```sql
unique(bitrix_deal_id, invoice_type)
unique(idempotency_key)
```

## invoice_records
```sql
invoice_records
- id uuid primary key
- invoice_process_id uuid not null references invoice_processes(id)
- bitrix_deal_id text not null
- invoice_type text not null
- fakturownia_invoice_id text not null
- fakturownia_invoice_url text not null
- total_net numeric(12,2) not null
- total_gross numeric(12,2) not null
- vat_rate integer not null
- currency text not null
- created_at timestamptz not null
```

Constraints:
```sql
unique(invoice_process_id)
unique(fakturownia_invoice_id)
```

## invoice_events
```sql
invoice_events
- id uuid primary key
- invoice_process_id uuid null references invoice_processes(id)
- bitrix_deal_id text null
- event_type text not null
- message text not null
- metadata jsonb null
- created_at timestamptz not null
```

`invoice_process_id` may be null for `STALE_TRIGGER_IGNORED` events.

## bitrix_deal_snapshots
```sql
bitrix_deal_snapshots
- id uuid primary key
- invoice_process_id uuid not null references invoice_processes(id)
- bitrix_deal_id text not null
- bitrix_company_id text null
- raw_deal jsonb not null
- raw_company jsonb null
- raw_product_rows jsonb null
- extracted_invoice_type text null
- extracted_advance_amount numeric(12,2) null
- extracted_products jsonb null
- created_at timestamptz not null
```

Snapshot exists only for a real `InvoiceProcess`.

## client_configs
```sql
client_configs
- id uuid primary key
- name text not null
- bitrix_paid_stage_id text not null
- bitrix_field_mapping jsonb not null
- invoice_type_mapping jsonb not null
- default_vat_rate integer not null default 23
- default_currency text not null default 'PLN'
- default_unit text not null default 'szt.'
- is_active boolean not null default true
- created_at timestamptz not null
- updated_at timestamptz not null
```

Constraint:
```sql
unique(is_active) where is_active = true
```

V1 supports one active client configuration.

## technical_retry_attempts
```sql
technical_retry_attempts
- id uuid primary key
- invoice_process_id uuid not null references invoice_processes(id)
- requested_by text not null
- reason text not null
- from_status text not null
- target_action text not null
- allowed boolean not null
- blocked_reason text null
- created_at timestamptz not null
```

Constraint:
```sql
target_action in (
  'RETRY_VALIDATION_AND_PROCESS',
  'RETRY_FAKTUROWNIA_CREATION',
  'RETRY_BITRIX_SYNC'
)
```

## panel_admin_users
```sql
panel_admin_users
- id uuid primary key
- email text not null
- password_hash text not null
- is_active boolean not null default true
- last_login_at timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Constraint:
```sql
unique(email)
```

## DB rules
- `STALE_TRIGGER_IGNORED` is recorded as event only, not process status.
- `invoice_processes` stores only real invoice processes.
- `InvoiceRecord` existence permanently blocks another `createInvoice` call for that process.
- DB constraints are part of business safety, not optional implementation detail.
