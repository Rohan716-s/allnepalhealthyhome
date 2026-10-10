# ERP List / Add refactor checklist

Status: inspection and implementation in progress. Existing APIs and database schemas are retained.

| Component / module | Creation forms | Existing list containers | Plan | Status |
|---|---:|---:|---|---|
| account-setup-panel | 3 | 3 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-branches-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-catalog-taxonomy | 4 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-cms-pages | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-coupons-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-customer-management | 1 | 0 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-delivery-slots | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-delivery-zones-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-flash-sales-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-health-articles-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-hero-slides-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-inventory-page | 1 | 0 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-logistics-management | 2 | 2 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-notification-templates-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-order-assignment | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| admin-payment-status-dialog | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| admin-prescription-detail-dialog | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| admin-product-import | 2 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| admin-products-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-purchase-orders-page | 1 | 0 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-roles-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-staff-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-transporter-management | 2 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| admin-website-control | 4 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| ai-pharmacy-assistant | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| cash-handover-panel | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| field-sales-workspace | 4 | 0 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| financial-voucher-panel | 2 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| hrms-admin-page | 4 | 3 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| hrms-office-operations | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| hrms-payroll-operations | 3 | 2 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| hrms-setup-page | 1 | 1 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| hrms-workforce-operations | 3 | 3 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| modern-login-shell | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| pharmacy-commercial-setup-panel | 1 | 4 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| product-rack-setup-panel | 1 | 2 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| purchase-reference-workflows | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| reference-report-panel | 2 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| return-cancellation-panel | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| rider-order-composer | 1 | 0 | Inspect and separate record lists from creation forms; preserve existing edits and permissions | Pending |
| sales-reverse-entry-panel | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| site-header | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| staff-profile | 2 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| superadmin-sidebar-theme-settings | 1 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |
| supervisor-profile | 2 | 0 | Preserve transactional action, settings, import, profile, authentication or report form; no unrelated CRUD creation route | Preserve / verify |

Also inspect route-owned forms: Accounts payments, expenses, supplier invoices, journal and reconciliation; attendance corrections; leave applications; consumer saved addresses; Sales/Purchase entry, returns and customer/supplier receipts. Read-only reports and operational approval dialogs must not acquire unsupported Add actions.

Existing `/create` and `/{id}/edit` routes remain canonical. New nested module routes must retain the selected department and register in their URLs.
