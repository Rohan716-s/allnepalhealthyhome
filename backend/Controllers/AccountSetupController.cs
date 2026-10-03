using System.Security.Claims;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/superadmin/account-setup")]
[Route("api/admin/account-setup")]
public sealed class AccountSetupController(ApplicationDbContext db) : ControllerBase
{
    private bool CanManage => User.IsStaffRole(StaffRoles.SuperAdmin) ||
        User.IsStaffRole(StaffRoles.Admin) && User.HasStaffPermission(AppPermissions.CatalogManage);
    private Guid? ActorBranchId => Guid.TryParse(User.FindFirstValue("branch_id"), out var id) ? id : null;
    private bool IsBranchScoped => !User.IsStaffRole(StaffRoles.SuperAdmin) && (ActorBranchId.HasValue || User.IsStaffRole(StaffRoles.Supervisor, StaffRoles.Pharmacist, StaffRoles.Delivery, StaffRoles.SalesExecutive));
    private Guid ActorId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private string ActorRole => User.FindFirstValue(ClaimTypes.Role) ?? "STAFF";
    private IQueryable<Customer> ScopeCustomers(IQueryable<Customer> query) => !IsBranchScoped ? query : ActorBranchId is Guid branchId
        ? query.Where(x => db.Orders.Any(o => o.CustomerId == x.Id && o.BranchId == branchId) || db.CustomerPayments.Any(p => p.CustomerId == x.Id && p.BranchId == branchId))
        : query.Where(_ => false);

    [HttpGet("party-sectors")]
    public async Task<IActionResult> PartySectors(CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var customers = ScopeCustomers(db.Customers.AsNoTracking());
        return Ok(await db.PartySectors.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Code, x.Description, x.IsActive, customerCount = customers.Count(customer => customer.PartySectorId == x.Id) })
            .ToListAsync(ct));
    }

    [HttpPost("party-sectors")]
    public async Task<IActionResult> CreatePartySector(PartySectorInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var validation = ValidateSector(input);
        if (validation is not null) return BadRequest(new { message = validation });
        var name = input.Name.Trim();
        if (await db.PartySectors.AnyAsync(x => x.Name.ToLower() == name.ToLower(), ct))
            return Conflict(new { message = "A party sector with this name already exists." });
        var item = new PartySector { Name = name, Code = Clean(input.Code), Description = Clean(input.Description), IsActive = input.IsActive };
        db.PartySectors.Add(item);
        AddAudit("PARTY_SECTOR_CREATED", nameof(PartySector), item.Id, item.Name);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Name, item.Code, item.Description, item.IsActive, customerCount = 0 });
    }

    [HttpPut("party-sectors/{id:guid}")]
    public async Task<IActionResult> UpdatePartySector(Guid id, PartySectorInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var validation = ValidateSector(input);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.PartySectors.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var name = input.Name.Trim();
        if (await db.PartySectors.AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower(), ct))
            return Conflict(new { message = "A party sector with this name already exists." });
        item.Name = name;
        item.Code = Clean(input.Code);
        item.Description = Clean(input.Description);
        item.IsActive = input.IsActive;
        item.UpdatedAt = DateTime.UtcNow;
        AddAudit("PARTY_SECTOR_UPDATED", nameof(PartySector), item.Id, item.Name);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("parties")]
    public async Task<IActionResult> Parties(string? search, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var query = ScopeCustomers(db.Customers.AsNoTracking()).Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.FullName.Contains(term) || x.Email.Contains(term) || x.Phone.Contains(term));
        }
        return Ok(await query.OrderBy(x => x.FullName).Take(500)
            .Select(x => new { id = x.Id, name = x.FullName, email = x.Email, phone = x.Phone, accountType = x.AccountType, partySectorId = x.PartySectorId, partySectorName = x.PartySector == null ? null : x.PartySector.Name })
            .ToListAsync(ct));
    }

    [HttpPut("parties/{customerId:guid}/sector")]
    public async Task<IActionResult> AssignPartySector(Guid customerId, PartySectorAssignmentInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var customer = await ScopeCustomers(db.Customers).SingleOrDefaultAsync(x => x.Id == customerId, ct);
        if (customer is null) return NotFound(new { message = "The party could not be found." });
        if (input.PartySectorId.HasValue && !await db.PartySectors.AnyAsync(x => x.Id == input.PartySectorId.Value && x.IsActive, ct))
            return BadRequest(new { message = "Choose an active party sector." });
        customer.PartySectorId = input.PartySectorId;
        customer.UpdatedAt = DateTime.UtcNow;
        AddAudit("CUSTOMER_PARTY_SECTOR_ASSIGNED", nameof(Customer), customer.Id, input.PartySectorId?.ToString() ?? "Unassigned");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("chart-of-accounts")]
    public async Task<IActionResult> ChartOfAccounts(bool includeInactive = false, CancellationToken ct = default)
    {
        if (!CanManage) return Forbid();
        var query = db.ChartAccounts.AsNoTracking();
        if (!includeInactive) query = query.Where(x => x.IsActive);
        var rows = await query.OrderBy(x => x.Code).Select(x => new
        {
            x.Id, x.Code, x.Name, x.AccountType, x.ParentAccountId,
            parentName = x.ParentAccount == null ? null : x.ParentAccount.Name,
            x.IsSubLedger, x.IsActive,
            openingDebit = x.OpeningBalances.Where(b => !IsBranchScoped || ActorBranchId.HasValue && b.BranchId == ActorBranchId).Sum(b => (decimal?)b.DebitAmount) ?? 0m,
            openingCredit = x.OpeningBalances.Where(b => !IsBranchScoped || ActorBranchId.HasValue && b.BranchId == ActorBranchId).Sum(b => (decimal?)b.CreditAmount) ?? 0m,
        }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("chart-of-accounts")]
    public async Task<IActionResult> CreateChartAccount(ChartAccountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var validation = await ValidateAccount(input, null, ct);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = new ChartAccount { Code = input.Code.Trim(), Name = input.Name.Trim(), AccountType = input.AccountType.Trim().ToUpperInvariant(), ParentAccountId = input.ParentAccountId, IsSubLedger = input.IsSubLedger, IsActive = input.IsActive };
        db.ChartAccounts.Add(item);
        AddAudit("CHART_ACCOUNT_CREATED", nameof(ChartAccount), item.Id, item.Code);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Code, item.Name, item.AccountType, item.ParentAccountId, parentName = (string?)null, item.IsSubLedger, item.IsActive, openingDebit = 0m, openingCredit = 0m });
    }

    [HttpPut("chart-of-accounts/{id:guid}")]
    public async Task<IActionResult> UpdateChartAccount(Guid id, ChartAccountInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var item = await db.ChartAccounts.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var validation = await ValidateAccount(input, id, ct);
        if (validation is not null) return BadRequest(new { message = validation });
        item.Code = input.Code.Trim(); item.Name = input.Name.Trim(); item.AccountType = input.AccountType.Trim().ToUpperInvariant(); item.ParentAccountId = input.ParentAccountId; item.IsSubLedger = input.IsSubLedger; item.IsActive = input.IsActive; item.UpdatedAt = DateTime.UtcNow;
        AddAudit("CHART_ACCOUNT_UPDATED", nameof(ChartAccount), item.Id, item.Code);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("opening-balances")]
    public async Task<IActionResult> OpeningBalances(DateOnly? asOf, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        var query = db.AccountOpeningBalances.AsNoTracking().Include(x => x.Account).Include(x => x.Branch).AsQueryable();
        if (IsBranchScoped && ActorBranchId is Guid branchId) query = query.Where(x => x.BranchId == branchId);
        else if (IsBranchScoped) query = query.Where(_ => false);
        if (asOf.HasValue) query = query.Where(x => x.OpeningDate <= asOf.Value.ToDateTime(TimeOnly.MaxValue));
        var rows = await query.OrderByDescending(x => x.OpeningDate).ThenBy(x => x.Account!.Code).Take(1000).ToListAsync(ct);
        return Ok(rows.Select(x => new { x.Id, x.AccountId, accountCode = x.Account!.Code, accountName = x.Account.Name, x.BranchId, branchName = x.Branch == null ? "All branches" : x.Branch.Name, x.OpeningDate, x.DebitAmount, x.CreditAmount, x.Reference, x.Notes }));
    }

    [HttpPost("opening-balances")]
    public async Task<IActionResult> CreateOpeningBalance(OpeningBalanceInput input, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (IsBranchScoped && (!ActorBranchId.HasValue || input.BranchId.HasValue && input.BranchId != ActorBranchId)) return Forbid();
        var branchId = IsBranchScoped ? ActorBranchId : input.BranchId;
        var debit = Math.Round(input.DebitAmount, 2);
        var credit = Math.Round(input.CreditAmount, 2);
        if (debit < 0 || credit < 0 || (debit > 0) == (credit > 0) || string.IsNullOrWhiteSpace(input.Reference))
            return BadRequest(new { message = "Enter a reference and exactly one positive debit or credit amount." });
        var account = await db.ChartAccounts.SingleOrDefaultAsync(x => x.Id == input.AccountId && x.IsActive, ct);
        if (account is null) return BadRequest(new { message = "Choose an active account from the chart of accounts." });
        if (branchId.HasValue && !await db.Branches.AnyAsync(x => x.Id == branchId.Value && x.IsActive, ct))
            return BadRequest(new { message = "The selected branch is not active." });
        var item = new AccountOpeningBalance { AccountId = account.Id, BranchId = branchId, EnteredByStaffUserId = ActorId == Guid.Empty ? null : ActorId, OpeningDate = input.OpeningDate == default ? ApplicationTime.NepalNow.Date : input.OpeningDate.Date, DebitAmount = debit, CreditAmount = credit, Reference = input.Reference.Trim(), Notes = Clean(input.Notes) };
        db.AccountOpeningBalances.Add(item);
        AddAudit("ACCOUNT_OPENING_BALANCE_POSTED", nameof(AccountOpeningBalance), item.Id, $"{account.Code} {debit:0.00}/{credit:0.00}");
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.AccountId, accountCode = account.Code, accountName = account.Name, item.BranchId, branchName = (string?)null, item.OpeningDate, item.DebitAmount, item.CreditAmount, item.Reference, item.Notes });
    }

    private async Task<string?> ValidateAccount(ChartAccountInput input, Guid? currentId, CancellationToken ct)
    {
        var accountTypes = new[] { "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE" };
        if (string.IsNullOrWhiteSpace(input.Code) || input.Code.Length > 40 || string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 160)
            return "Account code (up to 40 characters) and name (up to 160 characters) are required.";
        if (!accountTypes.Contains(input.AccountType.Trim().ToUpperInvariant())) return "Choose an account type: Asset, Liability, Equity, Income, or Expense.";
        var code = input.Code.Trim();
        if (await db.ChartAccounts.AnyAsync(x => x.Id != currentId && x.Code.ToLower() == code.ToLower(), ct)) return "That account code is already in use.";
        if (input.ParentAccountId.HasValue)
        {
            if (input.ParentAccountId == currentId || !await db.ChartAccounts.AnyAsync(x => x.Id == input.ParentAccountId && x.IsActive, ct)) return "Choose an active parent account other than this account.";
            var visited = new HashSet<Guid>();
            var parentId = input.ParentAccountId;
            while (parentId.HasValue && visited.Add(parentId.Value))
            {
                if (parentId == currentId) return "An account cannot be placed beneath one of its own descendants.";
                parentId = await db.ChartAccounts.Where(x => x.Id == parentId.Value).Select(x => x.ParentAccountId).FirstOrDefaultAsync(ct);
            }
        }
        return null;
    }

    private static string? ValidateSector(PartySectorInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 120) return "Sector name is required and must be 120 characters or fewer.";
        if (input.Code?.Length > 40 || input.Description?.Length > 500) return "Sector code or description is too long.";
        return null;
    }

    private void AddAudit(string action, string entityType, Guid entityId, string value) => db.ActivityLogs.Add(new ActivityLog { ActorId = ActorId, ActorRole = ActorRole, Action = action, EntityType = entityType, EntityId = entityId.ToString(), NewValue = value });
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public sealed record PartySectorInput(string Name, string? Code, string? Description, bool IsActive);
    public sealed record PartySectorAssignmentInput(Guid? PartySectorId);
    public sealed record ChartAccountInput(string Code, string Name, string AccountType, Guid? ParentAccountId, bool IsSubLedger, bool IsActive);
    public sealed record OpeningBalanceInput(Guid AccountId, Guid? BranchId, DateTime OpeningDate, decimal DebitAmount, decimal CreditAmount, string Reference, string? Notes);
}
