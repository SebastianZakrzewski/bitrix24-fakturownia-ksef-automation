# Boundaries and Workflow V1

## System boundaries
| System | Responsibility |
|---|---|
| Bitrix24 | Source of deal, company, products, invoice type, advance amount, paid stage; destination for comment and invoice link field |
| n8n | Receives Bitrix24 automation trigger and forwards minimal payload to backend |
| Backend NestJS | Validation, idempotency, mapping, business decisions, Fakturownia call, process statuses, audit, Bitrix sync |
| Supabase/PostgreSQL | Process state, created invoices, audit, idempotency, configuration, retry attempts |
| Fakturownia | Invoice creation and automatic KSeF handling |
| Client panel | Read-only simple view of processes/invoices created by this system |
| KSeF | Indirectly handled through Fakturownia in V1 |

## Source of truth
| Data | Source of truth |
|---|---|
| Current sales stage | Bitrix24 |
| Buyer/company data | Bitrix24 `Company` |
| Product and price data | Bitrix24 |
| Automation process status | Our DB |
| Invoice created by this system | Our DB + Fakturownia external reference |
| Invoice link | Fakturownia, stored in our DB and Bitrix24 |
| KSeF status | Fakturownia, stored as process result |
| Audit | Our DB |
| Client panel view | Our DB |

## Main workflow
1. Deal moves to `Opłacone` in Bitrix24.
2. Bitrix24 automation rule/webhook calls n8n.
3. n8n sends minimal trigger payload to backend.
4. Backend loads active `ClientConfig`.
5. Backend loads current deal from Bitrix24.
6. Backend verifies deal still has paid stage.
7. If stale, backend records `STALE_TRIGGER_IGNORED` event and returns without creating `InvoiceProcess`.
8. Backend extracts/maps invoice type.
9. Backend atomically claims process by `bitrix_deal_id + invoice_type`.
10. Backend loads company and product rows.
11. Backend saves Bitrix snapshot.
12. Backend maps buyer/products.
13. Backend validates invoice rules.
14. If validation fails, backend sets `VALIDATION_FAILED`, stores errors and comments in Bitrix24 if possible.
15. Backend builds `InvoiceDraft`.
16. Backend sets `INVOICE_CREATION_IN_PROGRESS` before Fakturownia side effect.
17. Backend calls Fakturownia integration.
18. Backend saves `InvoiceRecord` and Fakturownia/KSeF status.
19. Backend adds Bitrix24 timeline comment with invoice link.
20. Backend tries to update Bitrix24 invoice link field.
21. Backend sets `COMPLETED` only after required success conditions.
22. Client panel reads list data from our DB.

## Endpoint contracts at boundary level
### n8n -> Backend
`POST /invoice-processes/bitrix-trigger`

Input includes only trigger metadata, not invoice data. Backend loads actual data from Bitrix24.

### Client panel
`GET /client/invoice-processes`

Returns list items only. No details/audit/retry in V1 panel.

### Technical admin
- `POST /admin/invoice-processes/:id/retry`
- `POST /admin/invoice-processes/:id/mark-reviewed`

These are outside client panel and protected by admin secret/API key.

## Manual vs automated boundaries
| Action | V1 mode |
|---|---|
| Start after `Opłacone` | Automated |
| Load Bitrix data | Automated |
| Validate/map/build draft | Automated |
| Create Fakturownia invoice | Automated |
| KSeF through Fakturownia | Automated by Fakturownia |
| Bitrix comment/link | Automated |
| Retry validation/Fakturownia/Bitrix sync | Manual technical endpoint |
| Retry after unknown timeout | Manual only after review |
| KSeF error handling | Manual in Fakturownia/accounting |
| Delete/cancel invoice | Not allowed in V1 |
| Correction invoice | V2 |
