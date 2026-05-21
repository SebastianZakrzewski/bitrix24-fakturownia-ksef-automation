CREATE TABLE "fakturownia-ksef-invoices".fakturownia_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitrix_deal_id text NOT NULL,
  fakturownia_order_id text NOT NULL,
  fakturownia_order_number text,
  created_from_invoice_process_id uuid REFERENCES "fakturownia-ksef-invoices".invoice_processes (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fakturownia_orders_bitrix_deal_id_key UNIQUE (bitrix_deal_id),
  CONSTRAINT fakturownia_orders_fakturownia_order_id_key UNIQUE (fakturownia_order_id)
);
