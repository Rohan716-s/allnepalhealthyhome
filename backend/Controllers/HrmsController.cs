using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/hrms")]
public sealed class HrmsController(ApplicationDbContext db) : ControllerBase
{
    private Guid StaffId => User.TryGetStaffId(out var id) ? id : Guid.Empty;
    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
    private bool IsStaff => StaffId != Guid.Empty;
    private bool IsManager => User.IsStaffRole(StaffRoles.Admin, StaffRoles.Supervisor, StaffRoles.SuperAdmin);
    private bool CanManageHrRecords => User.IsStaffRole(StaffRoles.Admin, StaffRoles.SuperAdmin);
    private bool CanHrmsView => IsManager || User.HasStaffPermission(AppPermissions.HrmsView);
    private bool CanHrmsManage => User.IsStaffRole(StaffRoles.Admin, StaffRoles.SuperAdmin) || User.HasStaffPermission(AppPermissions.HrmsManage);
    private bool CanHrSettingsManage => User.IsStaffRole(StaffRoles.Admin, StaffRoles.SuperAdmin) || User.HasStaffPermission(AppPermissions.HrSettingsManage);
    private bool CanAccountsView => IsManager || User.HasStaffPermission(AppPermissions.AccountsView);
    private bool CanPayrollView => CanAccountsView && (IsManager || User.HasStaffPermission(AppPermissions.PayrollView));
    private bool CanPayrollManage => User.IsStaffRole(StaffRoles.Admin, StaffRoles.SuperAdmin) || User.HasStaffPermission(AppPermissions.PayrollManage);
    private static readonly HashSet<string> SetupCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "DEPARTMENT", "JOB_TITLE", "APPOINTMENT_TYPE", "EMPLOYEE_STATUS", "LEAVE_TYPE",
        "SALARY_COMPONENT", "SALARY_DEDUCTION", "EMPLOYEE_FUND", "COMPETENCY",
        "PERFORMANCE_LEVEL", "APPRAISAL_TEMPLATE", "APPRAISAL_TOPIC", "SUBJECT_TEMPLATE",
        "ORGANOGRAM"
    };
    private static readonly HashSet<string> OfficeCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "NOTICE", "DOCUMENT", "OFFICIAL_VISIT", "WORK_LOG", "APPRAISAL", "CALENDAR_EVENT"
    };

    [HttpGet("attendance/today")]
    public async Task<ActionResult<AttendanceRecordResponse?>> Today(CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var item = await db.AttendanceRecords.AsNoTracking().Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.StaffUserId == StaffId && x.WorkDate == today, ct);
        return Ok(item is null ? null : Row(item));
    }

    [HttpGet("attendance/history")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecordResponse>>> History(DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var start = (from ?? ApplicationTime.NepalNow.Date.AddDays(-30)).Date;
        var end = (to ?? ApplicationTime.NepalNow.Date).Date;
        if (end < start || (end - start).TotalDays > 366) return BadRequest(new { message = "Choose a valid attendance date range of up to one year." });
        var query = db.AttendanceRecords.AsNoTracking().Include(x => x.StaffUser).Where(x => x.StaffUserId == StaffId && x.WorkDate >= start && x.WorkDate <= end);
        return Ok((await query.OrderByDescending(x => x.WorkDate).ToListAsync(ct)).Select(Row).ToList());
    }

    [HttpPost("attendance/check-in")]
    public async Task<ActionResult<AttendanceRecordResponse>> CheckIn([FromBody] AttendanceLocationInput? request, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var now = ApplicationTime.NepalNow;
        var today = now.Date;
        var staff = await db.StaffUsers.Include(x => x.Branch).Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == StaffId && x.IsActive, ct);
        if (staff is null) return Unauthorized();
        var settings = await db.AttendanceSettings.AsNoTracking().OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        var location = ValidateLocation(request, staff.Branch, settings);
        if (location.Required && !location.HasCoordinates) return BadRequest(new { message = "Location access is required to check in. Allow location access and try again." });
        if (location.Blocked) return BadRequest(new { message = "You are outside the allowed branch area. Move closer to the branch and try again." });
        var current = await db.AttendanceRecords.Include(x => x.StaffUser).Include(x => x.Shift).SingleOrDefaultAsync(x => x.StaffUserId == StaffId && x.WorkDate == today, ct);
        if (current?.CheckInUtc is not null) return Conflict(new { message = "You have already checked in today." });
        var shift = staff.Shift ?? await db.WorkShifts.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).FirstOrDefaultAsync(ct);
        var grace = shift?.GracePeriodMinutes ?? settings?.LateCheckInGraceMinutes ?? 15;
        var scheduled = now.Date + (shift?.StartTime.ToTimeSpan() ?? new TimeSpan(9, 0, 0));
        var lateMinutes = Math.Max(0, (int)Math.Floor((now - scheduled).TotalMinutes) - grace);
        var isNew = current is null;
        current ??= new AttendanceRecord { StaffUserId = StaffId, WorkDate = today };
        current.CheckInUtc = DateTime.UtcNow;
        current.Status = lateMinutes >= (shift?.LateThresholdMinutes ?? 1) ? AttendanceStatuses.Late : AttendanceStatuses.Present;
        current.LateMinutes = lateMinutes;
        current.ShiftId = shift?.Id;
        current.CheckInLatitude = request?.Latitude;
        current.CheckInLongitude = request?.Longitude;
        current.CheckInAccuracy = request?.Accuracy;
        current.CheckInLocationTimestampUtc = DateTime.UtcNow;
        current.CheckInLocationStatus = location.Status;
        current.CheckInLocationSource = request?.LocationSource?.Trim() is { Length: > 0 } source ? source[..Math.Min(source.Length, 40)] : "BROWSER";
        current.UpdatedAt = DateTime.UtcNow;
        if (isNew) db.AttendanceRecords.Add(current);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_CHECK_IN", EntityType = "AttendanceRecord", EntityId = current.Id.ToString(), NewValue = $"{current.CheckInUtc:O}; location={location.Status}; lateMinutes={lateMinutes}" });
        // SaveChanges uses an implicit transaction for this single unit of work.
        // Do not wrap it in BeginTransactionAsync: the DbContext uses MySQL's
        // retrying execution strategy, which rejects user-created transactions.
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Conflict(new { message = "This attendance action was already recorded. Refresh and try again." }); }
        current.StaffUser = staff; current.Shift = shift;
        return Ok(Row(current));
    }

    [HttpPost("attendance/check-out")]
    public async Task<ActionResult<AttendanceRecordResponse>> CheckOut([FromBody] AttendanceLocationInput? request, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var staff = await db.StaffUsers.Include(x => x.Branch).Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == StaffId && x.IsActive, ct);
        if (staff is null) return Unauthorized();
        var settings = await db.AttendanceSettings.AsNoTracking().OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        var location = ValidateLocation(request, staff.Branch, settings);
        if (location.Required && !location.HasCoordinates) return BadRequest(new { message = "Location access is required to check out. Allow location access and try again." });
        if (location.Blocked) return BadRequest(new { message = "You are outside the allowed branch area. Move closer to the branch and try again." });
        var current = await db.AttendanceRecords.Include(x => x.StaffUser).Include(x => x.Shift).SingleOrDefaultAsync(x => x.StaffUserId == StaffId && x.WorkDate == today, ct);
        if (current?.CheckInUtc is null) return BadRequest(new { message = "Check in before checking out." });
        if (current.CheckOutUtc is not null) return Conflict(new { message = "You have already checked out today." });
        var checkout = DateTime.UtcNow;
        if (checkout < current.CheckInUtc.Value) return BadRequest(new { message = "The check-out time is invalid." });
        current.CheckOutUtc = checkout;
        var rawMinutes = Math.Max(0, (int)(checkout - current.CheckInUtc.Value).TotalMinutes);
        var breakMinutes = current.Shift?.BreakDurationMinutes ?? 0;
        current.TotalMinutes = Math.Max(0, rawMinutes - breakMinutes);
        current.OvertimeMinutes = Math.Max(0, current.TotalMinutes - (current.Shift?.OvertimeThresholdMinutes ?? 540));
        current.Status = current.TotalMinutes < (current.Shift?.HalfDayThresholdMinutes ?? 270) ? AttendanceStatuses.HalfDay : current.Status == AttendanceStatuses.Late ? AttendanceStatuses.Late : AttendanceStatuses.CheckedOut;
        current.CheckOutLatitude = request?.Latitude;
        current.CheckOutLongitude = request?.Longitude;
        current.CheckOutAccuracy = request?.Accuracy;
        current.CheckOutLocationTimestampUtc = DateTime.UtcNow;
        current.CheckOutLocationStatus = location.Status;
        current.CheckOutLocationSource = request?.LocationSource?.Trim() is { Length: > 0 } source ? source[..Math.Min(source.Length, 40)] : "BROWSER";
        current.IsFinalized = true;
        current.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_CHECK_OUT", EntityType = "AttendanceRecord", EntityId = current.Id.ToString(), NewValue = current.CheckOutUtc.Value.ToString("O") });
        await db.SaveChangesAsync(ct);
        return Ok(Row(current));
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<AttendanceDashboardResponse>> Dashboard(CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var month = new DateTime(today.Year, today.Month, 1);
        var records = await db.AttendanceRecords.AsNoTracking().Include(x => x.StaffUser).Where(x => x.StaffUserId == StaffId && x.WorkDate >= month && x.WorkDate <= today).ToListAsync(ct);
        var item = records.SingleOrDefault(x => x.WorkDate == today);
        return Ok(new AttendanceDashboardResponse(item is null ? null : Row(item), records.Count(x => x.Status is AttendanceStatuses.Present or AttendanceStatuses.CheckedOut), records.Count(x => x.Status == AttendanceStatuses.Late), await db.LeaveRequests.CountAsync(x => x.StaffUserId == StaffId && x.Status == LeaveStatuses.Approved && x.StartDate <= today && x.EndDate >= month, ct), records.Count, records.Sum(x => x.OvertimeMinutes)));
    }

    [HttpGet("dashboard/overview")]
    public async Task<ActionResult<HrmsOverviewResponse>> Overview(CancellationToken ct)
    {
        if (!CanHrmsView) return Forbid();
        var today = ApplicationTime.NepalNow.Date;
        var employees = await db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.Role != "CUSTOMER").ToListAsync(ct);
        var rows = await db.AttendanceRecords.AsNoTracking().Where(x => x.WorkDate == today).ToListAsync(ct);
        var onLeave = await db.LeaveRequests.AsNoTracking().CountAsync(x => x.Status == LeaveStatuses.Approved && x.StartDate <= today && x.EndDate >= today, ct);
        var present = rows.Count(x => x.Status is AttendanceStatuses.Present or AttendanceStatuses.Late or AttendanceStatuses.CheckedOut or AttendanceStatuses.HalfDay);
        var checkedIn = rows.Count(x => x.CheckInUtc.HasValue && !x.CheckOutUtc.HasValue);
        var checkedOut = rows.Count(x => x.CheckOutUtc.HasValue);
        return Ok(new HrmsOverviewResponse(employees.Count, present, rows.Count(x => x.Status == AttendanceStatuses.Late), Math.Max(0, employees.Count - present - onLeave), onLeave, checkedIn, checkedOut, rows.Sum(x => x.OvertimeMinutes), employees.Count == 0 ? 0 : Math.Round((decimal)present / employees.Count * 100, 1)));
    }

    [HttpGet("setup/{category}")]
    public async Task<ActionResult<IReadOnlyList<HrmsSetupItemResponse>>> ListSetup(string category, CancellationToken ct)
    {
        if (!CanHrmsView) return Forbid();
        var normalized = NormalizeSetupCategory(category);
        if (normalized is null) return NotFound();
        var rows = await db.HrmsSetupItems.AsNoTracking()
            .Where(x => x.Category == normalized)
            .OrderBy(x => x.DisplayOrder).ThenBy(x => x.Name)
            .ToListAsync(ct);
        return Ok(rows.Select(SetupRow).ToList());
    }

    [HttpPost("setup/{category}")]
    public async Task<ActionResult<HrmsSetupItemResponse>> CreateSetup(string category, HrmsSetupItemInput request, CancellationToken ct)
    {
        if (!CanHrSettingsManage || !IsStaff) return Forbid();
        var normalized = NormalizeSetupCategory(category);
        var validation = ValidateSetupItem(normalized, request);
        if (validation is not null) return BadRequest(new { message = validation });
        var name = request.Name.Trim();
        if (await db.HrmsSetupItems.AnyAsync(x => x.Category == normalized && x.Name == name, ct))
            return Conflict(new { message = "An item with this name already exists in the selected register." });
        var nextOrder = (await db.HrmsSetupItems.Where(x => x.Category == normalized).MaxAsync(x => (int?)x.DisplayOrder, ct) ?? 0) + 10;
        var item = new HrmsSetupItem
        {
            Category = normalized!, Name = name, Code = Clean(request.Code), Description = Clean(request.Description),
            DisplayOrder = nextOrder, IsActive = request.IsActive
        };
        db.HrmsSetupItems.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "HRMS_SETUP_CREATED", EntityType = "HrmsSetupItem", EntityId = item.Id.ToString(), NewValue = $"{item.Category}; {item.Name}" });
        await db.SaveChangesAsync(ct);
        return Ok(SetupRow(item));
    }

    [HttpPut("setup/{category}/{id:guid}")]
    public async Task<ActionResult<HrmsSetupItemResponse>> UpdateSetup(string category, Guid id, HrmsSetupItemInput request, CancellationToken ct)
    {
        if (!CanHrSettingsManage || !IsStaff) return Forbid();
        var normalized = NormalizeSetupCategory(category);
        var validation = ValidateSetupItem(normalized, request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.HrmsSetupItems.SingleOrDefaultAsync(x => x.Id == id && x.Category == normalized, ct);
        if (item is null) return NotFound();
        var name = request.Name.Trim();
        if (await db.HrmsSetupItems.AnyAsync(x => x.Id != id && x.Category == normalized && x.Name == name, ct))
            return Conflict(new { message = "An item with this name already exists in the selected register." });
        var previous = $"{item.Name}; active={item.IsActive}";
        item.Name = name; item.Code = Clean(request.Code); item.Description = Clean(request.Description); item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "HRMS_SETUP_UPDATED", EntityType = "HrmsSetupItem", EntityId = item.Id.ToString(), PreviousValue = previous, NewValue = $"{item.Name}; active={item.IsActive}" });
        await db.SaveChangesAsync(ct);
        return Ok(SetupRow(item));
    }

    [HttpGet("office/{category}")]
    public async Task<ActionResult<IReadOnlyList<OfficeOperationRecordResponse>>> ListOfficeRecords(string category, CancellationToken ct)
    {
        if (!CanHrmsView || !IsStaff) return Forbid();
        var normalized = NormalizeOfficeCategory(category);
        if (normalized is null) return NotFound();
        var query = db.OfficeOperationRecords.AsNoTracking().Include(x => x.StaffUser)
            .Where(x => x.Category == normalized);
        if (!CanHrmsManage && normalized != "NOTICE") query = query.Where(x => x.StaffUserId == StaffId);
        return Ok((await query.OrderByDescending(x => x.StartsAt ?? x.CreatedAt).ToListAsync(ct)).Select(OfficeRow).ToList());
    }

    [HttpPost("office/{category}")]
    public async Task<ActionResult<OfficeOperationRecordResponse>> CreateOfficeRecord(string category, OfficeOperationRecordInput request, CancellationToken ct)
    {
        if (!CanHrmsManage || !IsStaff) return Forbid();
        var normalized = NormalizeOfficeCategory(category);
        var validation = ValidateOfficeRecord(normalized, request);
        if (validation is not null) return BadRequest(new { message = validation });
        StaffUser? staff = null;
        if (request.StaffUserId.HasValue)
        {
            staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.Role != "CUSTOMER", ct);
            if (staff is null) return BadRequest(new { message = "Choose a valid employee." });
        }
        var item = new OfficeOperationRecord
        {
            Category = normalized!, Title = request.Title.Trim(), Details = Clean(request.Details), Status = request.Status.Trim().ToUpperInvariant(),
            StaffUserId = staff?.Id, StaffUser = staff, StartsAt = request.StartsAt, EndsAt = request.EndsAt,
            Location = Clean(request.Location), Audience = Clean(request.Audience), ReferenceNumber = Clean(request.ReferenceNumber), AttachmentUrl = Clean(request.AttachmentUrl)
        };
        db.OfficeOperationRecords.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "OFFICE_OPERATION_CREATED", EntityType = "OfficeOperationRecord", EntityId = item.Id.ToString(), NewValue = $"{item.Category}; {item.Title}" });
        await db.SaveChangesAsync(ct);
        return Ok(OfficeRow(item));
    }

    [HttpPut("office/{category}/{id:guid}")]
    public async Task<ActionResult<OfficeOperationRecordResponse>> UpdateOfficeRecord(string category, Guid id, OfficeOperationRecordInput request, CancellationToken ct)
    {
        if (!CanHrmsManage || !IsStaff) return Forbid();
        var normalized = NormalizeOfficeCategory(category);
        var validation = ValidateOfficeRecord(normalized, request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.OfficeOperationRecords.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id && x.Category == normalized, ct);
        if (item is null) return NotFound();
        StaffUser? staff = null;
        if (request.StaffUserId.HasValue)
        {
            staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.Role != "CUSTOMER", ct);
            if (staff is null) return BadRequest(new { message = "Choose a valid employee." });
        }
        var previous = $"{item.Title}; {item.Status}";
        item.Title = request.Title.Trim(); item.Details = Clean(request.Details); item.Status = request.Status.Trim().ToUpperInvariant();
        item.StaffUserId = staff?.Id; item.StaffUser = staff; item.StartsAt = request.StartsAt; item.EndsAt = request.EndsAt;
        item.Location = Clean(request.Location); item.Audience = Clean(request.Audience); item.ReferenceNumber = Clean(request.ReferenceNumber); item.AttachmentUrl = Clean(request.AttachmentUrl); item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "OFFICE_OPERATION_UPDATED", EntityType = "OfficeOperationRecord", EntityId = item.Id.ToString(), PreviousValue = previous, NewValue = $"{item.Title}; {item.Status}" });
        await db.SaveChangesAsync(ct);
        return Ok(OfficeRow(item));
    }

    [HttpGet("leave")]
    public async Task<ActionResult<IReadOnlyList<LeaveRequestResponse>>> Leave(CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var query = db.LeaveRequests.AsNoTracking().Include(x => x.StaffUser).AsQueryable();
        if (!CanManageHrRecords) query = query.Where(x => x.StaffUserId == StaffId);
        return Ok((await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(LeaveRow).ToList());
    }

    [HttpPost("leave")]
    public async Task<ActionResult<LeaveRequestResponse>> ApplyLeave(LeaveRequestInput request, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var validation = ValidateLeave(request.LeaveType, request.StartDate, request.EndDate, request.Reason, request.DayType, request.SupportingDocumentUrl);
        if (validation is not null) return BadRequest(new { message = validation });
        var start = request.StartDate.Date; var end = request.EndDate.Date;
        if (await db.LeaveRequests.AnyAsync(x => x.StaffUserId == StaffId && x.Status != LeaveStatuses.Rejected && x.StartDate <= end && x.EndDate >= start, ct))
            return Conflict(new { message = "You already have a leave request for some of these dates." });
        var item = NewLeaveRequest(StaffId, request.LeaveType, start, end, request.Reason, request.DayType, request.SupportingDocumentUrl);
        db.LeaveRequests.Add(item); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "LEAVE_REQUESTED", EntityType = "LeaveRequest", EntityId = item.Id.ToString(), NewValue = item.LeaveType });
        await db.SaveChangesAsync(ct); await db.Entry(item).Reference(x => x.StaffUser).LoadAsync(ct);
        return Ok(LeaveRow(item));
    }

    [HttpPost("leave/admin")]
    public async Task<ActionResult<LeaveRequestResponse>> CreateLeaveForStaff(AdminLeaveRequestInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateLeave(request.LeaveType, request.StartDate, request.EndDate, request.Reason, request.DayType, request.SupportingDocumentUrl);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var start = request.StartDate.Date;
        var end = request.EndDate.Date;
        if (await db.LeaveRequests.AnyAsync(x => x.StaffUserId == staff.Id && x.Status != LeaveStatuses.Rejected && x.StartDate <= end && x.EndDate >= start, ct))
            return Conflict(new { message = "This employee already has a leave request for some of these dates." });
        var item = NewLeaveRequest(staff.Id, request.LeaveType, start, end, request.Reason, request.DayType, request.SupportingDocumentUrl);
        db.LeaveRequests.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "LEAVE_CREATED_BY_ADMIN", EntityType = "LeaveRequest", EntityId = item.Id.ToString(), NewValue = $"{staff.FullName}; {item.LeaveType}; {start:yyyy-MM-dd}..{end:yyyy-MM-dd}" });
        await db.SaveChangesAsync(ct);
        item.StaffUser = staff;
        return Ok(LeaveRow(item));
    }

    [HttpPut("leave/{id:guid}")]
    public async Task<ActionResult<LeaveRequestResponse>> UpdateLeave(Guid id, AdminLeaveRequestInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateLeave(request.LeaveType, request.StartDate, request.EndDate, request.Reason, request.DayType, request.SupportingDocumentUrl);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.LeaveRequests.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var start = request.StartDate.Date;
        var end = request.EndDate.Date;
        if (item.Status != LeaveStatuses.Rejected && await db.LeaveRequests.AnyAsync(x => x.Id != id && x.StaffUserId == staff.Id && x.Status != LeaveStatuses.Rejected && x.StartDate <= end && x.EndDate >= start, ct))
            return Conflict(new { message = "This employee already has a leave request for some of these dates." });
        var oldValue = $"{item.StaffUser?.FullName}; {item.LeaveType}; {item.StartDate:yyyy-MM-dd}..{item.EndDate:yyyy-MM-dd}";
        item.StaffUserId = staff.Id;
        item.StaffUser = staff;
        item.LeaveType = request.LeaveType.Trim().ToUpperInvariant();
        item.StartDate = start;
        item.EndDate = end;
        item.DayType = request.DayType.Trim().ToUpperInvariant();
        item.AppliedDays = CalculateLeaveDays(start, end, item.DayType);
        item.Reason = request.Reason.Trim();
        item.SupportingDocumentUrl = Clean(request.SupportingDocumentUrl);
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "LEAVE_UPDATED_BY_ADMIN", EntityType = "LeaveRequest", EntityId = id.ToString(), PreviousValue = oldValue, NewValue = $"{staff.FullName}; {item.LeaveType}; {start:yyyy-MM-dd}..{end:yyyy-MM-dd}" });
        await db.SaveChangesAsync(ct);
        return Ok(LeaveRow(item));
    }

    [HttpDelete("leave/{id:guid}")]
    public async Task<IActionResult> DeleteLeave(Guid id, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var item = await db.LeaveRequests.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "LEAVE_DELETED_BY_ADMIN", EntityType = "LeaveRequest", EntityId = id.ToString(), PreviousValue = $"{item.LeaveType}; {item.StartDate:yyyy-MM-dd}..{item.EndDate:yyyy-MM-dd}; {item.Status}" });
        db.LeaveRequests.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("leave/{id:guid}/decision")]
    public async Task<ActionResult<LeaveRequestResponse>> DecideLeave(Guid id, LeaveDecisionInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        if (request.Status is not (LeaveStatuses.Approved or LeaveStatuses.Rejected)) return BadRequest(new { message = "Choose approved or rejected." });
        var item = await db.LeaveRequests.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        if (item.Status != LeaveStatuses.Pending) return Conflict(new { message = "This leave request has already been decided." });
        if (request.Status == LeaveStatuses.Approved)
        {
            var balanceError = await ValidateLeaveBalance(item, ct);
            if (balanceError is not null) return Conflict(new { message = balanceError });
        }
        item.Status = request.Status; item.ApprovalComment = request.Comment?.Trim(); item.ApprovedByStaffUserId = StaffId; item.DecidedAtUtc = DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"LEAVE_{request.Status}", EntityType = "LeaveRequest", EntityId = id.ToString(), NewValue = request.Comment });
        await db.SaveChangesAsync(ct);
        return Ok(LeaveRow(item));
    }

    [HttpGet("leave/allocations")]
    public async Task<ActionResult<IReadOnlyList<LeaveAllocationResponse>>> LeaveAllocations(int? leaveYear, Guid? staffUserId, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var year = leaveYear ?? ApplicationTime.NepalNow.Year;
        if (year is < 2000 or > 2200) return BadRequest(new { message = "Choose a valid leave year." });
        var query = db.LeaveAllocations.AsNoTracking().Include(x => x.StaffUser).Where(x => x.LeaveYear == year);
        if (staffUserId.HasValue) query = query.Where(x => x.StaffUserId == staffUserId.Value);
        return Ok((await query.OrderBy(x => x.StaffUser!.FullName).ThenBy(x => x.LeaveType).ToListAsync(ct)).Select(LeaveAllocationRow).ToList());
    }

    [HttpPut("leave/allocations")]
    public async Task<ActionResult<LeaveAllocationResponse>> SaveLeaveAllocation(LeaveAllocationInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateLeaveAllocation(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var leaveType = request.LeaveType.Trim().ToUpperInvariant();
        var item = await db.LeaveAllocations.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.StaffUserId == staff.Id && x.LeaveType == leaveType && x.LeaveYear == request.LeaveYear, ct);
        var isNew = item is null;
        item ??= new LeaveAllocation { StaffUserId = staff.Id, StaffUser = staff, LeaveType = leaveType, LeaveYear = request.LeaveYear };
        var previous = isNew ? null : $"allocated={item.AllocatedDays}; carry={item.CarryForwardDays}; adjustment={item.AdjustmentDays}";
        item.AllocatedDays = request.AllocatedDays;
        item.CarryForwardDays = request.CarryForwardDays;
        item.AdjustmentDays = request.AdjustmentDays;
        item.Notes = Clean(request.Notes);
        item.UpdatedAt = DateTime.UtcNow;
        if (isNew) db.LeaveAllocations.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = isNew ? "LEAVE_ALLOCATION_CREATED" : "LEAVE_ALLOCATION_UPDATED", EntityType = "LeaveAllocation", EntityId = item.Id.ToString(), PreviousValue = previous, NewValue = $"{staff.FullName}; {leaveType}; {request.LeaveYear}; allocated={item.AllocatedDays}; carry={item.CarryForwardDays}; adjustment={item.AdjustmentDays}" });
        await db.SaveChangesAsync(ct);
        return Ok(LeaveAllocationRow(item));
    }

    [HttpGet("leave/balances")]
    public async Task<ActionResult<IReadOnlyList<LeaveBalanceResponse>>> LeaveBalances(int? leaveYear, Guid? staffUserId, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var year = leaveYear ?? ApplicationTime.NepalNow.Year;
        if (year is < 2000 or > 2200) return BadRequest(new { message = "Choose a valid leave year." });
        if (!CanManageHrRecords && staffUserId.HasValue && staffUserId.Value != StaffId) return Forbid();
        var query = db.StaffUsers.AsNoTracking().Where(x => x.IsActive && x.Role != "CUSTOMER");
        if (CanManageHrRecords && staffUserId.HasValue) query = query.Where(x => x.Id == staffUserId.Value);
        if (!CanManageHrRecords) query = query.Where(x => x.Id == StaffId);
        var staff = await query.OrderBy(x => x.FullName).ToListAsync(ct);
        if (staffUserId.HasValue && !staff.Any()) return NotFound(new { message = "The selected employee could not be found." });
        if (!staff.Any()) return Ok(Array.Empty<LeaveBalanceResponse>());
        var staffIds = staff.Select(x => x.Id).ToArray();
        var start = new DateTime(year, 1, 1);
        var end = start.AddYears(1).AddDays(-1);
        var allocations = await db.LeaveAllocations.AsNoTracking().Where(x => staffIds.Contains(x.StaffUserId) && x.LeaveYear == year).ToListAsync(ct);
        var approved = await db.LeaveRequests.AsNoTracking().Where(x => staffIds.Contains(x.StaffUserId) && x.Status == LeaveStatuses.Approved && x.StartDate <= end && x.EndDate >= start).ToListAsync(ct);
        var configuredTypes = await db.HrmsSetupItems.AsNoTracking().Where(x => x.Category == "LEAVE_TYPE" && x.IsActive).Select(x => x.Name).ToListAsync(ct);
        var result = new List<LeaveBalanceResponse>();
        foreach (var employee in staff)
        {
            var types = allocations.Where(x => x.StaffUserId == employee.Id).Select(x => x.LeaveType)
                .Concat(approved.Where(x => x.StaffUserId == employee.Id).Select(x => x.LeaveType))
                .Concat(configuredTypes.Select(x => x.Trim().ToUpperInvariant()))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();
            foreach (var leaveType in types)
            {
                var allocation = allocations.SingleOrDefault(x => x.StaffUserId == employee.Id && x.LeaveType.Equals(leaveType, StringComparison.OrdinalIgnoreCase));
                var used = approved.Where(x => x.StaffUserId == employee.Id && x.LeaveType.Equals(leaveType, StringComparison.OrdinalIgnoreCase)).Sum(x => CalculateLeaveDaysInYear(x, year));
                var available = allocation is null ? 0m : allocation.AllocatedDays + allocation.CarryForwardDays + allocation.AdjustmentDays;
                result.Add(new LeaveBalanceResponse(employee.Id, employee.FullName, leaveType, year, allocation?.AllocatedDays ?? 0m, allocation?.CarryForwardDays ?? 0m, allocation?.AdjustmentDays ?? 0m, used, available - used, allocation is not null));
            }
        }
        return Ok(result);
    }

    [HttpGet("overtime")]
    public async Task<ActionResult<IReadOnlyList<OvertimeRecordResponse>>> Overtime(DateTime? from, DateTime? to, Guid? staffUserId, CancellationToken ct)
    {
        if (!CanHrmsView || !IsStaff) return Forbid();
        var start = (from ?? new DateTime(ApplicationTime.NepalNow.Year, ApplicationTime.NepalNow.Month, 1)).Date;
        var end = (to ?? ApplicationTime.NepalNow.Date).Date;
        if (end < start || (end - start).TotalDays > 366) return BadRequest(new { message = "Choose a valid overtime date range of up to one year." });
        var query = db.OvertimeRecords.AsNoTracking().Include(x => x.StaffUser).Where(x => x.WorkDate >= start && x.WorkDate <= end);
        if (!CanManageHrRecords) query = query.Where(x => x.StaffUserId == StaffId);
        else if (staffUserId.HasValue) query = query.Where(x => x.StaffUserId == staffUserId.Value);
        return Ok((await query.OrderByDescending(x => x.WorkDate).ThenBy(x => x.StaffUser!.FullName).ToListAsync(ct)).Select(OvertimeRow).ToList());
    }

    [HttpPost("overtime")]
    public async Task<ActionResult<OvertimeRecordResponse>> CreateOvertime(OvertimeRecordInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateOvertime(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var item = new OvertimeRecord
        {
            StaffUserId = staff.Id,
            StaffUser = staff,
            WorkDate = request.WorkDate.Date,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            TotalMinutes = CalculateOvertimeMinutes(request.StartTime, request.EndTime),
            OvertimeType = request.OvertimeType.Trim().ToUpperInvariant(),
            Remarks = Clean(request.Remarks)
        };
        db.OvertimeRecords.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "OVERTIME_CREATED", EntityType = "OvertimeRecord", EntityId = item.Id.ToString(), NewValue = $"{staff.FullName}; {item.WorkDate:yyyy-MM-dd}; {item.TotalMinutes}m" });
        await db.SaveChangesAsync(ct);
        return Ok(OvertimeRow(item));
    }

    [HttpPut("overtime/{id:guid}/decision")]
    public async Task<ActionResult<OvertimeRecordResponse>> DecideOvertime(Guid id, WorkflowDecisionInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        if (request.Status is not (OvertimeStatuses.Approved or OvertimeStatuses.Rejected)) return BadRequest(new { message = "Choose approved or rejected." });
        if (request.Comment?.Trim().Length > 1000) return BadRequest(new { message = "The decision comment is too long." });
        var item = await db.OvertimeRecords.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        if (item.Status != OvertimeStatuses.Pending) return Conflict(new { message = "This overtime record has already been decided." });
        item.Status = request.Status;
        item.DecidedByStaffUserId = StaffId;
        item.DecidedAtUtc = DateTime.UtcNow;
        item.DecisionComment = Clean(request.Comment);
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"OVERTIME_{request.Status}", EntityType = "OvertimeRecord", EntityId = item.Id.ToString(), NewValue = item.DecisionComment });
        await db.SaveChangesAsync(ct);
        return Ok(OvertimeRow(item));
    }

    [HttpGet("employment-movements")]
    public async Task<ActionResult<IReadOnlyList<EmploymentMovementResponse>>> EmploymentMovements(string? movementType, Guid? staffUserId, CancellationToken ct)
    {
        if (!CanHrmsView || !IsStaff) return Forbid();
        var query = db.EmploymentMovements.AsNoTracking().Include(x => x.StaffUser).Include(x => x.PreviousBranch).Include(x => x.NewBranch).Include(x => x.PreviousShift).Include(x => x.NewShift).AsQueryable();
        if (!CanManageHrRecords) query = query.Where(x => x.StaffUserId == StaffId);
        else if (staffUserId.HasValue) query = query.Where(x => x.StaffUserId == staffUserId.Value);
        if (!string.IsNullOrWhiteSpace(movementType))
        {
            var normalized = NormalizeMovementType(movementType);
            if (normalized is null) return BadRequest(new { message = "Choose a valid movement type." });
            query = query.Where(x => x.MovementType == normalized);
        }
        return Ok((await query.OrderByDescending(x => x.EffectiveDate).ThenByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(EmploymentMovementRow).ToList());
    }

    [HttpPost("employment-movements")]
    public async Task<ActionResult<EmploymentMovementResponse>> CreateEmploymentMovement(EmploymentMovementInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateEmploymentMovement(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.Include(x => x.Branch).Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var type = NormalizeMovementType(request.MovementType)!;
        Branch? nextBranch = null;
        WorkShift? nextShift = null;
        if (request.NewBranchId.HasValue)
        {
            nextBranch = await db.Branches.SingleOrDefaultAsync(x => x.Id == request.NewBranchId.Value && x.IsActive, ct);
            if (nextBranch is null) return BadRequest(new { message = "Choose an active destination branch." });
        }
        if (request.NewShiftId.HasValue)
        {
            nextShift = await db.WorkShifts.SingleOrDefaultAsync(x => x.Id == request.NewShiftId.Value && x.IsActive, ct);
            if (nextShift is null) return BadRequest(new { message = "Choose an active destination shift." });
        }
        if (type == EmploymentMovementTypes.BranchTransfer && nextBranch?.Id == staff.BranchId) return BadRequest(new { message = "Choose a branch that differs from the employee's current branch." });
        if (type == EmploymentMovementTypes.ShiftTransfer && nextShift?.Id == staff.ShiftId) return BadRequest(new { message = "Choose a shift that differs from the employee's current shift." });
        var item = new EmploymentMovement
        {
            StaffUserId = staff.Id,
            StaffUser = staff,
            MovementType = type,
            EffectiveDate = request.EffectiveDate.Date,
            PreviousBranchId = staff.BranchId,
            PreviousBranch = staff.Branch,
            NewBranchId = nextBranch?.Id,
            NewBranch = nextBranch,
            PreviousShiftId = staff.ShiftId,
            PreviousShift = staff.Shift,
            NewShiftId = nextShift?.Id,
            NewShift = nextShift,
            PreviousDepartment = staff.Department,
            NewDepartment = Clean(request.NewDepartment),
            PreviousJobTitle = staff.JobTitle,
            NewJobTitle = Clean(request.NewJobTitle),
            Reason = request.Reason.Trim()
        };
        db.EmploymentMovements.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "EMPLOYMENT_MOVEMENT_CREATED", EntityType = "EmploymentMovement", EntityId = item.Id.ToString(), NewValue = $"{staff.FullName}; {type}; effective={item.EffectiveDate:yyyy-MM-dd}" });
        await db.SaveChangesAsync(ct);
        return Ok(EmploymentMovementRow(item));
    }

    [HttpPut("employment-movements/{id:guid}/decision")]
    public async Task<ActionResult<EmploymentMovementResponse>> DecideEmploymentMovement(Guid id, WorkflowDecisionInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        if (request.Status is not (EmploymentMovementStatuses.Approved or EmploymentMovementStatuses.Rejected)) return BadRequest(new { message = "Choose approved or rejected." });
        if (request.Comment?.Trim().Length > 1000) return BadRequest(new { message = "The decision comment is too long." });
        var item = await db.EmploymentMovements.Include(x => x.StaffUser).Include(x => x.PreviousBranch).Include(x => x.NewBranch).Include(x => x.PreviousShift).Include(x => x.NewShift).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        if (item.Status != EmploymentMovementStatuses.Pending) return Conflict(new { message = "This employee movement has already been decided." });
        if (request.Status == EmploymentMovementStatuses.Approved && item.EffectiveDate.Date > ApplicationTime.NepalNow.Date)
            return Conflict(new { message = "This movement is effective in the future. Approve and apply it on or after its effective date." });
        if (request.Status == EmploymentMovementStatuses.Approved)
        {
            var staff = item.StaffUser!;
            if (item.MovementType == EmploymentMovementTypes.BranchTransfer) staff.BranchId = item.NewBranchId;
            if (item.MovementType == EmploymentMovementTypes.ShiftTransfer) staff.ShiftId = item.NewShiftId;
            if (item.MovementType is EmploymentMovementTypes.Promotion or EmploymentMovementTypes.PositionChange)
            {
                staff.Department = item.NewDepartment ?? staff.Department;
                staff.JobTitle = item.NewJobTitle ?? staff.JobTitle;
            }
            staff.UpdatedAt = DateTime.UtcNow;
        }
        item.Status = request.Status;
        item.DecidedByStaffUserId = StaffId;
        item.DecidedAtUtc = DateTime.UtcNow;
        item.DecisionComment = Clean(request.Comment);
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"EMPLOYMENT_MOVEMENT_{request.Status}", EntityType = "EmploymentMovement", EntityId = item.Id.ToString(), NewValue = item.DecisionComment });
        await db.SaveChangesAsync(ct);
        return Ok(EmploymentMovementRow(item));
    }

    [HttpGet("attendance/team")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecordResponse>>> Team(DateTime? date, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var workDate = (date ?? ApplicationTime.NepalNow).Date;
        var rows = await db.AttendanceRecords.AsNoTracking().Include(x => x.StaffUser).Where(x => x.WorkDate == workDate && x.StaffUser!.IsActive && x.StaffUser.Role != "CUSTOMER").OrderBy(x => x.StaffUser!.FullName).ToListAsync(ct);
        return Ok(rows.Select(Row).ToList());
    }

    [HttpGet("attendance/records")]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecordResponse>>> AllAttendance(DateTime? from, DateTime? to, Guid? staffUserId, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        if (from.HasValue != to.HasValue || from.HasValue && ((to!.Value.Date - from.Value.Date).TotalDays < 0 || (to.Value.Date - from.Value.Date).TotalDays > 366))
            return BadRequest(new { message = "Choose both attendance dates and a valid range of up to one year." });
        var query = db.AttendanceRecords.AsNoTracking().Include(x => x.StaffUser).Include(x => x.Shift).AsQueryable();
        if (from.HasValue) query = query.Where(x => x.WorkDate >= from.Value.Date && x.WorkDate <= to!.Value.Date);
        if (staffUserId.HasValue) query = query.Where(x => x.StaffUserId == staffUserId.Value);
        var rows = await query.OrderByDescending(x => x.WorkDate).ThenBy(x => x.StaffUser!.FullName).ToListAsync(ct);
        return Ok(rows.Select(Row).ToList());
    }

    [HttpPost("attendance/records")]
    public async Task<ActionResult<AttendanceRecordResponse>> CreateAttendance(AdminAttendanceInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateAdminAttendance(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var workDate = request.WorkDate.Date;
        if (await db.AttendanceRecords.AnyAsync(x => x.StaffUserId == staff.Id && x.WorkDate == workDate, ct))
            return Conflict(new { message = "An attendance record already exists for this employee and date." });
        var shiftId = request.ShiftId ?? staff.ShiftId;
        var shift = shiftId.HasValue ? await db.WorkShifts.SingleOrDefaultAsync(x => x.Id == shiftId.Value, ct) : null;
        if (shiftId.HasValue && shift is null) return BadRequest(new { message = "Choose a valid work shift." });
        var item = new AttendanceRecord { StaffUserId = staff.Id, StaffUser = staff, WorkDate = workDate, ShiftId = shiftId, Shift = shift };
        ApplyAdminAttendance(item, request, shift);
        db.AttendanceRecords.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_CREATED_BY_ADMIN", EntityType = "AttendanceRecord", EntityId = item.Id.ToString(), NewValue = $"{staff.FullName}; {workDate:yyyy-MM-dd}; {item.Status}" });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Conflict(new { message = "An attendance record already exists for this employee and date." }); }
        return Ok(Row(item));
    }

    [HttpPut("attendance/records/{id:guid}")]
    public async Task<ActionResult<AttendanceRecordResponse>> UpdateAttendance(Guid id, AdminAttendanceInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var validation = ValidateAdminAttendance(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.AttendanceRecords.Include(x => x.StaffUser).Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var staff = await db.StaffUsers.Include(x => x.Shift).SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return BadRequest(new { message = "Choose an active employee." });
        var workDate = request.WorkDate.Date;
        if (await db.AttendanceRecords.AnyAsync(x => x.Id != id && x.StaffUserId == staff.Id && x.WorkDate == workDate, ct))
            return Conflict(new { message = "An attendance record already exists for this employee and date." });
        var shiftId = request.ShiftId ?? staff.ShiftId;
        var shift = shiftId.HasValue ? await db.WorkShifts.SingleOrDefaultAsync(x => x.Id == shiftId.Value, ct) : null;
        if (shiftId.HasValue && shift is null) return BadRequest(new { message = "Choose a valid work shift." });
        var oldValue = $"{item.StaffUser?.FullName}; {item.WorkDate:yyyy-MM-dd}; {item.Status}";
        item.StaffUserId = staff.Id;
        item.StaffUser = staff;
        item.WorkDate = workDate;
        item.ShiftId = shiftId;
        item.Shift = shift;
        ApplyAdminAttendance(item, request, shift);
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_UPDATED_BY_ADMIN", EntityType = "AttendanceRecord", EntityId = id.ToString(), PreviousValue = oldValue, NewValue = $"{staff.FullName}; {workDate:yyyy-MM-dd}; {item.Status}" });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Conflict(new { message = "An attendance record already exists for this employee and date." }); }
        return Ok(Row(item));
    }

    [HttpDelete("attendance/records/{id:guid}")]
    public async Task<IActionResult> DeleteAttendance(Guid id, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        var item = await db.AttendanceRecords.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_DELETED_BY_ADMIN", EntityType = "AttendanceRecord", EntityId = id.ToString(), PreviousValue = $"{item.StaffUser?.FullName}; {item.WorkDate:yyyy-MM-dd}; {item.Status}" });
        db.AttendanceRecords.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("settings")]
    public async Task<ActionResult<AttendanceSettingsResponse>> Settings(CancellationToken ct)
    {
        if (!CanHrmsView && !CanHrSettingsManage) return Forbid();
        var item = await db.AttendanceSettings.AsNoTracking().OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct) ?? new AttendanceSetting();
        return Ok(SettingsRow(item));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<AttendanceSettingsResponse>> SaveSettings(AttendanceSettingsInput request, CancellationToken ct)
    {
        if (!CanHrSettingsManage) return Forbid();
        if (request.LateCheckInGraceMinutes is < 0 or > 240 || request.DefaultRadiusMeters is < 0 or > 10000 || request.EarlyCheckInGraceMinutes is < 0 or > 240 || request.EarlyCheckOutGraceMinutes is < 0 or > 240 || request.LateCheckOutGraceMinutes is < 0 or > 240)
            return BadRequest(new { message = "Grace periods and radius must be within the allowed range." });
        var item = await db.AttendanceSettings.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        var isNew = item is null;
        item ??= new AttendanceSetting();
        item.LateCheckInGraceMinutes = request.LateCheckInGraceMinutes; item.EarlyCheckInGraceMinutes = request.EarlyCheckInGraceMinutes; item.EarlyCheckOutGraceMinutes = request.EarlyCheckOutGraceMinutes; item.LateCheckOutGraceMinutes = request.LateCheckOutGraceMinutes; item.DefaultRadiusMeters = request.DefaultRadiusMeters; item.LocationRequired = request.LocationRequired; item.BusinessTimeZone = ApplicationTime.TimeZoneId; item.UpdatedByStaffUserId = StaffId; item.UpdatedAt = DateTime.UtcNow;
        if (isNew) db.AttendanceSettings.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_SETTINGS_UPDATED", EntityType = "AttendanceSetting", EntityId = item.Id.ToString(), NewValue = $"grace={item.LateCheckInGraceMinutes}; radius={item.DefaultRadiusMeters}; required={item.LocationRequired}" });
        await db.SaveChangesAsync(ct);
        return Ok(SettingsRow(item));
    }

    [HttpGet("shifts")]
    public async Task<ActionResult<IReadOnlyList<WorkShiftResponse>>> Shifts(CancellationToken ct)
    {
        if (!CanHrmsView && !CanHrSettingsManage) return Forbid();
        return Ok((await db.WorkShifts.AsNoTracking().OrderBy(x => x.StartTime).ToListAsync(ct)).Select(ShiftRow).ToList());
    }

    [HttpPost("shifts")]
    public async Task<ActionResult<WorkShiftResponse>> CreateShift(WorkShiftInput request, CancellationToken ct)
    {
        if (!CanHrSettingsManage) return Forbid();
        var validation = ValidateShift(request); if (validation is not null) return BadRequest(new { message = validation });
        if (await db.WorkShifts.AnyAsync(x => x.Name == request.Name.Trim(), ct)) return Conflict(new { message = "A shift with this name already exists." });
        var item = new WorkShift { Name = request.Name.Trim(), ShiftType = request.ShiftType.Trim().ToUpperInvariant(), StartTime = request.StartTime, EndTime = request.EndTime, BreakDurationMinutes = request.BreakDurationMinutes, GracePeriodMinutes = request.GracePeriodMinutes, MinimumWorkingMinutes = request.MinimumWorkingMinutes, LateThresholdMinutes = request.LateThresholdMinutes, HalfDayThresholdMinutes = request.HalfDayThresholdMinutes, OvertimeThresholdMinutes = request.OvertimeThresholdMinutes, WeeklyOffDays = request.WeeklyOffDays.Trim().ToUpperInvariant(), IsActive = request.IsActive };
        db.WorkShifts.Add(item); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "SHIFT_CREATED", EntityType = "WorkShift", EntityId = item.Id.ToString(), NewValue = item.Name }); await db.SaveChangesAsync(ct); return Ok(ShiftRow(item));
    }

    [HttpPut("shifts/{id:guid}")]
    public async Task<ActionResult<WorkShiftResponse>> UpdateShift(Guid id, WorkShiftInput request, CancellationToken ct)
    {
        if (!CanHrSettingsManage) return Forbid();
        var validation = ValidateShift(request); if (validation is not null) return BadRequest(new { message = validation });
        var item = await db.WorkShifts.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound();
        if (await db.WorkShifts.AnyAsync(x => x.Id != id && x.Name == request.Name.Trim(), ct)) return Conflict(new { message = "A shift with this name already exists." });
        item.Name = request.Name.Trim(); item.ShiftType = request.ShiftType.Trim().ToUpperInvariant(); item.StartTime = request.StartTime; item.EndTime = request.EndTime; item.BreakDurationMinutes = request.BreakDurationMinutes; item.GracePeriodMinutes = request.GracePeriodMinutes; item.MinimumWorkingMinutes = request.MinimumWorkingMinutes; item.LateThresholdMinutes = request.LateThresholdMinutes; item.HalfDayThresholdMinutes = request.HalfDayThresholdMinutes; item.OvertimeThresholdMinutes = request.OvertimeThresholdMinutes; item.WeeklyOffDays = request.WeeklyOffDays.Trim().ToUpperInvariant(); item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "SHIFT_UPDATED", EntityType = "WorkShift", EntityId = item.Id.ToString(), NewValue = item.Name }); await db.SaveChangesAsync(ct); return Ok(ShiftRow(item));
    }

    [HttpGet("attendance/corrections")]
    public async Task<ActionResult<IReadOnlyList<AttendanceCorrectionResponse>>> Corrections(CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        var query = db.AttendanceCorrections.AsNoTracking().Include(x => x.StaffUser).AsQueryable(); if (!CanManageHrRecords) query = query.Where(x => x.StaffUserId == StaffId);
        return Ok((await query.OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync(ct)).Select(CorrectionRow).ToList());
    }

    [HttpPost("attendance/corrections")]
    public async Task<ActionResult<AttendanceCorrectionResponse>> RequestCorrection(AttendanceCorrectionInput request, CancellationToken ct)
    {
        if (!IsStaff) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 1000 || request.WorkDate.Date > ApplicationTime.NepalNow.Date) return BadRequest(new { message = "Provide a reason and a valid attendance date." });
        if (request.RequestedCheckInUtc is null && request.RequestedCheckOutUtc is null) return BadRequest(new { message = "Provide a requested check-in or check-out time." });
        if (await db.AttendanceCorrections.AnyAsync(x => x.StaffUserId == StaffId && x.WorkDate == request.WorkDate.Date && x.Status == AttendanceCorrectionStatuses.Pending, ct)) return Conflict(new { message = "A correction for this date is already pending." });
        var item = new AttendanceCorrection { StaffUserId = StaffId, WorkDate = request.WorkDate.Date, RequestedCheckInUtc = request.RequestedCheckInUtc, RequestedCheckOutUtc = request.RequestedCheckOutUtc, Reason = request.Reason.Trim() };
        db.AttendanceCorrections.Add(item); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_CORRECTION_REQUESTED", EntityType = "AttendanceCorrection", EntityId = item.Id.ToString(), NewValue = item.Reason }); await db.SaveChangesAsync(ct); await db.Entry(item).Reference(x => x.StaffUser).LoadAsync(ct); return Ok(CorrectionRow(item));
    }

    [HttpPut("attendance/corrections/{id:guid}/decision")]
    public async Task<ActionResult<AttendanceCorrectionResponse>> DecideCorrection(Guid id, AttendanceCorrectionDecisionInput request, CancellationToken ct)
    {
        if (!CanManageHrRecords || !IsStaff) return Forbid();
        if (request.Status is not (AttendanceCorrectionStatuses.Approved or AttendanceCorrectionStatuses.Rejected)) return BadRequest(new { message = "Choose approved or rejected." });
        var item = await db.AttendanceCorrections.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return NotFound(); if (item.Status != AttendanceCorrectionStatuses.Pending) return Conflict(new { message = "This correction has already been decided." });
        item.Status = request.Status; item.ReviewComment = request.Comment?.Trim(); item.ReviewedByStaffUserId = StaffId; item.ReviewedAtUtc = DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        if (request.Status == AttendanceCorrectionStatuses.Approved)
        {
            var record = await db.AttendanceRecords.Include(x => x.StaffUser).Include(x => x.Shift).SingleOrDefaultAsync(x => x.StaffUserId == item.StaffUserId && x.WorkDate == item.WorkDate, ct);
            var recordIsNew = record is null;
            record ??= new AttendanceRecord { StaffUserId = item.StaffUserId, WorkDate = item.WorkDate };
            var oldValue = $"in={record.CheckInUtc:O};out={record.CheckOutUtc:O}"; if (item.RequestedCheckInUtc.HasValue) record.CheckInUtc = item.RequestedCheckInUtc; if (item.RequestedCheckOutUtc.HasValue) record.CheckOutUtc = item.RequestedCheckOutUtc; if (record.CheckInUtc.HasValue && record.CheckOutUtc.HasValue) { record.TotalMinutes = Math.Max(0, (int)(record.CheckOutUtc.Value - record.CheckInUtc.Value).TotalMinutes - (record.Shift?.BreakDurationMinutes ?? 0)); record.IsFinalized = true; record.Status = record.TotalMinutes < (record.Shift?.HalfDayThresholdMinutes ?? 270) ? AttendanceStatuses.HalfDay : AttendanceStatuses.CheckedOut; } record.UpdatedAt = DateTime.UtcNow; if (recordIsNew) db.AttendanceRecords.Add(record); db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "ATTENDANCE_CORRECTION_APPROVED", EntityType = "AttendanceRecord", EntityId = record.Id.ToString(), PreviousValue = oldValue, NewValue = $"in={record.CheckInUtc:O};out={record.CheckOutUtc:O}" });
        }
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"ATTENDANCE_CORRECTION_{request.Status}", EntityType = "AttendanceCorrection", EntityId = id.ToString(), NewValue = request.Comment }); await db.SaveChangesAsync(ct); return Ok(CorrectionRow(item));
    }

    [HttpGet("salary-revisions")]
    public async Task<ActionResult<IReadOnlyList<SalaryRevisionResponse>>> SalaryRevisions(Guid? staffUserId, CancellationToken ct)
    {
        if (!CanPayrollView) return Forbid();
        var query = db.SalaryRevisions.AsNoTracking().Include(x => x.StaffUser).AsQueryable();
        if (staffUserId.HasValue) query = query.Where(x => x.StaffUserId == staffUserId.Value);
        var rows = await query.OrderByDescending(x => x.EffectiveDate).ThenByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(SalaryRevisionRow).ToList());
    }

    [HttpPost("salary-revisions")]
    public async Task<ActionResult<SalaryRevisionResponse>> CreateSalaryRevision(SalaryRevisionInput request, CancellationToken ct)
    {
        if (!CanPayrollManage) return Forbid();
        var validation = ValidateSalaryRevision(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return NotFound(new { message = "The selected staff member could not be found." });
        var previousSalary = await EffectiveBasicSalary(request.StaffUserId, request.EffectiveDate.Date.AddDays(-1), ct);
        var item = new SalaryRevision
        {
            StaffUserId = staff.Id,
            Title = request.Title.Trim(),
            RevisionType = request.RevisionType.Trim().ToUpperInvariant(),
            EffectiveDate = request.EffectiveDate.Date,
            PreviousBasicSalary = previousSalary.BasicSalary,
            RevisedBasicSalary = request.RevisedBasicSalary,
            Reason = Clean(request.Reason),
            AttachmentUrl = Clean(request.AttachmentUrl)
        };
        db.SalaryRevisions.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "SALARY_REVISION_CREATED", EntityType = "SalaryRevision", EntityId = item.Id.ToString(), NewValue = $"{staff.Id}; {item.EffectiveDate:yyyy-MM-dd}; {item.RevisedBasicSalary}" });
        await db.SaveChangesAsync(ct);
        item.StaffUser = staff;
        return Ok(SalaryRevisionRow(item));
    }

    [HttpPut("salary-revisions/{id:guid}/decision")]
    public async Task<ActionResult<SalaryRevisionResponse>> DecideSalaryRevision(Guid id, SalaryRevisionDecisionInput request, CancellationToken ct)
    {
        if (!CanPayrollManage) return Forbid();
        var status = request.Status?.Trim().ToUpperInvariant();
        if (status is not SalaryRevisionStatuses.Approved and not SalaryRevisionStatuses.Rejected) return BadRequest(new { message = "Choose APPROVED or REJECTED." });
        if (request.Comment?.Trim().Length > 1000) return BadRequest(new { message = "The decision comment is too long." });
        var item = await db.SalaryRevisions.Include(x => x.StaffUser).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        if (item.Status != SalaryRevisionStatuses.Pending) return Conflict(new { message = "This salary revision has already been decided." });
        if (status == SalaryRevisionStatuses.Approved && await db.SalaryRevisions.AnyAsync(x => x.Id != item.Id && x.StaffUserId == item.StaffUserId && x.EffectiveDate == item.EffectiveDate && x.Status == SalaryRevisionStatuses.Approved, ct))
            return Conflict(new { message = "An approved basic-salary revision already exists for this employee and effective date." });

        item.Status = status;
        item.DecisionComment = Clean(request.Comment);
        item.DecidedByStaffUserId = StaffId;
        item.DecidedAtUtc = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;
        if (status == SalaryRevisionStatuses.Approved && item.EffectiveDate <= ApplicationTime.NepalNow.Date)
        {
            var newerApprovedRevisionExists = await db.SalaryRevisions.AnyAsync(x => x.Id != item.Id && x.StaffUserId == item.StaffUserId && x.Status == SalaryRevisionStatuses.Approved && x.EffectiveDate > item.EffectiveDate, ct);
            if (!newerApprovedRevisionExists && item.StaffUser is not null) item.StaffUser.CurrentBasicSalary = item.RevisedBasicSalary;
        }
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"SALARY_REVISION_{status}", EntityType = "SalaryRevision", EntityId = item.Id.ToString(), NewValue = item.DecisionComment });
        await db.SaveChangesAsync(ct);
        return Ok(SalaryRevisionRow(item));
    }

    [HttpGet("accounts/summary")]
    public async Task<ActionResult<AccountsSummaryResponse>> AccountsSummary(DateTime? month, CancellationToken ct)
    {
        if (!CanAccountsView) return Forbid();
        var requested = month ?? ApplicationTime.NepalNow;
        var start = new DateTime(requested.Year, requested.Month, 1);
        var end = start.AddMonths(1);
        var orders = db.Orders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end);
        var revenue = await orders.SumAsync(x => (decimal?)x.Total, ct) ?? 0m;
        var paidRevenue = await orders.Where(x => x.PaymentStatus == PaymentTransactionStatuses.Paid || x.PaymentStatus == "COMPLETED").SumAsync(x => (decimal?)x.Total, ct) ?? 0m;
        var purchaseCommitments = await db.PurchaseOrders.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end && x.Status != PurchaseOrderStatuses.Cancelled).SumAsync(x => (decimal?)x.TotalAmount, ct) ?? 0m;
        var payrollTotal = await db.PayrollRecords.AsNoTracking().Where(x => x.PayrollMonth == start).SumAsync(x => (decimal?)x.NetSalary, ct) ?? 0m;
        return Ok(new AccountsSummaryResponse(start, revenue, paidRevenue, Math.Max(0m, revenue - paidRevenue), purchaseCommitments, payrollTotal, await orders.CountAsync(ct)));
    }

    [HttpGet("payroll")]
    public async Task<ActionResult<IReadOnlyList<PayrollRecordResponse>>> Payroll(DateTime? month, CancellationToken ct)
    {
        if (!CanPayrollView) return Forbid();
        var requested = month ?? ApplicationTime.NepalNow;
        var payrollMonth = new DateTime(requested.Year, requested.Month, 1);
        var rows = await db.PayrollRecords.AsNoTracking().Include(x => x.StaffUser).Include(x => x.Components).Where(x => x.PayrollMonth == payrollMonth).OrderBy(x => x.StaffUser!.FullName).ToListAsync(ct);
        return Ok(rows.Select(PayrollRow).ToList());
    }

    [HttpGet("payroll/suggestion")]
    public async Task<ActionResult<PayrollSuggestionResponse>> PayrollSuggestion(Guid staffUserId, DateTime? month, CancellationToken ct)
    {
        if (!CanPayrollView) return Forbid();
        var requested = month ?? ApplicationTime.NepalNow;
        var payrollMonth = new DateTime(requested.Year, requested.Month, 1);
        var staff = await db.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == staffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return NotFound(new { message = "The selected staff member could not be found." });
        var suggestion = await EffectiveBasicSalary(staffUserId, payrollMonth.AddMonths(1).AddDays(-1), ct);
        var overtimeMinutes = await db.OvertimeRecords.AsNoTracking()
            .Where(x => x.StaffUserId == staffUserId && x.Status == OvertimeStatuses.Approved && x.WorkDate >= payrollMonth && x.WorkDate < payrollMonth.AddMonths(1))
            .SumAsync(x => (int?)x.TotalMinutes, ct) ?? 0;
        return Ok(new PayrollSuggestionResponse(staffUserId, payrollMonth, suggestion.BasicSalary, overtimeMinutes, suggestion.RevisionTitle));
    }

    [HttpPost("payroll")]
    public async Task<ActionResult<PayrollRecordResponse>> SavePayroll(PayrollInput request, CancellationToken ct)
    {
        if (!CanPayrollManage) return Forbid();
        var validation = ValidatePayroll(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var staff = await db.StaffUsers.SingleOrDefaultAsync(x => x.Id == request.StaffUserId && x.IsActive && x.Role != "CUSTOMER", ct);
        if (staff is null) return NotFound(new { message = "The selected staff member could not be found." });
        var payrollMonth = new DateTime(request.PayrollMonth.Year, request.PayrollMonth.Month, 1);
        var item = await db.PayrollRecords.Include(x => x.Components).SingleOrDefaultAsync(x => x.StaffUserId == request.StaffUserId && x.PayrollMonth == payrollMonth, ct);
        var isNew = item is null;
        item ??= new PayrollRecord { StaffUserId = staff.Id, PayrollMonth = payrollMonth };
        if (item.Status == PayrollStatuses.Paid) return Conflict(new { message = "A paid payroll record is locked and cannot be changed." });
        var components = NormalizePayrollComponents(request.Components, out var componentError);
        if (componentError is not null) return BadRequest(new { message = componentError });
        if (components is not null)
        {
            db.PayrollComponentLines.RemoveRange(item.Components);
            item.Components.Clear();
            foreach (var component in components) item.Components.Add(component);
        }
        var suggestedSalary = request.BasicSalary == 0m ? await EffectiveBasicSalary(staff.Id, payrollMonth.AddMonths(1).AddDays(-1), ct) : (BasicSalary: request.BasicSalary, RevisionTitle: (string?)null);
        item.BasicSalary = suggestedSalary.BasicSalary;
        item.Allowances = request.Allowances;
        item.OvertimeAmount = request.OvertimeAmount;
        item.Bonus = request.Bonus;
        item.Deductions = request.Deductions;
        var componentEarnings = item.Components.Where(x => x.ComponentKind == PayrollComponentKinds.Earning).Sum(x => x.Amount);
        var componentDeductions = item.Components.Where(x => x.ComponentKind == PayrollComponentKinds.Deduction).Sum(x => x.Amount);
        item.GrossSalary = item.BasicSalary + item.Allowances + item.OvertimeAmount + item.Bonus + componentEarnings;
        item.NetSalary = Math.Max(0m, item.GrossSalary - item.Deductions - componentDeductions);
        if (item.Status == PayrollStatuses.Approved)
        {
            item.Status = PayrollStatuses.Draft;
            item.ApprovedByStaffUserId = null;
            item.ApprovedAtUtc = null;
        }
        item.UpdatedAt = DateTime.UtcNow;
        if (isNew) db.PayrollRecords.Add(item);
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = "PAYROLL_SAVED", EntityType = "PayrollRecord", EntityId = item.Id.ToString(), NewValue = $"{payrollMonth:yyyy-MM}; components={item.Components.Count}" });
        await db.SaveChangesAsync(ct); item.StaffUser = staff;
        return Ok(PayrollRow(item));
    }

    [HttpPut("payroll/{id:guid}/decision")]
    public async Task<ActionResult<PayrollRecordResponse>> DecidePayroll(Guid id, PayrollDecisionInput request, CancellationToken ct)
    {
        if (!CanPayrollManage) return Forbid();
        var status = request.Status?.Trim().ToUpperInvariant();
        if (status is not PayrollStatuses.Draft and not PayrollStatuses.Approved and not PayrollStatuses.Paid) return BadRequest(new { message = "Choose DRAFT, APPROVED, or PAID." });
        if (request.PaymentMethod?.Trim().Length > 80 || request.PaymentReference?.Trim().Length > 160 || request.PaymentNotes?.Trim().Length > 1000) return BadRequest(new { message = "One or more payment fields are too long." });
        var item = await db.PayrollRecords.Include(x => x.StaffUser).Include(x => x.Components).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        if (item.Status == PayrollStatuses.Paid) return Conflict(new { message = "A paid payroll record is locked." });
        if (status == PayrollStatuses.Paid && item.Status != PayrollStatuses.Approved) return BadRequest(new { message = "Approve the payroll record before marking it paid." });

        if (status == PayrollStatuses.Draft)
        {
            item.Status = PayrollStatuses.Draft;
            item.ApprovedByStaffUserId = null;
            item.ApprovedAtUtc = null;
        }
        else if (status == PayrollStatuses.Approved)
        {
            item.Status = PayrollStatuses.Approved;
            item.ApprovedByStaffUserId = StaffId;
            item.ApprovedAtUtc = DateTime.UtcNow;
        }
        else
        {
            item.Status = PayrollStatuses.Paid;
            item.PaidAtUtc = request.PaidAtUtc is { } paidAt ? AsUtc(paidAt) : DateTime.UtcNow;
            item.PaymentMethod = Clean(request.PaymentMethod);
            item.PaymentReference = Clean(request.PaymentReference);
            item.PaymentNotes = Clean(request.PaymentNotes);
        }
        item.UpdatedAt = DateTime.UtcNow;
        db.ActivityLogs.Add(new ActivityLog { ActorId = StaffId, ActorRole = Role, Action = $"PAYROLL_{status}", EntityType = "PayrollRecord", EntityId = item.Id.ToString(), NewValue = item.PaymentReference });
        await db.SaveChangesAsync(ct);
        return Ok(PayrollRow(item));
    }

    private static AttendanceRecordResponse Row(AttendanceRecord x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.WorkDate, x.CheckInUtc, x.CheckOutUtc, x.Status, x.TotalMinutes, x.OvertimeMinutes, x.IsFinalized, x.LateMinutes, x.ShiftId, x.Shift?.Name, x.CheckInLocationStatus, x.CheckOutLocationStatus, x.CheckInLatitude, x.CheckInLongitude, x.CheckInAccuracy, x.CheckOutLatitude, x.CheckOutLongitude, x.CheckOutAccuracy);
    private static HrmsSetupItemResponse SetupRow(HrmsSetupItem x) => new(x.Id, x.Category, x.Name, x.Code, x.Description, x.DisplayOrder, x.IsActive, x.UpdatedAt);
    private static OfficeOperationRecordResponse OfficeRow(OfficeOperationRecord x) => new(x.Id, x.Category, x.Title, x.Details, x.Status, x.StaffUserId, x.StaffUser?.FullName, x.StartsAt, x.EndsAt, x.Location, x.Audience, x.ReferenceNumber, x.AttachmentUrl, x.CreatedAt, x.UpdatedAt);
    private static LeaveRequestResponse LeaveRow(LeaveRequest x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.LeaveType, x.StartDate, x.EndDate, x.Reason, x.Status, x.ApprovalComment, x.CreatedAt, x.DayType, x.AppliedDays, x.SupportingDocumentUrl);
    private static LeaveAllocationResponse LeaveAllocationRow(LeaveAllocation x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.LeaveType, x.LeaveYear, x.AllocatedDays, x.CarryForwardDays, x.AdjustmentDays, x.Notes, x.UpdatedAt);
    private static OvertimeRecordResponse OvertimeRow(OvertimeRecord x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.WorkDate, x.StartTime, x.EndTime, x.TotalMinutes, x.OvertimeType, x.Status, x.Remarks, x.DecisionComment, x.CreatedAt);
    private static EmploymentMovementResponse EmploymentMovementRow(EmploymentMovement x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.MovementType, x.EffectiveDate, x.PreviousBranchId, x.PreviousBranch?.Name, x.NewBranchId, x.NewBranch?.Name, x.PreviousShiftId, x.PreviousShift?.Name, x.NewShiftId, x.NewShift?.Name, x.PreviousDepartment, x.NewDepartment, x.PreviousJobTitle, x.NewJobTitle, x.Reason, x.Status, x.DecisionComment, x.CreatedAt);
    private static SalaryRevisionResponse SalaryRevisionRow(SalaryRevision x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.Title, x.RevisionType, x.EffectiveDate, x.PreviousBasicSalary, x.RevisedBasicSalary, x.Reason, x.AttachmentUrl, x.Status, x.DecisionComment, x.CreatedAt);
    private static PayrollComponentLineResponse PayrollComponentRow(PayrollComponentLine x) => new(x.Id, x.ComponentName, x.ComponentKind, x.Amount, x.DisplayOrder);
    private static PayrollRecordResponse PayrollRow(PayrollRecord x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.PayrollMonth, x.BasicSalary, x.Allowances, x.OvertimeAmount, x.Bonus, x.Deductions, x.GrossSalary, x.NetSalary, x.Status, x.PaidAtUtc, x.Deductions + x.Components.Where(component => component.ComponentKind == PayrollComponentKinds.Deduction).Sum(component => component.Amount), x.Components.OrderBy(component => component.DisplayOrder).Select(PayrollComponentRow).ToList(), x.PaymentMethod, x.PaymentReference, x.PaymentNotes, x.ApprovedAtUtc);
    private static AttendanceSettingsResponse SettingsRow(AttendanceSetting x) => new(x.LateCheckInGraceMinutes, x.EarlyCheckInGraceMinutes, x.EarlyCheckOutGraceMinutes, x.LateCheckOutGraceMinutes, x.DefaultRadiusMeters, x.LocationRequired, x.BusinessTimeZone);
    private static WorkShiftResponse ShiftRow(WorkShift x) => new(x.Id, x.Name, x.ShiftType, x.StartTime, x.EndTime, x.BreakDurationMinutes, x.GracePeriodMinutes, x.MinimumWorkingMinutes, x.LateThresholdMinutes, x.HalfDayThresholdMinutes, x.OvertimeThresholdMinutes, x.WeeklyOffDays, x.IsActive);
    private static AttendanceCorrectionResponse CorrectionRow(AttendanceCorrection x) => new(x.Id, x.StaffUserId, x.StaffUser?.FullName ?? "", x.WorkDate, x.RequestedCheckInUtc, x.RequestedCheckOutUtc, x.Reason, x.Status, x.CreatedAt, x.ReviewComment);
    private static LeaveRequest NewLeaveRequest(Guid staffUserId, string leaveType, DateTime startDate, DateTime endDate, string reason, string dayType, string? supportingDocumentUrl) => new()
    {
        StaffUserId = staffUserId,
        LeaveType = leaveType.Trim().ToUpperInvariant(),
        StartDate = startDate,
        EndDate = endDate,
        DayType = dayType.Trim().ToUpperInvariant(),
        AppliedDays = CalculateLeaveDays(startDate, endDate, dayType),
        Reason = reason.Trim(),
        SupportingDocumentUrl = Clean(supportingDocumentUrl)
    };

    private static string? ValidateLeave(string leaveType, DateTime startDate, DateTime endDate, string reason, string? dayType, string? supportingDocumentUrl)
    {
        if (string.IsNullOrWhiteSpace(leaveType) || leaveType.Trim().Length > 50 || string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 1000)
            return "Leave type and a reason are required.";
        var start = startDate.Date;
        var end = endDate.Date;
        if (end < start || (end - start).TotalDays > 90) return "Choose a valid leave period of up to 90 days.";
        var normalizedDayType = NormalizeLeaveDayType(dayType);
        if (normalizedDayType is null) return "Choose a valid leave day type.";
        if (normalizedDayType != LeaveDayTypes.FullDay && start != end) return "Half-day leave must start and end on the same date.";
        if (supportingDocumentUrl?.Trim().Length > 1000) return "The supporting document link is too long.";
        return null;
    }

    private async Task<string?> ValidateLeaveBalance(LeaveRequest item, CancellationToken ct)
    {
        if (item.LeaveType.Equals("UNPAID", StringComparison.OrdinalIgnoreCase)) return null;
        for (var year = item.StartDate.Year; year <= item.EndDate.Year; year++)
        {
            var requested = CalculateLeaveDaysInYear(item, year);
            if (requested <= 0) continue;
            var allocation = await db.LeaveAllocations.AsNoTracking().SingleOrDefaultAsync(x => x.StaffUserId == item.StaffUserId && x.LeaveType == item.LeaveType && x.LeaveYear == year, ct);
            // Existing sites can opt in to balance enforcement gradually: an
            // unconfigured leave type continues to use the established approval flow.
            if (allocation is null) continue;
            var used = await db.LeaveRequests.AsNoTracking()
                .Where(x => x.Id != item.Id && x.StaffUserId == item.StaffUserId && x.LeaveType == item.LeaveType && x.Status == LeaveStatuses.Approved && x.StartDate <= new DateTime(year, 12, 31) && x.EndDate >= new DateTime(year, 1, 1))
                .ToListAsync(ct);
            var remaining = allocation.AllocatedDays + allocation.CarryForwardDays + allocation.AdjustmentDays - used.Sum(x => CalculateLeaveDaysInYear(x, year));
            if (requested > remaining) return $"Only {Math.Max(0m, remaining):0.##} day(s) remain for {item.LeaveType.Replace('_', ' ')} in {year}.";
        }
        return null;
    }

    private static decimal CalculateLeaveDays(DateTime startDate, DateTime endDate, string? dayType)
    {
        var normalized = NormalizeLeaveDayType(dayType) ?? LeaveDayTypes.FullDay;
        return normalized == LeaveDayTypes.FullDay ? (endDate.Date - startDate.Date).Days + 1 : 0.5m;
    }

    private static decimal CalculateLeaveDaysInYear(LeaveRequest item, int year)
    {
        var start = new DateTime(year, 1, 1);
        var end = start.AddYears(1).AddDays(-1);
        if (item.EndDate < start || item.StartDate > end) return 0m;
        if (item.DayType != LeaveDayTypes.FullDay) return item.StartDate.Year == year ? item.AppliedDays : 0m;
        var periodStart = item.StartDate < start ? start : item.StartDate;
        var periodEnd = item.EndDate > end ? end : item.EndDate;
        return (periodEnd.Date - periodStart.Date).Days + 1;
    }

    private static string? NormalizeLeaveDayType(string? dayType)
    {
        var normalized = dayType?.Trim().ToUpperInvariant();
        return normalized is LeaveDayTypes.FullDay or LeaveDayTypes.FirstHalf or LeaveDayTypes.SecondHalf ? normalized : null;
    }

    private static string? ValidateLeaveAllocation(LeaveAllocationInput request)
    {
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        if (string.IsNullOrWhiteSpace(request.LeaveType) || request.LeaveType.Trim().Length > 50) return "Leave type is required.";
        if (request.LeaveYear is < 2000 or > 2200) return "Choose a valid leave year.";
        if (request.AllocatedDays is < 0 or > 366 || request.CarryForwardDays is < 0 or > 366 || request.AdjustmentDays is < -366 or > 366) return "Leave allocation values are outside the allowed range.";
        if (request.Notes?.Trim().Length > 1000) return "The allocation note is too long.";
        return null;
    }

    private static string? ValidateOvertime(OvertimeRecordInput request)
    {
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        if (request.WorkDate.Date > ApplicationTime.NepalNow.Date.AddDays(31)) return "Overtime cannot be recorded more than 31 days in the future.";
        if (string.IsNullOrWhiteSpace(request.OvertimeType) || request.OvertimeType.Trim().Length > 50) return "Choose an overtime type.";
        if (request.Remarks?.Trim().Length > 1000) return "The overtime remarks are too long.";
        var minutes = CalculateOvertimeMinutes(request.StartTime, request.EndTime);
        if (minutes is <= 0 or > 960) return "Overtime must be between 1 minute and 16 hours.";
        return null;
    }

    private static int CalculateOvertimeMinutes(TimeOnly start, TimeOnly end)
    {
        var minutes = (int)(end - start).TotalMinutes;
        return minutes <= 0 ? minutes + 24 * 60 : minutes;
    }

    private static string? NormalizeMovementType(string? movementType)
    {
        var normalized = movementType?.Trim().ToUpperInvariant();
        return normalized is EmploymentMovementTypes.Promotion or EmploymentMovementTypes.BranchTransfer or EmploymentMovementTypes.ShiftTransfer or EmploymentMovementTypes.PositionChange ? normalized : null;
    }

    private static string? ValidateEmploymentMovement(EmploymentMovementInput request)
    {
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        var type = NormalizeMovementType(request.MovementType);
        if (type is null) return "Choose a valid employee movement type.";
        if (request.EffectiveDate.Date < new DateTime(2000, 1, 1) || request.EffectiveDate.Date > ApplicationTime.NepalNow.Date.AddYears(2)) return "Choose a valid effective date.";
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 1000) return "A reason of up to 1,000 characters is required.";
        if (request.NewDepartment?.Trim().Length > 160 || request.NewJobTitle?.Trim().Length > 160) return "The new department or job title is too long.";
        if (type == EmploymentMovementTypes.BranchTransfer && !request.NewBranchId.HasValue) return "Choose the destination branch.";
        if (type == EmploymentMovementTypes.ShiftTransfer && !request.NewShiftId.HasValue) return "Choose the destination shift.";
        if (type == EmploymentMovementTypes.Promotion && string.IsNullOrWhiteSpace(request.NewJobTitle)) return "Choose the promoted job title.";
        if (type == EmploymentMovementTypes.PositionChange && string.IsNullOrWhiteSpace(request.NewDepartment) && string.IsNullOrWhiteSpace(request.NewJobTitle)) return "Provide a new department or job title.";
        return null;
    }

    private static string? ValidateSalaryRevision(SalaryRevisionInput request)
    {
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 180) return "A revision title of up to 180 characters is required.";
        if (NormalizeSalaryRevisionType(request.RevisionType) is null) return "Choose a valid salary revision type.";
        if (request.EffectiveDate.Date < new DateTime(2000, 1, 1) || request.EffectiveDate.Date > ApplicationTime.NepalNow.Date.AddYears(2)) return "Choose a valid effective date.";
        if (request.RevisedBasicSalary is < 0m or > 100_000_000m) return "The revised basic salary is outside the allowed range.";
        if (request.Reason?.Trim().Length > 1000 || request.AttachmentUrl?.Trim().Length > 1000) return "The revision reason or attachment link is too long.";
        return null;
    }

    private static string? NormalizeSalaryRevisionType(string? revisionType)
    {
        var normalized = revisionType?.Trim().ToUpperInvariant();
        return normalized is "INCREMENT" or "PROMOTION" or "CORRECTION" or "ANNUAL_REVIEW" or "OTHER" ? normalized : null;
    }

    private static string? ValidatePayroll(PayrollInput request)
    {
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        if (request.PayrollMonth.Year is < 2000 or > 2200) return "Choose a valid payroll month.";
        if (request.BasicSalary < 0 || request.Allowances < 0 || request.OvertimeAmount < 0 || request.Bonus < 0 || request.Deductions < 0) return "Payroll amounts cannot be negative.";
        if (request.BasicSalary > 100_000_000m || request.Allowances > 100_000_000m || request.OvertimeAmount > 100_000_000m || request.Bonus > 100_000_000m || request.Deductions > 100_000_000m) return "One or more payroll amounts are outside the allowed range.";
        return null;
    }

    private static List<PayrollComponentLine>? NormalizePayrollComponents(IReadOnlyList<PayrollComponentInput>? input, out string? error)
    {
        error = null;
        if (input is null) return null;
        if (input.Count > 30) { error = "A payroll record can contain up to 30 salary components."; return null; }
        var rows = new List<PayrollComponentLine>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < input.Count; index++)
        {
            var component = input[index];
            var name = component.ComponentName?.Trim();
            var kind = NormalizePayrollComponentKind(component.ComponentKind);
            if (string.IsNullOrWhiteSpace(name) || name.Length > 120) { error = "Each salary component needs a name of up to 120 characters."; return null; }
            if (kind is null) { error = "Each salary component must be an earning, deduction, or employer contribution."; return null; }
            if (component.Amount is < 0m or > 100_000_000m) { error = "A salary component amount is outside the allowed range."; return null; }
            if (!seen.Add($"{kind}:{name}")) { error = "Each salary component may be used once per payroll record."; return null; }
            rows.Add(new PayrollComponentLine { ComponentName = name, ComponentKind = kind, Amount = component.Amount, DisplayOrder = index + 1 });
        }
        return rows;
    }

    private static string? NormalizePayrollComponentKind(string? kind)
    {
        var normalized = kind?.Trim().ToUpperInvariant();
        return normalized is PayrollComponentKinds.Earning or PayrollComponentKinds.Deduction or PayrollComponentKinds.EmployerContribution ? normalized : null;
    }

    private async Task<(decimal BasicSalary, string? RevisionTitle)> EffectiveBasicSalary(Guid staffUserId, DateTime effectiveThrough, CancellationToken ct)
    {
        var revision = await db.SalaryRevisions.AsNoTracking()
            .Where(x => x.StaffUserId == staffUserId && x.Status == SalaryRevisionStatuses.Approved && x.EffectiveDate <= effectiveThrough.Date)
            .OrderByDescending(x => x.EffectiveDate).ThenByDescending(x => x.DecidedAtUtc)
            .Select(x => new { x.RevisedBasicSalary, x.Title })
            .FirstOrDefaultAsync(ct);
        if (revision is not null) return (revision.RevisedBasicSalary, revision.Title);
        var current = await db.StaffUsers.AsNoTracking().Where(x => x.Id == staffUserId).Select(x => (decimal?)x.CurrentBasicSalary).SingleOrDefaultAsync(ct) ?? 0m;
        return (current, null);
    }

    private static string? ValidateSetupItem(string? category, HrmsSetupItemInput request)
    {
        if (category is null) return "This HR setup register is not available.";
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 160) return "Name is required and must be 160 characters or fewer.";
        if (request.Code?.Trim().Length > 60 || request.Description?.Trim().Length > 1000) return "One or more fields are too long.";
        return null;
    }
    private static string? ValidateOfficeRecord(string? category, OfficeOperationRecordInput request)
    {
        if (category is null) return "This office operation register is not available.";
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 220) return "Title is required and must be 220 characters or fewer.";
        if (string.IsNullOrWhiteSpace(request.Status) || request.Status.Trim().Length > 30) return "Choose a valid status.";
        if (request.EndsAt.HasValue && request.StartsAt.HasValue && request.EndsAt.Value < request.StartsAt.Value) return "The end date must be after the start date.";
        if (request.Details?.Trim().Length > 4000 || request.Location?.Trim().Length > 300 || request.Audience?.Trim().Length > 60 || request.ReferenceNumber?.Trim().Length > 100 || request.AttachmentUrl?.Trim().Length > 1000) return "One or more fields are too long.";
        return null;
    }
    private static string? NormalizeSetupCategory(string category)
    {
        var normalized = category.Trim().ToUpperInvariant();
        return SetupCategories.Contains(normalized) ? normalized : null;
    }
    private static string? NormalizeOfficeCategory(string category)
    {
        var normalized = category.Trim().ToUpperInvariant();
        return OfficeCategories.Contains(normalized) ? normalized : null;
    }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string? ValidateAdminAttendance(AdminAttendanceInput request)
    {
        var statuses = new[] { AttendanceStatuses.Present, AttendanceStatuses.Late, AttendanceStatuses.CheckedOut, AttendanceStatuses.HalfDay, AttendanceStatuses.Absent, AttendanceStatuses.Leave, AttendanceStatuses.Holiday, AttendanceStatuses.Weekend };
        if (request.StaffUserId == Guid.Empty) return "Choose an employee.";
        if (!statuses.Contains(request.Status?.Trim().ToUpperInvariant())) return "Choose a valid attendance status.";
        if (request.CheckInUtc.HasValue && request.CheckOutUtc.HasValue && request.CheckOutUtc.Value < request.CheckInUtc.Value)
            return "Check-out must be after check-in.";
        if (request.WorkDate.Date > ApplicationTime.NepalNow.Date.AddDays(1)) return "Attendance cannot be recorded more than one day in the future.";
        return null;
    }
    private static void ApplyAdminAttendance(AttendanceRecord item, AdminAttendanceInput request, WorkShift? shift)
    {
        item.CheckInUtc = AsUtc(request.CheckInUtc);
        item.CheckOutUtc = AsUtc(request.CheckOutUtc);
        item.Status = request.Status.Trim().ToUpperInvariant();
        item.LateMinutes = 0;
        if (item.Status == AttendanceStatuses.Late && item.CheckInUtc.HasValue && shift is not null)
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(ApplicationTime.TimeZoneId);
            var localCheckIn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(item.CheckInUtc.Value, DateTimeKind.Utc), zone);
            item.LateMinutes = Math.Max(0, (int)(localCheckIn.TimeOfDay - shift.StartTime.ToTimeSpan()).TotalMinutes - shift.GracePeriodMinutes);
        }
        item.TotalMinutes = 0;
        item.OvertimeMinutes = 0;
        if (item.CheckInUtc.HasValue && item.CheckOutUtc.HasValue)
        {
            item.TotalMinutes = Math.Max(0, (int)(item.CheckOutUtc.Value - item.CheckInUtc.Value).TotalMinutes - (shift?.BreakDurationMinutes ?? 0));
            item.OvertimeMinutes = Math.Max(0, item.TotalMinutes - (shift?.OvertimeThresholdMinutes ?? 540));
            if (item.Status is AttendanceStatuses.Present or AttendanceStatuses.CheckedOut)
                item.Status = item.TotalMinutes < (shift?.HalfDayThresholdMinutes ?? 270) ? AttendanceStatuses.HalfDay : AttendanceStatuses.CheckedOut;
        }
        item.IsFinalized = item.CheckOutUtc.HasValue;
        item.UpdatedAt = DateTime.UtcNow;
    }
    private static DateTime? AsUtc(DateTime? value)
    {
        if (!value.HasValue) return null;
        return value.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
            : value.Value.ToUniversalTime();
    }
    private static string? ValidateShift(WorkShiftInput x)
    {
        if (string.IsNullOrWhiteSpace(x.Name) || x.Name.Trim().Length > 120) return "Shift name is required.";
        if (x.BreakDurationMinutes is < 0 or > 240 || x.GracePeriodMinutes is < 0 or > 240 || x.MinimumWorkingMinutes is < 0 or > 1440 || x.LateThresholdMinutes is < 0 or > 240 || x.HalfDayThresholdMinutes is < 0 or > 1440 || x.OvertimeThresholdMinutes is < 0 or > 1440) return "Shift timings are outside the allowed range.";
        return null;
    }
    private static (bool Required, bool HasCoordinates, bool Blocked, string Status) ValidateLocation(AttendanceLocationInput? input, Branch? branch, AttendanceSetting? settings)
    {
        var required = branch?.LocationRequired == true || settings?.LocationRequired == true;
        var hasCoordinates = input?.Latitude is >= -90 and <= 90 && input?.Longitude is >= -180 and <= 180;
        if (!hasCoordinates) return (required, false, false, required ? AttendanceLocationStatuses.PermissionDenied : AttendanceLocationStatuses.NotConfigured);
        if (input!.Accuracy is < 0 or > 10000) return (required, false, false, AttendanceLocationStatuses.PermissionDenied);
        if (branch?.Latitude is null || branch.Longitude is null) return (required, true, false, AttendanceLocationStatuses.NotConfigured);
        var radius = branch.AttendanceRadiusMeters > 0 ? branch.AttendanceRadiusMeters : settings?.DefaultRadiusMeters ?? 100;
        var latitude = input!.Latitude!.Value; var longitude = input.Longitude!.Value; var branchLatitude = branch.Latitude!.Value; var branchLongitude = branch.Longitude!.Value;
        var distance = DistanceInMeters((double)latitude, (double)longitude, (double)branchLatitude, (double)branchLongitude);
        var valid = distance <= radius;
        return (required, true, !valid && required, valid ? AttendanceLocationStatuses.Valid : AttendanceLocationStatuses.OutsideAllowedArea);
    }
    private static double DistanceInMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadius = 6371000; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180; var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2); return earthRadius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
