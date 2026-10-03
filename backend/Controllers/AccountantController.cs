using System.Globalization;
using System.Security.Claims;
using System.Text;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/accountant")]
public sealed class AccountantController(ApplicationDbContext db) : ControllerBase
{
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private bool IsFinanceUser => User.IsStaffRole(StaffRoles.Accountant, StaffRoles.SuperAdmin);
    private bool Can(string permission) => IsFinanceUser && User.HasStaffPermission(permission);
    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? StaffRoles.Accountant;
    private Guid? ActorBranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;
    private bool IsBranchScoped => !User.IsStaffRole(StaffRoles.SuperAdmin) && (ActorBranchId.HasValue || User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive));
    private bool BranchAllowed(Guid? branchId) => !IsBranchScoped || branchId == ActorBranchId;
    private IQueryable<Invoice> ScopeInvoices(IQueryable<Invoice> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.Order != null && x.Order.BranchId == branchId) : query.Where(_ => false);
    private IQueryable<SupplierInvoice> ScopeSupplierInvoices(IQueryable<SupplierInvoice> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.BranchId == branchId || x.BranchId == null && x.PurchaseOrder != null && x.PurchaseOrder.BranchId == branchId) : query.Where(_ => false);
    private IQueryable<AccountantPayment> ScopePayments(IQueryable<AccountantPayment> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.Invoice != null && x.Invoice.Order != null && x.Invoice.Order.BranchId == branchId || x.SupplierInvoice != null && (x.SupplierInvoice.BranchId == branchId || x.SupplierInvoice.BranchId == null && x.SupplierInvoice.PurchaseOrder != null && x.SupplierInvoice.PurchaseOrder.BranchId == branchId)) : query.Where(_ => false);
    private IQueryable<BusinessExpense> ScopeExpenses(IQueryable<BusinessExpense> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.BranchId == branchId) : query.Where(_ => false);
    private IQueryable<BankReconciliation> ScopeReconciliations(IQueryable<BankReconciliation> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.BranchId == branchId) : query.Where(_ => false);
    private IQueryable<JournalEntry> ScopeJournal(IQueryable<JournalEntry> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId ? query.Where(x => x.BranchId == branchId) : query.Where(_ => false);

    [HttpGet("dashboard")]
    public async Task<ActionResult<AccountantDashboardResponse>> Dashboard(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceInvoicesView)) return Forbid();
        var (start, end) = Range(from, to);
        var invoices = ScopeInvoices(db.Invoices.AsNoTracking()).Include(x => x.Order).ThenInclude(x => x!.Customer).Where(x => x.IssuedAt >= start && x.IssuedAt < end);
        var invoiceRows = await invoices.ToListAsync(ct);
        var paid = await ScopePayments(db.AccountantPayments.AsNoTracking()).Where(x => x.InvoiceId != null && x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED").SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var revenue = invoiceRows.Sum(x => x.Total);
        var receivables = await ScopeInvoices(db.Invoices.AsNoTracking()).SumAsync(x => (decimal?)Math.Max(0m, x.Total - x.PaidAmount), ct) ?? 0m;
        var payables = await ScopeSupplierInvoices(db.SupplierInvoices.AsNoTracking()).SumAsync(x => (decimal?)Math.Max(0m, x.Total - x.PaidAmount), ct) ?? 0m;
        var expenses = await ScopeExpenses(db.BusinessExpenses.AsNoTracking()).Where(x => x.ExpenseDate >= start && x.ExpenseDate < end).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var top = invoiceRows.GroupBy(x => new { x.Order!.CustomerId, Name = x.Order.Customer!.FullName }).Select(x => new AccountantTopCustomer(x.Key.CustomerId, x.Key.Name, x.Sum(y => y.Total), x.Sum(y => Math.Max(0m, y.Total - y.PaidAmount)))).OrderByDescending(x => x.Revenue).Take(5).ToList();
        return Ok(new AccountantDashboardResponse(revenue, receivables, payables, expenses, paid - expenses, invoiceRows.Count, top));
    }

    [HttpGet("customers")]
    public async Task<IActionResult> Customers(CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceLedgerView)) return Forbid();
        var query = db.Customers.AsNoTracking().Where(x => x.IsActive);
        if (IsBranchScoped && ActorBranchId is Guid branchId) query = query.Where(x => db.Invoices.Any(i => i.Order!.CustomerId == x.Id && i.Order.BranchId == branchId) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == branchId));
        else if (IsBranchScoped) query = query.Where(_ => false);
        return Ok(await query.OrderBy(x => x.FullName).Select(x => new { id = x.Id, name = x.FullName, email = x.Email, creditLimit = x.CreditLimit }).ToListAsync(ct));
    }

    [HttpGet("invoices")]
    public async Task<ActionResult<IReadOnlyList<AccountantInvoiceResponse>>> Invoices(DateTime? from, DateTime? to, Guid? customerId, string? status, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceInvoicesView)) return Forbid();
        var (start, end) = Range(from, to);
        var query = ScopeInvoices(db.Invoices.AsNoTracking()).Include(x => x.Order).ThenInclude(x => x!.Customer).Where(x => x.IssuedAt >= start && x.IssuedAt < end);
        if (customerId.HasValue) query = query.Where(x => x.Order!.CustomerId == customerId.Value);
        var rows = await query.OrderByDescending(x => x.IssuedAt).Take(500).ToListAsync(ct);
        var mapped = rows.Select(InvoiceRow); if (!string.IsNullOrWhiteSpace(status)) mapped = mapped.Where(x => x.PaymentStatus == status.ToUpperInvariant());
        return Ok(mapped.ToList());
    }

    [HttpGet("payments")]
    public async Task<ActionResult<IReadOnlyList<AccountantPaymentResponse>>> Payments(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinancePaymentsManage)) return Forbid();
        var (start, end) = Range(from, to);
        var rows = await ScopePayments(db.AccountantPayments.AsNoTracking()).Include(x => x.Invoice).Include(x => x.SupplierInvoice).Where(x => x.PaymentDate >= start && x.PaymentDate < end).OrderByDescending(x => x.PaymentDate).Take(500).ToListAsync(ct);
        return Ok(rows.Select(x => new AccountantPaymentResponse(x.Id, x.PaymentNumber, x.Invoice?.InvoiceNumber, x.SupplierInvoice?.InvoiceNumber, x.Method, x.Status, x.Amount, x.PaymentDate, x.Reference)).ToList());
    }

    [HttpPost("payments")]
    public async Task<ActionResult<AccountantPaymentResponse>> RecordPayment(AccountantPaymentInput request, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinancePaymentsManage)) return Forbid();
        if (IsBranchScoped && !ActorBranchId.HasValue) return Forbid();
        if ((request.InvoiceId is null) == (request.SupplierInvoiceId is null) || request.Amount <= 0 || request.Amount > 100000000 || !new[] { "CASH", "BANK_TRANSFER", "CHEQUE" }.Contains(request.Method.ToUpperInvariant())) return BadRequest(new { message = "Choose one invoice, a valid amount, and cash, bank transfer, or cheque." });
        var payment = new AccountantPayment { PaymentNumber = $"PAY-{ApplicationTime.NepalNow:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}", InvoiceId = request.InvoiceId, SupplierInvoiceId = request.SupplierInvoiceId, Method = request.Method.Trim().ToUpperInvariant(), Amount = request.Amount, PaymentDate = request.PaymentDate == default ? ApplicationTime.NepalNow : request.PaymentDate, Reference = request.Reference?.Trim(), Notes = request.Notes?.Trim() };
        if (request.InvoiceId is Guid invoiceId)
        {
            var invoice = await db.Invoices.Include(x => x.Order).SingleOrDefaultAsync(x => x.Id == invoiceId && (!IsBranchScoped || x.Order!.BranchId == ActorBranchId), ct); if (invoice is null) return NotFound(new { message = "The sales invoice could not be found in your branch." });
            if (request.Amount > invoice.Total - invoice.PaidAmount) return BadRequest(new { message = "Payment cannot exceed the invoice balance." });
            invoice.PaidAmount += request.Amount; invoice.PaymentStatus = PaymentStatus(invoice.Total, invoice.PaidAmount); invoice.UpdatedAt = DateTime.UtcNow;
            db.CustomerLedgerEntries.Add(new CustomerLedgerEntry { CustomerId = invoice.Order!.CustomerId, InvoiceId = invoice.Id, Payment = payment, EntryType = "CREDIT", Amount = request.Amount, EntryDate = payment.PaymentDate, Description = $"Payment received for {invoice.InvoiceNumber}", Reference = payment.Reference, DueAt = invoice.DueAt });
        }
        else if (request.SupplierInvoiceId is Guid supplierInvoiceId)
        {
            var invoice = await db.SupplierInvoices.Include(x => x.PurchaseOrder).SingleOrDefaultAsync(x => x.Id == supplierInvoiceId && (!IsBranchScoped || x.BranchId == ActorBranchId || x.PurchaseOrder != null && x.PurchaseOrder.BranchId == ActorBranchId), ct); if (invoice is null) return NotFound(new { message = "The supplier invoice could not be found in your branch." });
            if (request.Amount > invoice.Total - invoice.PaidAmount) return BadRequest(new { message = "Payment cannot exceed the supplier balance." });
            invoice.PaidAmount += request.Amount; invoice.Status = PaymentStatus(invoice.Total, invoice.PaidAmount); invoice.UpdatedAt = DateTime.UtcNow;
        }
        db.AccountantPayments.Add(payment); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ACCOUNTANT_PAYMENT_RECORDED", EntityType = "AccountantPayment", EntityId = payment.Id.ToString(), NewValue = payment.Amount.ToString(CultureInfo.InvariantCulture) });
        await db.SaveChangesAsync(ct); await db.Entry(payment).Reference(x => x.Invoice).LoadAsync(ct); await db.Entry(payment).Reference(x => x.SupplierInvoice).LoadAsync(ct);
        return Ok(new AccountantPaymentResponse(payment.Id, payment.PaymentNumber, payment.Invoice?.InvoiceNumber, payment.SupplierInvoice?.InvoiceNumber, payment.Method, payment.Status, payment.Amount, payment.PaymentDate, payment.Reference));
    }

    [HttpGet("ledger")]
    public async Task<ActionResult<IReadOnlyList<LedgerResponse>>> Ledger(Guid? customerId, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceLedgerView)) return Forbid();
        var customers = db.Customers.AsNoTracking().Where(x => x.IsActive); if (customerId.HasValue) customers = customers.Where(x => x.Id == customerId.Value);
        var invoiceQuery = ScopeInvoices(db.Invoices.AsNoTracking().Include(x => x.Order));
        if (customerId.HasValue) invoiceQuery = invoiceQuery.Where(x => x.Order!.CustomerId == customerId.Value);
        var invoiceRows = await invoiceQuery.ToListAsync(ct);
        if (IsBranchScoped && ActorBranchId is Guid customerBranch) customers = customers.Where(x => invoiceRows.Select(i => i.Order!.CustomerId).Distinct().Contains(x.Id) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == customerBranch));
        else if (IsBranchScoped) customers = customers.Where(_ => false);
        var entriesQuery = db.CustomerLedgerEntries.AsNoTracking().Where(x => !customerId.HasValue || x.CustomerId == customerId.Value);
        if (IsBranchScoped && ActorBranchId is Guid entryBranch) entriesQuery = entriesQuery.Where(x => x.Invoice != null && x.Invoice.Order != null && x.Invoice.Order.BranchId == entryBranch);
        else if (IsBranchScoped) entriesQuery = entriesQuery.Where(_ => false);
        var entries = await entriesQuery.OrderByDescending(x => x.EntryDate).Take(1000).ToListAsync(ct);
        var result = new List<LedgerResponse>();
        foreach (var customer in await customers.ToListAsync(ct)) { var rows = entries.Where(x => x.CustomerId == customer.Id).ToList(); var customerInvoices = invoiceRows.Where(x => x.Order?.CustomerId == customer.Id).ToList(); var debit = customerInvoices.Sum(x => x.Total) + rows.Where(x => x.EntryType == "DEBIT" && x.InvoiceId == null).Sum(x => x.Amount); var credit = customerInvoices.Sum(x => x.PaidAmount) + rows.Where(x => x.EntryType == "CREDIT" && x.InvoiceId == null).Sum(x => x.Amount); var invoiceEntries = customerInvoices.Select(x => new LedgerEntryResponse(x.Id, "DEBIT", x.Total, x.IssuedAt, x.DueAt, $"Invoice {x.InvoiceNumber}", x.InvoiceNumber)); var entryRows = rows.Select(x => new LedgerEntryResponse(x.Id, x.EntryType, x.Amount, x.EntryDate, x.DueAt, x.Description, x.Reference)); var overdue = customerInvoices.Where(x => x.DueAt.HasValue && x.DueAt < ApplicationTime.NepalNow && x.Total > x.PaidAmount).Sum(x => x.Total - x.PaidAmount) + rows.Where(x => x.DueAt.HasValue && x.DueAt < ApplicationTime.NepalNow && x.EntryType == "DEBIT").Sum(x => x.Amount); result.Add(new LedgerResponse(customer.Id, customer.FullName, customer.Email, customer.CreditLimit, debit, credit, debit - credit, overdue, invoiceEntries.Concat(entryRows).OrderByDescending(x => x.EntryDate).ToList())); }
        return Ok(result.OrderByDescending(x => x.Balance).ToList());
    }

    [HttpGet("supplier-invoices")]
    public async Task<ActionResult<IReadOnlyList<SupplierInvoiceResponse>>> SupplierInvoices(CancellationToken ct)
    {
        if (!Can(AppPermissions.FinancePayablesManage)) return Forbid();
        var rows = await ScopeSupplierInvoices(db.SupplierInvoices.AsNoTracking()).Include(x => x.Supplier).Include(x => x.Branch).OrderByDescending(x => x.InvoiceDate).Take(500).ToListAsync(ct);
        return Ok(rows.Select(x => new SupplierInvoiceResponse(x.Id, x.SupplierId, x.Supplier?.Name ?? "", x.InvoiceNumber, x.InvoiceDate, x.DueAt, x.Total, x.PaidAmount, Math.Max(0m, x.Total - x.PaidAmount), x.Status, x.Notes, x.BranchId ?? x.PurchaseOrder?.BranchId, x.Branch?.Name ?? x.PurchaseOrder?.Branch?.Name)).ToList());
    }

    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers(CancellationToken ct) { if (!Can(AppPermissions.FinancePayablesManage)) return Forbid(); var query = db.Suppliers.AsNoTracking().Where(x => x.IsActive); if (IsBranchScoped && ActorBranchId is Guid branchId) query = query.Where(x => db.PurchaseOrders.Any(order => order.SupplierId == x.Id && order.BranchId == branchId) || db.SupplierInvoices.Any(i => i.SupplierId == x.Id && (i.BranchId == branchId || i.BranchId == null && i.PurchaseOrder != null && i.PurchaseOrder.BranchId == branchId)) || db.SupplierPayments.Any(p => p.SupplierId == x.Id && p.BranchId == branchId)); else if (IsBranchScoped) query = query.Where(_ => false); return Ok(await query.OrderBy(x => x.Name).Select(x => new { id = x.Id, name = x.Name }).ToListAsync(ct)); }

    [HttpPost("supplier-invoices")]
    public async Task<ActionResult<SupplierInvoiceResponse>> CreateSupplierInvoice(SupplierInvoiceInput request, CancellationToken ct)
    {
        if (IsBranchScoped && !ActorBranchId.HasValue) return Forbid();
        if (!Can(AppPermissions.FinancePayablesManage)) return Forbid(); var branchId = IsBranchScoped ? ActorBranchId : request.BranchId; if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." }); var supplier = await db.Suppliers.SingleOrDefaultAsync(x => x.Id == request.SupplierId && x.IsActive, ct); if (supplier is null) return NotFound(new { message = "The supplier could not be found." }); if (string.IsNullOrWhiteSpace(request.InvoiceNumber) || request.Subtotal < 0 || request.TaxAmount < 0) return BadRequest(new { message = "Supplier invoice details are invalid." }); var item = new SupplierInvoice { SupplierId = supplier.Id, BranchId = branchId, InvoiceNumber = request.InvoiceNumber.Trim(), InvoiceDate = request.InvoiceDate == default ? ApplicationTime.NepalNow : request.InvoiceDate, DueAt = request.DueAt, Subtotal = request.Subtotal, TaxAmount = request.TaxAmount, Total = request.Subtotal + request.TaxAmount, Notes = request.Notes?.Trim() }; db.SupplierInvoices.Add(item); await db.SaveChangesAsync(ct); return Ok(new SupplierInvoiceResponse(item.Id, supplier.Id, supplier.Name, item.InvoiceNumber, item.InvoiceDate, item.DueAt, item.Total, 0, item.Total, item.Status, item.Notes, item.BranchId, branchId.HasValue ? await db.Branches.Where(x => x.Id == branchId.Value).Select(x => x.Name).FirstOrDefaultAsync(ct) : null));
    }

    [HttpGet("expenses")]
    public async Task<ActionResult<IReadOnlyList<ExpenseResponse>>> Expenses(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.ExpensesManage)) return Forbid();
        var (start, end) = Range(from, to);
        var rows = await ScopeExpenses(db.BusinessExpenses.AsNoTracking()).Include(x => x.Branch).Where(x => x.ExpenseDate >= start && x.ExpenseDate < end).OrderByDescending(x => x.ExpenseDate).Take(500).ToListAsync(ct);
        return Ok(rows.Select(x => new ExpenseResponse(x.Id, x.Category, x.Description, x.Amount, x.ExpenseDate, x.PaymentMethod, x.Reference, x.Status, x.BranchId, x.Branch?.Name)).ToList());
    }

    [HttpPost("expenses")]
    public async Task<ActionResult<ExpenseResponse>> CreateExpense(ExpenseInput request, CancellationToken ct)
    {
        if (!Can(AppPermissions.ExpensesManage)) return Forbid();
        if (IsBranchScoped && !ActorBranchId.HasValue) return Forbid();
        var branchId = IsBranchScoped ? ActorBranchId : request.BranchId;
        if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." });
        if (string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Description) || request.Amount <= 0) return BadRequest(new { message = "Category, description, and a positive amount are required." });
        var item = new BusinessExpense { BranchId = branchId, Category = request.Category.Trim(), Description = request.Description.Trim(), Amount = request.Amount, ExpenseDate = request.ExpenseDate == default ? ApplicationTime.NepalNow : request.ExpenseDate, PaymentMethod = request.PaymentMethod.Trim().ToUpperInvariant(), Reference = request.Reference?.Trim(), Notes = request.Notes?.Trim() };
        db.BusinessExpenses.Add(item); await db.SaveChangesAsync(ct);
        var branchName = branchId.HasValue ? await db.Branches.Where(x => x.Id == branchId.Value).Select(x => x.Name).FirstOrDefaultAsync(ct) : null;
        return Ok(new ExpenseResponse(item.Id, item.Category, item.Description, item.Amount, item.ExpenseDate, item.PaymentMethod, item.Reference, item.Status, item.BranchId, branchName));
    }

    [HttpGet("reconciliation")]
    public async Task<ActionResult<IReadOnlyList<ReconciliationResponse>>> Reconciliation(CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceReconciliationManage)) return Forbid();
        var rows = await ScopeReconciliations(db.BankReconciliations.AsNoTracking()).Include(x => x.Branch).OrderByDescending(x => x.StatementDate).Take(500).ToListAsync(ct);
        return Ok(rows.Select(x => new ReconciliationResponse(x.Id, x.StatementDate, x.BankAccount, x.TransactionType, x.Amount, x.Reference, x.Status, x.MatchedSource, x.Notes, x.BranchId, x.Branch?.Name)).ToList());
    }

    [HttpPost("reconciliation")]
    public async Task<ActionResult<ReconciliationResponse>> AddReconciliation(ReconciliationInput request, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceReconciliationManage)) return Forbid();
        if (IsBranchScoped && !ActorBranchId.HasValue) return Forbid();
        var branchId = IsBranchScoped ? ActorBranchId : request.BranchId;
        if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." });
        if (request.Amount <= 0 || string.IsNullOrWhiteSpace(request.BankAccount) || string.IsNullOrWhiteSpace(request.Reference)) return BadRequest(new { message = "Bank account, reference, and a positive amount are required." });
        var item = new BankReconciliation { BranchId = branchId, StatementDate = request.StatementDate == default ? ApplicationTime.NepalNow : request.StatementDate, BankAccount = request.BankAccount.Trim(), TransactionType = request.TransactionType.Trim().ToUpperInvariant(), Amount = request.Amount, Reference = request.Reference.Trim(), Notes = request.Notes?.Trim() };
        db.BankReconciliations.Add(item); await db.SaveChangesAsync(ct);
        var branchName = branchId.HasValue ? await db.Branches.Where(x => x.Id == branchId.Value).Select(x => x.Name).FirstOrDefaultAsync(ct) : null;
        return Ok(new ReconciliationResponse(item.Id, item.StatementDate, item.BankAccount, item.TransactionType, item.Amount, item.Reference, item.Status, item.MatchedSource, item.Notes, item.BranchId, branchName));
    }

    [HttpPut("reconciliation/{id:guid}/match")]
    public async Task<IActionResult> MatchReconciliation(Guid id, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceReconciliationManage)) return Forbid();
        var item = await ScopeReconciliations(db.BankReconciliations).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.Status = "MATCHED"; item.UpdatedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpGet("tax-settings")]
    public async Task<ActionResult<TaxSettingsResponse>> TaxSettings(CancellationToken ct) { if (!Can(AppPermissions.FinanceTaxManage)) return Forbid(); var item = await db.TaxConfigurations.AsNoTracking().Where(x => x.IsActive).OrderByDescending(x => x.EffectiveFrom).FirstOrDefaultAsync(ct); return Ok(item is null ? new TaxSettingsResponse(Guid.Empty, "Nepal VAT", 13m, ApplicationTime.NepalNow.Date, true) : new TaxSettingsResponse(item.Id, item.Name, item.VatRate, item.EffectiveFrom, item.IsActive)); }

    [HttpPut("tax-settings")]
    public async Task<ActionResult<TaxSettingsResponse>> SaveTaxSettings(TaxSettingsInput request, CancellationToken ct) { if (!Can(AppPermissions.FinanceTaxManage)) return Forbid(); if (request.VatRate < 0 || request.VatRate > 100 || string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Enter a valid VAT rate between 0 and 100." }); var current = await db.TaxConfigurations.Where(x => x.IsActive).ToListAsync(ct); current.ForEach(x => x.IsActive = false); var item = new TaxConfiguration { Name = request.Name.Trim(), VatRate = request.VatRate, EffectiveFrom = request.EffectiveFrom == default ? ApplicationTime.NepalNow : request.EffectiveFrom }; db.TaxConfigurations.Add(item); await db.SaveChangesAsync(ct); return Ok(new TaxSettingsResponse(item.Id, item.Name, item.VatRate, item.EffectiveFrom, item.IsActive)); }

    [HttpGet("journal")]
    public async Task<ActionResult<IReadOnlyList<JournalEntryResponse>>> Journal(DateTime? from, DateTime? to, string? status, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceInvoicesView)) return Forbid(); var (start, end) = Range(from, to); var query = ScopeJournal(db.JournalEntries.AsNoTracking()).Include(x => x.Branch).Where(x => x.EntryDate >= start && x.EntryDate < end); if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.ToUpperInvariant()); var rows = await query.OrderByDescending(x => x.EntryDate).Take(500).ToListAsync(ct); return Ok(rows.Select(JournalRow).ToList());
    }

    [HttpPost("journal")]
    public async Task<ActionResult<JournalEntryResponse>> CreateJournal(JournalEntryInput request, CancellationToken ct)
    {
        if (IsBranchScoped && !ActorBranchId.HasValue) return Forbid();
        if (!Can(AppPermissions.FinanceInvoicesManage)) return Forbid(); var branchId = IsBranchScoped ? ActorBranchId : request.BranchId; if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId.Value && x.IsActive, ct)) return BadRequest(new { message = "The selected branch is not active." }); if (request.Amount <= 0 || string.IsNullOrWhiteSpace(request.Reference) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.DebitAccount) || string.IsNullOrWhiteSpace(request.CreditAccount) || request.DebitAccount.Trim().Equals(request.CreditAccount.Trim(), StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Enter two different accounts and a positive amount." }); var item = new JournalEntry { BranchId = branchId, EntryDate = request.EntryDate == default ? ApplicationTime.NepalNow : request.EntryDate, Reference = request.Reference.Trim(), Description = request.Description.Trim(), DebitAccount = request.DebitAccount.Trim(), CreditAccount = request.CreditAccount.Trim(), Amount = request.Amount, Notes = request.Notes?.Trim() }; db.JournalEntries.Add(item); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ACCOUNTING_JOURNAL_POSTED", EntityType = "JournalEntry", EntityId = item.Id.ToString(), NewValue = item.Reference }); await db.SaveChangesAsync(ct); if (branchId.HasValue) item.Branch = await db.Branches.FindAsync([branchId.Value], ct); return Ok(JournalRow(item));
    }

    [HttpGet("accounting-summary")]
    public async Task<ActionResult<AccountingSummaryResponse>> AccountingSummary(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.FinanceInvoicesView)) return Forbid(); var (start, end) = Range(from, to); var balances = new Dictionary<string, (decimal Debit, decimal Credit)>(StringComparer.OrdinalIgnoreCase); void Add(string account, decimal debit, decimal credit) { balances.TryGetValue(account, out var value); balances[account] = (value.Debit + debit, value.Credit + credit); }
        var invoices = await ScopeInvoices(db.Invoices.AsNoTracking()).Where(x => x.IssuedAt >= start && x.IssuedAt < end).ToListAsync(ct); foreach (var x in invoices) { Add("Accounts Receivable", x.Total, 0); Add("Sales Revenue", 0, x.Total - x.TaxAmount); Add("VAT Payable", 0, x.TaxAmount); }
        var payments = await ScopePayments(db.AccountantPayments.AsNoTracking()).Where(x => x.PaymentDate >= start && x.PaymentDate < end && x.Status == "CLEARED").ToListAsync(ct); foreach (var x in payments) { Add(x.Method == "CASH" ? "Cash" : x.Method == "CHEQUE" ? "Cheques in Hand" : "Bank", x.Amount, 0); if (x.InvoiceId.HasValue) Add("Accounts Receivable", 0, x.Amount); else Add("Accounts Payable", 0, x.Amount); }
        var expenses = await ScopeExpenses(db.BusinessExpenses.AsNoTracking()).Where(x => x.ExpenseDate >= start && x.ExpenseDate < end).ToListAsync(ct); foreach (var x in expenses) { Add(x.Category, x.Amount, 0); Add(x.PaymentMethod == "CASH" ? "Cash" : "Bank", 0, x.Amount); }
        var supplierRows = await ScopeSupplierInvoices(db.SupplierInvoices.AsNoTracking()).Where(x => x.InvoiceDate >= start && x.InvoiceDate < end).ToListAsync(ct); foreach (var x in supplierRows) { Add("Purchases / Inventory", x.Total, 0); Add("Accounts Payable", 0, x.Total); }
        var journalRows = await ScopeJournal(db.JournalEntries.AsNoTracking()).Where(x => x.EntryDate >= start && x.EntryDate < end && x.Status == "POSTED").ToListAsync(ct); foreach (var x in journalRows) Add(x.DebitAccount, x.Amount, 0); foreach (var x in journalRows) Add(x.CreditAccount, 0, x.Amount);
        var openingQuery = db.AccountOpeningBalances.AsNoTracking().Include(x => x.Account).Where(x => x.OpeningDate < end);
        if (IsBranchScoped && ActorBranchId is Guid openingBranch) openingQuery = openingQuery.Where(x => x.BranchId == openingBranch);
        else if (IsBranchScoped) openingQuery = openingQuery.Where(_ => false);
        var openingRows = await openingQuery.ToListAsync(ct);
        foreach (var x in openingRows)
        {
            var account = $"{x.Account!.Code} - {x.Account.Name}";
            if (x.DebitAmount > 0) { Add(account, x.DebitAmount, 0); Add("Opening Balance Equity", 0, x.DebitAmount); }
            if (x.CreditAmount > 0) { Add(account, 0, x.CreditAmount); Add("Opening Balance Equity", x.CreditAmount, 0); }
        }
        var trial = balances.Select(x => new AccountBalanceResponse(x.Key, x.Value.Debit, x.Value.Credit, x.Value.Debit - x.Value.Credit)).OrderBy(x => x.Account).ToList(); var revenue = invoices.Sum(x => x.Subtotal); var expenseTotal = expenses.Sum(x => x.Amount); return Ok(new AccountingSummaryResponse(trial, revenue, expenseTotal, revenue - expenseTotal, invoices.Sum(x => Math.Max(0m, x.Total - x.PaidAmount)), supplierRows.Sum(x => Math.Max(0m, x.Total - x.PaidAmount)), payments.Where(x => x.InvoiceId != null).Sum(x => x.Amount) - expenseTotal, journalRows.Count));
    }

    [HttpGet("reports/{type}")]
    public async Task<IActionResult> Report(string type, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!Can(AppPermissions.ReportsView)) return Forbid(); var (start, end) = Range(from, to); var csv = new StringBuilder(); csv.AppendLine("Report,Date range"); csv.AppendLine($"{type},{start:yyyy-MM-dd} to {end.AddDays(-1):yyyy-MM-dd}");
        if (type.Equals("receivables", StringComparison.OrdinalIgnoreCase)) { csv.AppendLine("Invoice,Customer,Total,Paid,Outstanding,Status"); var rows = await ScopeInvoices(db.Invoices.AsNoTracking()).Include(x => x.Order).ThenInclude(x => x!.Customer).Where(x => x.Total > x.PaidAmount).OrderByDescending(x => x.IssuedAt).ToListAsync(ct); foreach (var x in rows) csv.AppendLine($"{x.InvoiceNumber},{Csv(x.Order?.Customer?.FullName)},{x.Total},{x.PaidAmount},{x.Total - x.PaidAmount},{x.PaymentStatus}"); }
        else if (type.Equals("expenses", StringComparison.OrdinalIgnoreCase)) { csv.AppendLine("Date,Category,Description,Amount,Method"); var rows = await ScopeExpenses(db.BusinessExpenses.AsNoTracking()).Where(x => x.ExpenseDate >= start && x.ExpenseDate < end).ToListAsync(ct); foreach (var x in rows) csv.AppendLine($"{x.ExpenseDate:yyyy-MM-dd},{Csv(x.Category)},{Csv(x.Description)},{x.Amount},{x.PaymentMethod}"); }
        else { csv.AppendLine("Invoice,Customer,Subtotal,VAT,Total,Paid,Status"); var rows = await ScopeInvoices(db.Invoices.AsNoTracking()).Include(x => x.Order).ThenInclude(x => x!.Customer).Where(x => x.IssuedAt >= start && x.IssuedAt < end).ToListAsync(ct); foreach (var x in rows) csv.AppendLine($"{x.InvoiceNumber},{Csv(x.Order?.Customer?.FullName)},{x.Subtotal},{x.TaxAmount},{x.Total},{x.PaidAmount},{x.PaymentStatus}"); }
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"{type}-{start:yyyyMMdd}.csv");
    }

    private static (DateTime Start, DateTime End) Range(DateTime? from, DateTime? to) { var now = ApplicationTime.NepalNow; var start = (from ?? new DateTime(now.Year, now.Month, 1)).Date; var end = (to ?? start.AddMonths(1).AddDays(-1)).Date.AddDays(1); return (start, end); }
    private static string PaymentStatus(decimal total, decimal paid) => paid <= 0 ? "UNPAID" : paid + 0.01m >= total ? "PAID" : "PARTIAL";
    private static AccountantInvoiceResponse InvoiceRow(Invoice x) => new(x.Id, x.InvoiceNumber, x.OrderId, x.Order?.OrderNumber ?? "", x.Order?.CustomerId ?? Guid.Empty, x.Order?.Customer?.FullName ?? "", x.Subtotal, x.TaxAmount, x.Total, x.PaidAmount, Math.Max(0m, x.Total - x.PaidAmount), PaymentStatus(x.Total, x.PaidAmount), x.IssuedAt, x.DueAt);
    private static JournalEntryResponse JournalRow(JournalEntry x) => new(x.Id, x.EntryDate, x.Reference, x.Description, x.DebitAccount, x.CreditAccount, x.Amount, x.Status, x.BranchId, x.Branch?.Name);
    private static string Csv(string? value) => $"\"{(value ?? "").Replace("\"", "\"\"")}\"";
}
