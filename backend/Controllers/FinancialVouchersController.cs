using System.Data;
using System.Security.Claims;
using System.Text.Json;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/admin/sales-purchase/finance")]
[Route("api/superadmin/sales-purchase/finance")]
public sealed class FinancialVouchersController(ApplicationDbContext db) : ControllerBase
{
    private sealed record AutoRow(Guid Id, DateTime EntryDate, string Reference, string Description, string DebitAccount, string CreditAccount, decimal Amount, string Status);
    private static readonly string[] Types = ["CASH_RECEIPT", "DRAFT_RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL", "EXPENSE_PURCHASE", "PAYMENT", "RECEIPT", "SUPPLIER_CREDIT", "SUPPLIER_DEBIT"];
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private bool Super => User.IsStaffRole(StaffRoles.SuperAdmin);
    private Guid? ActorBranch => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;
    private bool Scoped => !Super && (ActorBranch.HasValue || User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive));
    private bool Can(string permission) => ActorId != Guid.Empty && (!Request.Path.StartsWithSegments("/api/superadmin") || Super)
        && User.HasStaffPermission(SalesPurchasePermissions.View) && User.HasStaffPermission(permission);
    private bool BranchAllowed(Guid? id) => !Scoped || ActorBranch.HasValue && ActorBranch == id;
    private IQueryable<FinancialVoucher> Scope(IQueryable<FinancialVoucher> query) => Scoped ? query.Where(x => x.BranchId == ActorBranch && ActorBranch != null) : query;
    private bool ReadType(string type) => Can(type is "CASH_RECEIPT" or "DRAFT_RECEIPT" or "CREDIT_NOTE" or "DEBIT_NOTE" ? SalesPurchasePermissions.AccountsView : SalesPurchasePermissions.JournalView);
    private bool EditType(string type) => ReadType(type) && Can(type is "CASH_RECEIPT" or "DRAFT_RECEIPT" ? SalesPurchasePermissions.ReceiptsManage : type is "CREDIT_NOTE" or "DEBIT_NOTE" or "SUPPLIER_CREDIT" or "SUPPLIER_DEBIT" ? SalesPurchasePermissions.NotesManage : SalesPurchasePermissions.JournalManage);
    private static object Row(FinancialVoucher x) => new
    {
        x.Id, x.Number, x.Type, x.VoucherDate, x.Reference, x.Narration, x.DebitAccount, x.CreditAccount,
        x.Amount, x.Method, x.ChequeNumber, x.BankName, x.Payee, x.Status, x.BranchId, branchName = x.Branch?.Name,
        x.InvoiceId, x.SupplierInvoiceId, invoiceNumber = x.Invoice?.InvoiceNumber ?? x.SupplierInvoice?.InvoiceNumber,
        partyName = x.Invoice?.Order?.Customer?.FullName ?? x.SupplierInvoice?.Supplier?.Name,
        x.Revision, x.PostedAt, x.CreatedAt, x.UpdatedAt
    };
    private IQueryable<FinancialVoucher> Full => Scope(db.FinancialVouchers).Include(x => x.Branch)
        .Include(x => x.Invoice).ThenInclude(x => x!.Order).ThenInclude(x => x!.Customer)
        .Include(x => x.SupplierInvoice).ThenInclude(x => x!.Supplier);

    [HttpGet("vouchers")]
    public async Task<IActionResult> List(DateTime? from, DateTime? to, string? type, string? status, string? search, Guid? branchId, CancellationToken ct)
    {
        if (!Can(SalesPurchasePermissions.AccountsView) && !Can(SalesPurchasePermissions.JournalView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId)) return Forbid();
        if (from.HasValue && to.HasValue && from > to) return BadRequest(new { message = "From date must be before To date." });
        var query = Full.AsNoTracking();
        if (from.HasValue) query = query.Where(x => x.VoucherDate >= from.Value.Date);
        if (to.HasValue) query = query.Where(x => x.VoucherDate < to.Value.Date.AddDays(1));
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId);
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(x => x.Type == type);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Number.Contains(search) || x.Reference.Contains(search) || x.Narration.Contains(search) || x.Payee != null && x.Payee.Contains(search));
        // Permission filtering is applied before the limit to avoid starving accessible rows.
        var allowed = Types.Where(ReadType).ToList();
        return Ok((await query.Where(x => allowed.Contains(x.Type)).OrderByDescending(x => x.VoucherDate).ThenByDescending(x => x.CreatedAt).Take(1000).ToListAsync(ct)).Select(Row));
    }

    [HttpGet("vouchers/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var item = await Full.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        return ReadType(item.Type) ? Ok(Row(item)) : Forbid();
    }

    [HttpGet("options")]
    public async Task<IActionResult> Options(Guid? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(SalesPurchasePermissions.AccountsView) && !Can(SalesPurchasePermissions.JournalView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId)) return Forbid();
        var branches = db.Branches.AsNoTracking().Where(x => x.IsActive);
        if (Scoped) branches = branches.Where(x => x.Id == ActorBranch && ActorBranch != null);
        var invoices = db.Invoices.AsNoTracking().Where(x => x.PaymentStatus != "VOID" && x.Order != null && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed);
        var suppliers = db.SupplierInvoices.AsNoTracking().Where(x => x.Status != "VOID");
        var selectedBranch = Scoped ? ActorBranch : branchId;
        if (selectedBranch.HasValue)
        {
            invoices = invoices.Where(x => x.Order!.BranchId == selectedBranch);
            suppliers = suppliers.Where(x => x.BranchId == selectedBranch || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == selectedBranch);
        }
        else if (Scoped) { invoices = invoices.Where(_ => false); suppliers = suppliers.Where(_ => false); }
        if (from.HasValue) { invoices = invoices.Where(x => x.IssuedAt >= from.Value.Date); suppliers = suppliers.Where(x => x.InvoiceDate >= from.Value.Date); }
        if (to.HasValue) { var end = to.Value.Date.AddDays(1); invoices = invoices.Where(x => x.IssuedAt < end); suppliers = suppliers.Where(x => x.InvoiceDate < end); }
        return Ok(new
        {
            branches = await branches.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct),
            accounts = await db.ChartAccounts.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Code).Select(x => new { x.Id, x.Code, x.Name, x.AccountType }).ToListAsync(ct),
            customerInvoices = Can(SalesPurchasePermissions.AccountsView) ? await invoices.OrderByDescending(x => x.IssuedAt).Take(2000).Select(x => new { x.Id, x.InvoiceNumber, partyId = x.Order!.CustomerId, partyName = x.Order.Customer!.FullName, branchId = x.Order.BranchId, x.Total, x.PaidAmount, balance = x.Total - x.PaidAmount, x.DueAt }).ToListAsync(ct) : null,
            supplierInvoices = Can(SalesPurchasePermissions.JournalView) ? await suppliers.OrderByDescending(x => x.InvoiceDate).Take(2000).Select(x => new { x.Id, x.InvoiceNumber, partyId = x.SupplierId, partyName = x.Supplier!.Name, branchId = x.BranchId ?? (x.PurchaseOrder != null ? (Guid?)x.PurchaseOrder.BranchId : null), x.Total, x.PaidAmount, balance = x.Total - x.PaidAmount, x.DueAt }).ToListAsync(ct) : null
        });
    }

    [HttpPost("vouchers")]
    public async Task<IActionResult> Create(FinancialVoucherInput input, CancellationToken ct)
    {
        if (!EditType(input.Type)) return Forbid();
        var error = await Validate(input, ct); if (error is not null) return BadRequest(new { message = error });
        var item = new FinancialVoucher { Number = $"FV-{ApplicationTime.NepalNow:yyyyMMdd}-{Guid.NewGuid():N}", Type = input.Type,
            Reference = "", Narration = "", DebitAccount = "", CreditAccount = "", CreatedBy = ActorId };
        Apply(item, input); db.FinancialVouchers.Add(item); Audit(item, "CREATED", null, Row(item));
        await db.SaveChangesAsync(ct); return Ok(Row(item));
    }

    [HttpPut("vouchers/{id:guid}")]
    public async Task<IActionResult> Edit(Guid id, FinancialVoucherInput input, CancellationToken ct)
    {
        var item = await Full.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        if (!EditType(item.Type) || !EditType(input.Type)) return Forbid();
        if (item.Revision != input.Revision || item.Status != "DRAFT") return Conflict(new { message = "Reload the voucher. Posted vouchers must be unposted before editing." });
        var error = await Validate(input, ct); if (error is not null) return BadRequest(new { message = error });
        var previous = Row(item); Apply(item, input); item.Revision++; item.UpdatedAt = DateTime.UtcNow; Audit(item, "EDITED", previous, Row(item));
        return await Save(item, ct);
    }

    [HttpPut("vouchers/{id:guid}/narration")]
    public async Task<IActionResult> Narration(Guid id, FinancialVoucherNarration input, CancellationToken ct)
    {
        var item = await Full.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        if (!ReadType(item.Type) || !Can(SalesPurchasePermissions.Narration)) return Forbid();
        if (item.Revision != input.Revision) return Conflict(new { message = "The voucher changed. Reload it before editing." });
        if (string.IsNullOrWhiteSpace(input.Narration) || input.Narration.Length > 1000 || string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 500) return BadRequest(new { message = "Enter narration (up to 1000 characters) and an audit reason (up to 500)." });
        var previous = Row(item); item.Narration = input.Narration.Trim(); item.Revision++; item.UpdatedAt = DateTime.UtcNow;
        if (item.JournalEntryId is Guid journalId) { var journal = await db.JournalEntries.FindAsync([journalId], ct); if (journal is not null) { journal.Description = item.Narration.Length > 300 ? item.Narration[..300] : item.Narration; journal.Notes = item.Narration; journal.UpdatedAt = DateTime.UtcNow; } }
        Audit(item, "NARRATION_EDITED", previous, new { item.Narration, input.Reason }); return await Save(item, ct);
    }

    [HttpPost("vouchers/{id:guid}/post")]
    public Task<IActionResult> Post(Guid id, FinancialVoucherAction input, CancellationToken ct) => Transition(id, input, true, ct);
    [HttpPost("vouchers/{id:guid}/unpost")]
    public Task<IActionResult> Unpost(Guid id, FinancialVoucherAction input, CancellationToken ct) => Transition(id, input, false, ct);

    private async Task<IActionResult> Transition(Guid id, FinancialVoucherAction input, bool post, CancellationToken ct)
    {
        if (!Can(post ? SalesPurchasePermissions.Post : SalesPurchasePermissions.Unpost)) return Forbid();
        if (!post && (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 500)) return BadRequest(new { message = "Enter an audit reason before unposting (up to 500 characters)." });
        // Serialize financial writes in one transaction; concurrent requests cannot apply a voucher twice.
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var item = await Full.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
            if (!ReadType(item.Type)) return Forbid();
            if (item.Revision != input.Revision || item.Status != (post ? "DRAFT" : "POSTED")) return Conflict(new { message = "The voucher changed or was already processed. Reload the saved record." });
            if (item.InvoiceId.HasValue && !Can(SalesPurchasePermissions.AccountsView)) return Forbid();
            var previous = Row(item);
            var error = await ApplyFinancialEffects(item, post, ct); if (error is not null) return Conflict(new { message = error });
            item.Status = post ? "POSTED" : "DRAFT"; item.PostedAt = post ? DateTime.UtcNow : null; item.Revision++; item.UpdatedAt = DateTime.UtcNow;
            Audit(item, post ? "POSTED" : "UNPOSTED", previous, new { voucher = Row(item), input.Reason });
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(Row(item));
        });
    }

    private async Task<string?> Validate(FinancialVoucherInput x, CancellationToken ct)
    {
        if (!Types.Contains(x.Type) || x.Amount <= 0 || x.Amount > 100000000 || decimal.Round(x.Amount, 2) != x.Amount) return "Choose a supported voucher type and a positive amount with at most two decimal places.";
        if (x.VoucherDate == default || string.IsNullOrWhiteSpace(x.Reference) || x.Reference.Length > 160 || string.IsNullOrWhiteSpace(x.Narration) || x.Narration.Length > 1000) return "Enter a date, reference (up to 160 characters), and narration (up to 1000).";
        if (string.IsNullOrWhiteSpace(x.DebitAccount) || string.IsNullOrWhiteSpace(x.CreditAccount) || x.DebitAccount.Length > 120 || x.CreditAccount.Length > 120 || x.DebitAccount.Trim().Equals(x.CreditAccount.Trim(), StringComparison.OrdinalIgnoreCase)) return "Choose two different debit and credit accounts (up to 160 characters).";
        if (!new[] { "CASH", "BANK_TRANSFER", "CHEQUE" }.Contains(x.Method) || x.ChequeNumber?.Length > 80 || x.BankName?.Length > 160 || x.Payee?.Length > 160) return "Enter a valid payment method, cheque, bank and payee.";
        if (x.Type == "CASH_RECEIPT" && x.Method != "CASH" || x.Type == "DRAFT_RECEIPT" && x.Method == "CASH") return "Cash receipts require cash; draft receipts require a bank transfer/draft or cheque.";
        if (x.Method == "CHEQUE" && (string.IsNullOrWhiteSpace(x.ChequeNumber) || string.IsNullOrWhiteSpace(x.BankName) || string.IsNullOrWhiteSpace(x.Payee))) return "Cheque payments require a cheque number, bank and payee.";
        var branch = Scoped ? ActorBranch : x.BranchId;
        if (!BranchAllowed(branch) || Scoped && x.BranchId.HasValue && x.BranchId != ActorBranch) return "The selected branch is outside your access.";
        if (branch.HasValue && !await db.Branches.AnyAsync(b => b.Id == branch && b.IsActive, ct)) return "Choose an active branch.";
        if (x.InvoiceId.HasValue && x.SupplierInvoiceId.HasValue) return "Choose one customer or supplier invoice.";
        if (x.Type is "CASH_RECEIPT" or "DRAFT_RECEIPT" or "CREDIT_NOTE" or "DEBIT_NOTE" && x.InvoiceId is null) return "Choose a customer invoice.";
        if (x.Type is "SUPPLIER_CREDIT" or "SUPPLIER_DEBIT" && x.SupplierInvoiceId is null) return "Choose a supplier invoice.";
        if (x.InvoiceId.HasValue && x.Type is not ("CASH_RECEIPT" or "DRAFT_RECEIPT" or "CREDIT_NOTE" or "DEBIT_NOTE" or "RECEIPT")) return "This voucher type cannot target a customer invoice.";
        if (x.SupplierInvoiceId.HasValue && x.Type is not ("SUPPLIER_CREDIT" or "SUPPLIER_DEBIT" or "PAYMENT")) return "This voucher type cannot target a supplier invoice.";
        if (x.InvoiceId is Guid invoiceId)
        {
            if (!Can(SalesPurchasePermissions.AccountsView)) return "Customer invoice access is required.";
            var invoice = await db.Invoices.AsNoTracking().Include(i => i.Order).SingleOrDefaultAsync(i => i.Id == invoiceId, ct);
            if (invoice?.Order is null || invoice.PaymentStatus == "VOID" || invoice.Order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed || invoice.Order.BranchId != branch) return "Choose a valid customer invoice in the selected branch.";
            if (x.Type == "DEBIT_NOTE" ? x.DebitAccount.Trim() != "Accounts Receivable" : x.CreditAccount.Trim() != "Accounts Receivable") return "Customer documents must use Accounts Receivable on the appropriate side.";
        }
        if (x.SupplierInvoiceId is Guid supplierId)
        {
            if (!Can(SalesPurchasePermissions.JournalView)) return "Supplier invoice access is required.";
            var invoice = await db.SupplierInvoices.AsNoTracking().Include(i => i.PurchaseOrder).SingleOrDefaultAsync(i => i.Id == supplierId, ct);
            if (invoice is null || invoice.Status == "VOID" || (invoice.BranchId ?? invoice.PurchaseOrder?.BranchId) != branch) return "Choose a valid supplier invoice in the selected branch.";
            if (x.Type == "SUPPLIER_CREDIT" ? x.CreditAccount.Trim() != "Accounts Payable" : x.DebitAccount.Trim() != "Accounts Payable") return "Supplier documents must use Accounts Payable on the appropriate side.";
        }
        return null;
    }

    private void Apply(FinancialVoucher item, FinancialVoucherInput x)
    {
        item.Type = x.Type; item.VoucherDate = x.VoucherDate; item.Reference = x.Reference.Trim(); item.Narration = x.Narration.Trim();
        item.DebitAccount = x.DebitAccount.Trim(); item.CreditAccount = x.CreditAccount.Trim(); item.Amount = x.Amount;
        item.Method = x.Method; item.ChequeNumber = x.ChequeNumber?.Trim(); item.BankName = x.BankName?.Trim(); item.Payee = x.Payee?.Trim();
        item.BranchId = Scoped ? ActorBranch : x.BranchId; item.InvoiceId = x.InvoiceId; item.SupplierInvoiceId = x.SupplierInvoiceId;
    }

    private async Task<string?> ApplyFinancialEffects(FinancialVoucher item, bool post, CancellationToken ct)
    {
        var direction = post ? 1m : -1m;
        if (item.InvoiceId is Guid invoiceId)
        {
            var invoice = await db.Invoices.Include(x => x.Order).SingleAsync(x => x.Id == invoiceId, ct);
            if (invoice.PaymentStatus == "VOID" || invoice.Order is null || invoice.Order.Status is OrderStatuses.Cancelled or OrderStatuses.Failed) return "The linked invoice was cancelled or voided.";
            if (invoice.Order.BranchId != item.BranchId || !BranchAllowed(invoice.Order.BranchId)) return "The linked invoice is outside this voucher's branch.";
            var total = invoice.Total; var paid = invoice.PaidAmount;
            if (item.Type == "CREDIT_NOTE") total -= item.Amount * direction;
            else if (item.Type == "DEBIT_NOTE") total += item.Amount * direction;
            else paid += item.Amount * direction;
            if (total < 0 || paid < 0 || paid > total) return "This operation would exceed the invoice balance or reverse an adjustment already consumed by a later payment.";
            invoice.Total = total; invoice.PaidAmount = paid; invoice.PaymentStatus = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"; invoice.UpdatedAt = DateTime.UtcNow;
            invoice.Order.PaymentStatus = invoice.PaymentStatus; invoice.Order.UpdatedAt = DateTime.UtcNow;
            var credit = await db.CustomerCredits.SingleOrDefaultAsync(x => x.CustomerId == invoice.Order.CustomerId, ct);
            if (credit is not null) { credit.CurrentBalance = Math.Max(0m, credit.CurrentBalance + (item.Type == "DEBIT_NOTE" ? 1m : -1m) * item.Amount * direction); credit.UpdatedAt = DateTime.UtcNow; }
            if (post)
            {
                var ledger = new CustomerLedgerEntry { CustomerId = invoice.Order.CustomerId, InvoiceId = invoice.Id, EntryType = item.Type == "DEBIT_NOTE" ? "DEBIT" : "CREDIT", Amount = item.Amount, EntryDate = item.VoucherDate, Description = item.Number, Reference = item.Reference };
                db.CustomerLedgerEntries.Add(ledger); item.CustomerLedgerEntryId = ledger.Id;
                if (item.Type is "CASH_RECEIPT" or "DRAFT_RECEIPT" or "RECEIPT")
                {
                    var payment = new CustomerPayment { CustomerId = invoice.Order.CustomerId, BranchId = item.BranchId, PaymentNumber = item.Number, Amount = item.Amount, Method = item.Method, PaymentDate = item.VoucherDate, Reference = item.Reference, Notes = item.Narration };
                    db.CustomerPayments.Add(payment); item.CustomerPaymentId = payment.Id;
                }
            }
        }
        if (item.SupplierInvoiceId is Guid supplierId)
        {
            var invoice = await db.SupplierInvoices.Include(x => x.PurchaseOrder).SingleAsync(x => x.Id == supplierId, ct);
            if (invoice.Status == "VOID") return "The linked supplier invoice was voided.";
            if ((invoice.BranchId ?? invoice.PurchaseOrder?.BranchId) != item.BranchId || !BranchAllowed(item.BranchId)) return "The supplier invoice is outside this voucher's branch.";
            var total = invoice.Total; var paid = invoice.PaidAmount;
            if (item.Type == "SUPPLIER_DEBIT") total -= item.Amount * direction;
            else if (item.Type == "SUPPLIER_CREDIT") total += item.Amount * direction;
            else paid += item.Amount * direction;
            if (total < 0 || paid < 0 || paid > total) return "This operation would exceed the supplier balance or reverse an adjustment consumed by a later payment.";
            invoice.Total = total; invoice.PaidAmount = paid; invoice.Status = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"; invoice.UpdatedAt = DateTime.UtcNow;
            if (invoice.PurchaseOrder is not null)
            {
                var allInvoices = await db.SupplierInvoices.Where(x => x.PurchaseOrderId == invoice.PurchaseOrderId && x.Status != "VOID").ToListAsync(ct);
                var totalDue = allInvoices.Sum(x => x.Total); var totalPaid = allInvoices.Sum(x => x.PaidAmount);
                invoice.PurchaseOrder.PaymentStatus = totalPaid >= totalDue ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
                invoice.PurchaseOrder.UpdatedAt = DateTime.UtcNow;
            }
            if (post && item.Type == "PAYMENT")
            {
                var payment = new SupplierPayment { SupplierId = invoice.SupplierId, BranchId = item.BranchId, PaymentNumber = item.Number, Amount = item.Amount, Method = item.Method, PaymentDate = item.VoucherDate, Reference = item.Reference, Notes = item.Narration };
                db.SupplierPayments.Add(payment); item.SupplierPaymentId = payment.Id;
            }
        }
        if (post)
        {
            var journal = new JournalEntry { BranchId = item.BranchId, EntryDate = item.VoucherDate, Reference = item.Number,
                Description = item.Narration.Length > 300 ? item.Narration[..300] : item.Narration, DebitAccount = item.DebitAccount, CreditAccount = item.CreditAccount, Amount = item.Amount, Notes = item.Narration };
            db.JournalEntries.Add(journal); item.JournalEntryId = journal.Id;
        }
        else
        {
            if (item.JournalEntryId is Guid jid) { var journal = await db.JournalEntries.FindAsync([jid], ct); if (journal is not null) { journal.Status = "UNPOSTED"; journal.UpdatedAt = DateTime.UtcNow; } }
            if (item.CustomerLedgerEntryId is Guid lid) { var ledger = await db.CustomerLedgerEntries.FindAsync([lid], ct); if (ledger is not null) db.CustomerLedgerEntries.Remove(ledger); }
            if (item.CustomerPaymentId is Guid cid) { var payment = await db.CustomerPayments.FindAsync([cid], ct); if (payment is not null) { payment.Status = "VOID"; payment.UpdatedAt = DateTime.UtcNow; } }
            if (item.SupplierPaymentId is Guid sid) { var payment = await db.SupplierPayments.FindAsync([sid], ct); if (payment is not null) { payment.Status = "VOID"; payment.UpdatedAt = DateTime.UtcNow; } }
            item.JournalEntryId = null; item.CustomerLedgerEntryId = null; item.CustomerPaymentId = null; item.SupplierPaymentId = null;
        }
        return null;
    }

    [HttpGet("vouchers/{id:guid}/print")]
    public async Task<IActionResult> Print(Guid id, CancellationToken ct)
    {
        if (!Can(SalesPurchasePermissions.Print)) return Forbid();
        var item = await Full.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        if (!ReadType(item.Type)) return Forbid(); return Ok(Row(item));
    }

    [HttpGet("auto-vouchers")]
    public async Task<IActionResult> AutoVouchers(DateTime? from, DateTime? to, Guid? branchId, CancellationToken ct)
    {
        if (!Can(SalesPurchasePermissions.JournalView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId)) return Forbid();
        var start = from?.Date ?? ApplicationTime.NepalNow.Date.AddDays(-30); var end = (to?.Date ?? ApplicationTime.NepalNow.Date).AddDays(1);
        var query = db.JournalEntries.AsNoTracking().Where(x => x.EntryDate >= start && x.EntryDate < end && !x.Reference.StartsWith("FV-") && !db.FinancialVouchers.Any(v => v.JournalEntryId == x.Id));
        if (Scoped) query = query.Where(x => x.BranchId == ActorBranch && ActorBranch != null);
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId);
        var rows = await query.OrderByDescending(x => x.EntryDate).Take(1000).Select(x => new AutoRow(x.Id, x.EntryDate, x.Reference, x.Description, x.DebitAccount, x.CreditAccount, x.Amount, x.Status)).ToListAsync(ct);
        var invoices = db.Invoices.AsNoTracking().Where(x => x.IssuedAt >= start && x.IssuedAt < end && x.PaymentStatus != "VOID" && x.Order != null && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed);
        var purchases = db.SupplierInvoices.AsNoTracking().Where(x => x.InvoiceDate >= start && x.InvoiceDate < end && x.Status != "VOID");
        var expenses = db.BusinessExpenses.AsNoTracking().Where(x => x.ExpenseDate >= start && x.ExpenseDate < end);
        var customerPayments = db.CustomerPayments.AsNoTracking().Where(x => x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED" && !x.PaymentNumber.StartsWith("FV-"));
        var supplierPayments = db.SupplierPayments.AsNoTracking().Where(x => x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED" && !x.PaymentNumber.StartsWith("FV-"));
        var accountantPayments = db.AccountantPayments.AsNoTracking().Where(x => x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED");
        var chosen = Scoped ? ActorBranch : branchId;
        if (chosen.HasValue || Scoped)
        {
            invoices = invoices.Where(x => chosen != null && x.Order!.BranchId == chosen);
            purchases = purchases.Where(x => chosen != null && (x.BranchId == chosen || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == chosen));
            expenses = expenses.Where(x => chosen != null && x.BranchId == chosen);
            customerPayments = customerPayments.Where(x => chosen != null && x.BranchId == chosen);
            supplierPayments = supplierPayments.Where(x => chosen != null && x.BranchId == chosen);
            accountantPayments = accountantPayments.Where(x => chosen != null && (x.Invoice != null && x.Invoice.Order!.BranchId == chosen || x.SupplierInvoice != null && (x.SupplierInvoice.BranchId == chosen || x.SupplierInvoice.BranchId == null && x.SupplierInvoice.PurchaseOrder!.BranchId == chosen)));
        }
        rows.AddRange(await invoices.OrderByDescending(x => x.IssuedAt).Take(1000).Select(x => new AutoRow(x.Id, x.IssuedAt, x.InvoiceNumber, "Sales invoice", "Accounts Receivable", "Sales Revenue / VAT Payable", x.Subtotal + x.TaxAmount - x.DiscountAmount + x.DeliveryFee, "POSTED")).ToListAsync(ct));
        rows.AddRange(await purchases.OrderByDescending(x => x.InvoiceDate).Take(1000).Select(x => new AutoRow(x.Id, x.InvoiceDate, x.InvoiceNumber, "Supplier invoice", "Purchases / Inventory", "Accounts Payable", x.Subtotal + x.TaxAmount, "POSTED")).ToListAsync(ct));
        rows.AddRange(await expenses.OrderByDescending(x => x.ExpenseDate).Take(1000).Select(x => new AutoRow(x.Id, x.ExpenseDate, x.Reference ?? "Expense", x.Description, x.Category, x.PaymentMethod == "CASH" ? "Cash" : "Bank", x.Amount, x.Status)).ToListAsync(ct));
        rows.AddRange(await customerPayments.OrderByDescending(x => x.PaymentDate).Take(1000).Select(x => new AutoRow(x.Id, x.PaymentDate, x.PaymentNumber, "Customer collection", x.Method == "CASH" ? "Cash" : "Bank / Cheques", "Accounts Receivable", x.Amount, "POSTED")).ToListAsync(ct));
        rows.AddRange(await supplierPayments.OrderByDescending(x => x.PaymentDate).Take(1000).Select(x => new AutoRow(x.Id, x.PaymentDate, x.PaymentNumber, "Supplier payment", "Accounts Payable", x.Method == "CASH" ? "Cash" : "Bank", x.Amount, "POSTED")).ToListAsync(ct));
        rows.AddRange(await accountantPayments.OrderByDescending(x => x.PaymentDate).Take(1000).Select(x => new AutoRow(x.Id, x.PaymentDate, x.PaymentNumber, "Accountant payment", x.InvoiceId != null ? (x.Method == "CASH" ? "Cash" : "Bank / Cheques") : "Accounts Payable", x.InvoiceId != null ? "Accounts Receivable" : (x.Method == "CASH" ? "Cash" : "Bank"), x.Amount, "POSTED")).ToListAsync(ct));
        return Ok(rows.OrderByDescending(x => x.EntryDate).Take(1000));
    }

    [HttpGet("debtor-ledger/{customerId:guid}")]
    public async Task<IActionResult> DebtorLedger(Guid customerId, Guid? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(SalesPurchasePermissions.AccountsView)) return Forbid();
        if (branchId.HasValue && !BranchAllowed(branchId)) return Forbid();
        var invoices = db.Invoices.AsNoTracking().Where(x => x.Order != null && x.Order.CustomerId == customerId && x.PaymentStatus != "VOID" && x.Order.Status != OrderStatuses.Cancelled && x.Order.Status != OrderStatuses.Failed);
        var chosen = Scoped ? ActorBranch : branchId;
        if (chosen.HasValue || Scoped) invoices = invoices.Where(x => chosen != null && x.Order!.BranchId == chosen);
        var ids = await invoices.Select(x => x.Id).ToListAsync(ct);
        if (ids.Count == 0) return NotFound(new { message = "No customer invoices are accessible in this branch." });
        var end = (to?.Date ?? ApplicationTime.NepalNow.Date).AddDays(1);
        var entries = await db.CustomerLedgerEntries.AsNoTracking().Where(x => x.CustomerId == customerId && x.InvoiceId != null && ids.Contains(x.InvoiceId.Value) && x.EntryDate < end).OrderBy(x => x.EntryDate).ThenBy(x => x.CreatedAt).ToListAsync(ct);
        var opening = from.HasValue ? entries.Where(x => x.EntryDate < from.Value.Date).Sum(x => x.EntryType == "DEBIT" ? x.Amount : -x.Amount) : 0m;
        return Ok(new { opening, entries = entries.Where(x => !from.HasValue || x.EntryDate >= from.Value.Date).Select(x => new { x.Id, x.EntryDate, x.EntryType, x.Amount, x.Description, x.Reference }) });
    }

    private void Audit(FinancialVoucher item, string action, object? before, object after) => db.ActivityLogs.Add(new ActivityLog
    {
        ActorId = ActorId, ActorRole = User.FindFirstValue(ClaimTypes.Role) ?? "STAFF", Action = $"FINANCIAL_VOUCHER_{action}",
        EntityType = "FinancialVoucher", EntityId = item.Id.ToString(), PreviousValue = before is null ? null : JsonSerializer.Serialize(before), NewValue = JsonSerializer.Serialize(after)
    });
    private async Task<IActionResult> Save(FinancialVoucher item, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); return Ok(Row(item)); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Another user changed this voucher. Reload before saving." }); }
    }
}
