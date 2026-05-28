# SellGenius Invoice Automation — Overview V1

## System
Automation for invoices in the flow:

`Bitrix24 -> n8n -> Backend NestJS -> Fakturownia -> KSeF via Fakturownia -> Bitrix24 sync -> Customer invoice email`

## Business goal
The system automates invoice creation after a Bitrix24 deal reaches the paid stage. It reduces manual invoice work, decreases data-entry errors, ensures KSeF submission is handled through Fakturownia, accelerates post-payment processing, and provides auditable process history.

## V1 trigger
A Bitrix24 automation rule/webhook is triggered when a deal changes to the stage `Opłacone`. Bitrix24 calls n8n. n8n forwards a minimal trigger payload to the backend.

## V1 final result
A process is considered business-successful when:

1. An invoice is created in Fakturownia.
2. Fakturownia confirms KSeF submission status.
3. A Bitrix24 timeline comment with the Fakturownia invoice link is added.
4. The customer receives an email with the Fakturownia invoice PDF and/or link.

The invoice link is also written to a separate Bitrix24 deal field when possible. Failure to update that field is warning-only and does not block `COMPLETED` if the timeline comment was added and the customer email was sent.

## Must never happen
- Duplicate invoice for the same `bitrix_deal_id + invoice_type`.
- Invoice created before validation.
- Invoice without buyer company, NIP, address or products.
- Invoice with an invalid product line.
- Retry that creates a duplicate after timeout/unknown state.
- KSeF processing before confirmed invoice creation in Fakturownia.
- Critical business logic hidden in n8n.
- `COMPLETED` without Bitrix24 timeline comment with invoice link.
- `COMPLETED` without customer invoice email sent.
- Customer invoice email before validation, idempotency check, or confirmed Fakturownia invoice.
- Automatic deletion/cancellation of invoices in V1.

## Mode
DEEP mode: invoices, accounting data, KSeF and external financial side effects require deterministic rules, idempotency, audit, failure states and controlled recovery.

## Architecture readiness
`ARCHITECTURE_READY_FOR_IMPLEMENTATION`
