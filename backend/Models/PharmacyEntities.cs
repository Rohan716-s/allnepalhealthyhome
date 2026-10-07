namespace backend.Models;

public abstract class AuditedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Customer : AuditedEntity
{
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string Phone { get; set; }
    public string? Username { get; set; }
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public required string PasswordHash { get; set; }
    public bool IsActive { get; set; } = true;
    public string CustomerType { get; set; } = "RETAILER";
    public string AccountType { get; set; } = "PERSONAL";
    public string? TaxNumber { get; set; }
    public Guid? PartySectorId { get; set; }
    public decimal CreditLimit { get; set; }
    public int PaymentTermsDays { get; set; } = 30;
    public ICollection<Address> Addresses { get; set; } = [];
    public ICollection<Prescription> Prescriptions { get; set; } = [];
    public ICollection<WishlistItem> Wishlist { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public PharmacyDetails? PharmacyDetails { get; set; }
    public PartySector? PartySector { get; set; }
}

public sealed class PharmacyDetails : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public required string PanNumber { get; set; }
    public string? PanRegisteredName { get; set; }
    public string? PharmacyName { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Municipality { get; set; }
    public string? Ward { get; set; }
    public string? Address { get; set; }
    public string? DrugLicenseNumber { get; set; }
    public string? OwnerPhone { get; set; }
    public string? OwnerEmail { get; set; }
    public string? ContactPersonName { get; set; }
    public string? Telephone { get; set; }
    public string? Landmark { get; set; }
    public string? PharmacistRegistrationNumber { get; set; }
    public Guid? PreferredBranchId { get; set; }
    public string Category { get; set; } = "RETAIL";
    public string PanVerificationStatus { get; set; } = "MANUAL_FALLBACK";
    public DateTime? PanVerifiedAtUtc { get; set; }
    public string? PanVerificationSource { get; set; }
    public Customer? Customer { get; set; }
}

public sealed class StaffUser : AuditedEntity
{
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string Phone { get; set; }
    public required string PasswordHash { get; set; }
    public required string Role { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? BranchId { get; set; }
    public Guid? ShiftId { get; set; }
    public string? LicenseReference { get; set; }
    public string? EmployeeId { get; set; }
    public string? Address { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public string? AppointmentType { get; set; }
    public string? EmploymentStatus { get; set; }
    public string? OfficialEmail { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? MaritalStatus { get; set; }
    public string? TaxNumber { get; set; }
    public string? CitizenshipNumber { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? BloodGroup { get; set; }
    public string? DeviceEnrollmentId { get; set; }
    public bool MobileAccessEnabled { get; set; } = true;
    public bool WebAccessEnabled { get; set; } = true;
    /// <summary>
    /// The employee's opening/current basic salary. Approved salary revisions
    /// retain the historical record and supersede this baseline for payroll.
    /// </summary>
    public decimal CurrentBasicSalary { get; set; }
    public string? ProfilePhotoStoredFileName { get; set; }
    public string? ProfilePhotoContentType { get; set; }
    public string? PermissionsCsv { get; set; }
    public Branch? Branch { get; set; }
    public WorkShift? Shift { get; set; }
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<DeliveryAssignment> DeliveryAssignments { get; set; } = [];
    public RiderAvailability? RiderAvailability { get; set; }
    public ICollection<PharmacyOrder> AssignedOrders { get; set; } = [];
    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = [];
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = [];
    public ICollection<LeaveAllocation> LeaveAllocations { get; set; } = [];
    public ICollection<OvertimeRecord> OvertimeRecords { get; set; } = [];
    public ICollection<EmploymentMovement> EmploymentMovements { get; set; } = [];
    public ICollection<SalaryRevision> SalaryRevisions { get; set; } = [];
    public ICollection<PayrollRecord> PayrollRecords { get; set; } = [];
    public ICollection<SalesExecutiveProductAssignment> SalesExecutiveAssignments { get; set; } = [];
}

public sealed class SalesExecutiveProductAssignment : AuditedEntity
{
    public Guid SalesExecutiveUserId { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? CategoryId { get; set; }
    public bool IsActive { get; set; } = true;
    public StaffUser? SalesExecutiveUser { get; set; }
    public Product? Product { get; set; }
    public Category? Category { get; set; }
}

public sealed class WorkShift : AuditedEntity
{
    public required string Name { get; set; }
    public string ShiftType { get; set; } = "REGULAR";
    public TimeOnly StartTime { get; set; } = new(9, 0);
    public TimeOnly EndTime { get; set; } = new(17, 0);
    public int BreakDurationMinutes { get; set; } = 30;
    public int GracePeriodMinutes { get; set; } = 15;
    public int MinimumWorkingMinutes { get; set; } = 480;
    public int LateThresholdMinutes { get; set; } = 1;
    public int HalfDayThresholdMinutes { get; set; } = 270;
    public int OvertimeThresholdMinutes { get; set; } = 540;
    public string WeeklyOffDays { get; set; } = "SATURDAY";
    public bool IsActive { get; set; } = true;
    public ICollection<StaffUser> StaffUsers { get; set; } = [];
    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = [];
}

/// <summary>
/// Reusable HR and payroll master data.  The category separates the entries
/// into registers such as departments, leave types and salary components so
/// administrators can evolve policy without a deployment for every option.
/// </summary>
public sealed class HrmsSetupItem : AuditedEntity
{
    public required string Category { get; set; }
    public required string Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// A shared record model for operational HR work that does not belong to the
/// attendance or payroll ledger: notices, documents, visits, work logs,
/// appraisals and calendar events.
/// </summary>
public sealed class OfficeOperationRecord : AuditedEntity
{
    public required string Category { get; set; }
    public required string Title { get; set; }
    public string? Details { get; set; }
    public string Status { get; set; } = "DRAFT";
    public Guid? StaffUserId { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? Location { get; set; }
    public string? Audience { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? AttachmentUrl { get; set; }
    public StaffUser? StaffUser { get; set; }
}

public sealed class AttendanceSetting : AuditedEntity
{
    public int LateCheckInGraceMinutes { get; set; } = 15;
    public int EarlyCheckInGraceMinutes { get; set; } = 0;
    public int EarlyCheckOutGraceMinutes { get; set; } = 0;
    public int LateCheckOutGraceMinutes { get; set; } = 0;
    public int DefaultRadiusMeters { get; set; } = 100;
    public bool LocationRequired { get; set; } = true;
    public string BusinessTimeZone { get; set; } = "Asia/Kathmandu";
    public Guid? UpdatedByStaffUserId { get; set; }
}

public sealed class AttendanceRecord : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public DateTime WorkDate { get; set; }
    public DateTime? CheckInUtc { get; set; }
    public DateTime? CheckOutUtc { get; set; }
    public string Status { get; set; } = AttendanceStatuses.Present;
    public int TotalMinutes { get; set; }
    public int OvertimeMinutes { get; set; }
    public int LateMinutes { get; set; }
    public Guid? ShiftId { get; set; }
    public decimal? CheckInLatitude { get; set; }
    public decimal? CheckInLongitude { get; set; }
    public decimal? CheckInAccuracy { get; set; }
    public DateTime? CheckInLocationTimestampUtc { get; set; }
    public string? CheckInLocationStatus { get; set; }
    public string? CheckInLocationSource { get; set; }
    public decimal? CheckOutLatitude { get; set; }
    public decimal? CheckOutLongitude { get; set; }
    public decimal? CheckOutAccuracy { get; set; }
    public DateTime? CheckOutLocationTimestampUtc { get; set; }
    public string? CheckOutLocationStatus { get; set; }
    public string? CheckOutLocationSource { get; set; }
    public bool IsFinalized { get; set; }
    public StaffUser? StaffUser { get; set; }
    public WorkShift? Shift { get; set; }
}

public sealed class AttendanceCorrection : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public DateTime WorkDate { get; set; }
    public DateTime? RequestedCheckInUtc { get; set; }
    public DateTime? RequestedCheckOutUtc { get; set; }
    public required string Reason { get; set; }
    public string Status { get; set; } = AttendanceCorrectionStatuses.Pending;
    public Guid? ReviewedByStaffUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewComment { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? ReviewedByStaffUser { get; set; }
}

public sealed class LeaveRequest : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public required string LeaveType { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string DayType { get; set; } = LeaveDayTypes.FullDay;
    public decimal AppliedDays { get; set; } = 1m;
    public required string Reason { get; set; }
    public string? SupportingDocumentUrl { get; set; }
    public string Status { get; set; } = LeaveStatuses.Pending;
    public string? ApprovalComment { get; set; }
    public Guid? ApprovedByStaffUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? ApprovedByStaffUser { get; set; }
}

/// <summary>
/// Annual leave allocation and adjustments for one employee and leave type.
/// Balances are derived from this register plus approved leave records, rather
/// than being silently overwritten as requests are approved.
/// </summary>
public sealed class LeaveAllocation : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public required string LeaveType { get; set; }
    public int LeaveYear { get; set; }
    public decimal AllocatedDays { get; set; }
    public decimal CarryForwardDays { get; set; }
    public decimal AdjustmentDays { get; set; }
    public string? Notes { get; set; }
    public StaffUser? StaffUser { get; set; }
}

/// <summary>
/// An explicit overtime approval ledger. Attendance-derived overtime stays on
/// the attendance record; this entity captures approved payable overtime.
/// </summary>
public sealed class OvertimeRecord : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public DateTime WorkDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int TotalMinutes { get; set; }
    public required string OvertimeType { get; set; }
    public string Status { get; set; } = OvertimeStatuses.Pending;
    public string? Remarks { get; set; }
    public Guid? DecidedByStaffUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? DecisionComment { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? DecidedByStaffUser { get; set; }
}

/// <summary>
/// A controlled employee profile change. Promotion, branch transfer and shift
/// transfer remain pending until an HR administrator approves and applies it.
/// </summary>
public sealed class EmploymentMovement : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public required string MovementType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public Guid? PreviousBranchId { get; set; }
    public Guid? NewBranchId { get; set; }
    public Guid? PreviousShiftId { get; set; }
    public Guid? NewShiftId { get; set; }
    public string? PreviousDepartment { get; set; }
    public string? NewDepartment { get; set; }
    public string? PreviousJobTitle { get; set; }
    public string? NewJobTitle { get; set; }
    public required string Reason { get; set; }
    public string Status { get; set; } = EmploymentMovementStatuses.Pending;
    public Guid? DecidedByStaffUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? DecisionComment { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? DecidedByStaffUser { get; set; }
    public Branch? PreviousBranch { get; set; }
    public Branch? NewBranch { get; set; }
    public WorkShift? PreviousShift { get; set; }
    public WorkShift? NewShift { get; set; }
}

public sealed class PayrollRecord : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public DateTime PayrollMonth { get; set; }
    public decimal BasicSalary { get; set; }
    public decimal Allowances { get; set; }
    public decimal OvertimeAmount { get; set; }
    public decimal Bonus { get; set; }
    public decimal Deductions { get; set; }
    public decimal GrossSalary { get; set; }
    public decimal NetSalary { get; set; }
    public string Status { get; set; } = PayrollStatuses.Draft;
    public Guid? ApprovedByStaffUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentNotes { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? ApprovedByStaffUser { get; set; }
    public ICollection<PayrollComponentLine> Components { get; set; } = [];
}

/// <summary>
/// Flexible salary heads attached to one payroll record. Keeping line items
/// avoids schema churn when finance enables another allowance or deduction.
/// </summary>
public sealed class PayrollComponentLine : AuditedEntity
{
    public Guid PayrollRecordId { get; set; }
    public required string ComponentName { get; set; }
    public required string ComponentKind { get; set; }
    public decimal Amount { get; set; }
    public int DisplayOrder { get; set; }
    public PayrollRecord? PayrollRecord { get; set; }
}

/// <summary>
/// Auditable basic-salary change request. An approved revision is selected
/// by its effective date when a payroll record is prepared.
/// </summary>
public sealed class SalaryRevision : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public required string Title { get; set; }
    public required string RevisionType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public decimal PreviousBasicSalary { get; set; }
    public decimal RevisedBasicSalary { get; set; }
    public string? Reason { get; set; }
    public string? AttachmentUrl { get; set; }
    public string Status { get; set; } = SalaryRevisionStatuses.Pending;
    public Guid? DecidedByStaffUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? DecisionComment { get; set; }
    public StaffUser? StaffUser { get; set; }
    public StaffUser? DecidedByStaffUser { get; set; }
}

public sealed class AccessRole : AuditedEntity
{
    public required string Name { get; set; }
    public required string DisplayName { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsSystem { get; set; }
    public ICollection<AccessRolePermission> RolePermissions { get; set; } = [];
}

public sealed class AccessPermission : AuditedEntity
{
    public required string Key { get; set; }
    public required string Description { get; set; }
    public string Group { get; set; } = "general";
    public bool IsSystem { get; set; } = true;
    public ICollection<AccessRolePermission> RolePermissions { get; set; } = [];
}

public sealed class AccessRolePermission : AuditedEntity
{
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }
    public AccessRole? Role { get; set; }
    public AccessPermission? Permission { get; set; }
}

public sealed class Address : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public required string Label { get; set; }
    public required string Province { get; set; }
    public required string District { get; set; }
    public required string Municipality { get; set; }
    public required string Ward { get; set; }
    public required string StreetTole { get; set; }
    public string? Landmark { get; set; }
    public required string Phone { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool IsDefault { get; set; }
    public Customer? Customer { get; set; }
}

public sealed class Category : AuditedEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Medicine> Medicines { get; set; } = [];
}

public sealed class Brand : AuditedEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Product> Products { get; set; } = [];
}

public sealed class Manufacturer : AuditedEntity
{
    public required string Name { get; set; }
    public string? Country { get; set; }
    public ICollection<Medicine> Medicines { get; set; } = [];
}

public sealed class Medicine : AuditedEntity
{
    public required string Name { get; set; }
    public string? GenericName { get; set; }
    public string? Strength { get; set; }
    public string? DosageForm { get; set; }
    public string? Description { get; set; }
    public string? Uses { get; set; }
    public string? Warnings { get; set; }
    public string? SideEffects { get; set; }
    public string? StorageInformation { get; set; }
    public bool PrescriptionRequired { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? CategoryId { get; set; }
    public Guid? ManufacturerId { get; set; }
    public Category? Category { get; set; }
    public Manufacturer? Manufacturer { get; set; }
    public ICollection<Product> Products { get; set; } = [];
}

public sealed class Product : AuditedEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public required string Sku { get; set; }
    public decimal Mrp { get; set; }
    public decimal SellingPrice { get; set; }
    public string? ImageUrl { get; set; }
    /// <summary>The exact remote asset URL from which the managed image was obtained.</summary>
    public string? ImageSourceUrl { get; set; }
    public string? ImageSourceWebsite { get; set; }
    public string? ImageSourcePageUrl { get; set; }
    public string ImageVerificationStatus { get; set; } = "MISSING";
    public string? ImageSourceReference { get; set; }
    public DateTime? ImageSearchedAtUtc { get; set; }
    public string? ImageMatchingNotes { get; set; }
    /// <summary>Managed media asset backing <see cref="ImageUrl"/>, when the URL uses the media API.</summary>
    public Guid? ImageMediaAssetId { get; set; }
    public string? CompanyCode { get; set; }
    public string? CompanyName { get; set; }
    public decimal DemandScore { get; set; }
    public string DemandBasis { get; set; } = "NO_HISTORY";
    public string? DemandSourceUrl { get; set; }
    public string? DemandSourceReference { get; set; }
    public DateTime? DemandMeasuredAt { get; set; }
    public int DisplayOrder { get; set; }
    public string ImportStatus { get; set; } = "MANUAL";
    public string MissingImageStatus { get; set; } = "MISSING";
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Barcode { get; set; }
    public string? PackSize { get; set; }
    public decimal TaxRate { get; set; }
    public decimal DiscountPercent { get; set; }
    public string? BonusScheme { get; set; }
    public bool IsBestSeller { get; set; }
    public bool IsNewArrival { get; set; }
    public bool IsTrending { get; set; }
    public bool IsHotDeal { get; set; }
    public string? SearchKeywords { get; set; }
    public string BaseUnit { get; set; } = "piece";
    public string PurchaseUnit { get; set; } = "piece";
    public string SalesUnit { get; set; } = "piece";
    public int PurchaseUnitToBase { get; set; } = 1;
    public int SalesUnitToBase { get; set; } = 1;
    public int ReorderLevel { get; set; } = 5;
    public int MaximumStock { get; set; }
    public string? StorageLocation { get; set; }
    public Guid? RackId { get; set; }
    public string? Notes { get; set; }
    public Guid MedicineId { get; set; }
    public Guid BrandId { get; set; }
    public Medicine? Medicine { get; set; }
    public Brand? Brand { get; set; }
    public ProductRack? Rack { get; set; }
    public ICollection<Inventory> Inventory { get; set; } = [];
    public ICollection<ProductImage> Images { get; set; } = [];
    public ICollection<ProductReview> Reviews { get; set; } = [];
    public ICollection<ProductUnit> Units { get; set; } = [];
}

public sealed class ProductRackGroup : AuditedEntity
{
    public required string Name { get; set; }
    public string? Code { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<ProductRack> Racks { get; set; } = [];
}

public sealed class ProductRack : AuditedEntity
{
    public Guid RackGroupId { get; set; }
    public required string Name { get; set; }
    public string? Code { get; set; }
    public bool IsActive { get; set; } = true;
    public ProductRackGroup? RackGroup { get; set; }
    public ICollection<Product> Products { get; set; } = [];
}

public sealed class ProductImage : AuditedEntity
{
    public Guid ProductId { get; set; }
    public required string Url { get; set; }
    public int DisplayOrder { get; set; }
    public string? AltText { get; set; }
    public bool BackgroundRemoved { get; set; }
    public string? SourceUrl { get; set; }
    public string? SourceWebsite { get; set; }
    public string? SourcePageUrl { get; set; }
    public string VerificationStatus { get; set; } = "MISSING";
    public DateTime? SearchedAtUtc { get; set; }
    public string? MatchingNotes { get; set; }
    public string MissingImageStatus { get; set; } = "MISSING";
    public Guid? MediaAssetId { get; set; }
    public Product? Product { get; set; }
}

public sealed class ProductReview : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? OrderId { get; set; }
    public int Rating { get; set; }
    public required string Comment { get; set; }
    public string? Title { get; set; }
    public string Status { get; set; } = ReviewStatuses.Pending;
    public string? AdminResponse { get; set; }
    public DateTime? PublishedAt { get; set; }
    public Customer? Customer { get; set; }
    public Product? Product { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class SupportTicket : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public required string TicketNumber { get; set; }
    public required string Subject { get; set; }
    public required string Description { get; set; }
    public string Status { get; set; } = SupportTicketStatuses.Open;
    public string Priority { get; set; } = SupportTicketPriorities.Medium;
    public string? Category { get; set; }
    public string? Resolution { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Customer? Customer { get; set; }
    public StaffUser? AssignedStaff { get; set; }
    public ICollection<SupportTicketMessage> Messages { get; set; } = [];
}

public sealed class SupportTicketMessage : AuditedEntity
{
    public Guid SupportTicketId { get; set; }
    public Guid? StaffUserId { get; set; }
    public Guid? CustomerId { get; set; }
    public required string Message { get; set; }
    public bool IsInternal { get; set; }
    public SupportTicket? SupportTicket { get; set; }
    public StaffUser? StaffUser { get; set; }
    public Customer? Customer { get; set; }
}

public sealed class Branch : AuditedEntity
{
    public required string Name { get; set; }
    public required string Address { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Code { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Municipality { get; set; }
    public string? Ward { get; set; }
    public string? StreetTole { get; set; }
    public string? Landmark { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public int AttendanceRadiusMeters { get; set; } = 100;
    public bool LocationRequired { get; set; }
    public TimeOnly? OpeningTime { get; set; }
    public TimeOnly? ClosingTime { get; set; }
    public bool DeliveryEnabled { get; set; } = true;
    public bool PickupEnabled { get; set; } = true;
    public ICollection<Inventory> Inventory { get; set; } = [];
    public ICollection<StaffUser> StaffUsers { get; set; } = [];
}

public sealed class Inventory : AuditedEntity
{
    public Guid ProductId { get; set; }
    public Guid BranchId { get; set; }
    public int StockQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public required string BatchNumber { get; set; }
    public decimal PurchasePrice { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? ManufacturingDate { get; set; }
    public int MinimumStock { get; set; } = 5;
    public string? Supplier { get; set; }
    public Guid? SupplierId { get; set; }
    public Guid? PurchaseOrderId { get; set; }
    public string? PurchaseReference { get; set; }
    public int BonusQuantity { get; set; }
    public decimal? SellingPrice { get; set; }
    public decimal? Mrp { get; set; }
    public string BatchStatus { get; set; } = "ACTIVE";
    public Product? Product { get; set; }
    public Branch? Branch { get; set; }
    public Supplier? SupplierEntity { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
}

public sealed class Prescription : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public required string OriginalFileName { get; set; }
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long FileSizeBytes { get; set; }
    public required string FileSha256 { get; set; }
    public string Status { get; set; } = PrescriptionStatuses.Uploaded;
    public string? OcrProvider { get; set; }
    public string? OcrStatus { get; set; }
    public string? OcrText { get; set; }
    public string? CustomerNote { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public ICollection<PrescriptionStatusHistory> StatusHistory { get; set; } = [];
    public Customer? Customer { get; set; }
    public ICollection<PrescriptionExtractedItem> ExtractedItems { get; set; } = [];
    public ICollection<PrescriptionReview> Reviews { get; set; } = [];
}

public sealed class PrescriptionExtractedItem : AuditedEntity
{
    public Guid PrescriptionId { get; set; }
    public required string DetectedName { get; set; }
    public required string NormalizedName { get; set; }
    public string? Strength { get; set; }
    public string? DosageForm { get; set; }
    public string? Dosage { get; set; }
    public int? Quantity { get; set; }
    public string? Frequency { get; set; }
    public string? Duration { get; set; }
    public string? Timing { get; set; }
    public string? Instructions { get; set; }
    public bool CustomerEdited { get; set; }
    public Prescription? Prescription { get; set; }
    public ICollection<PrescriptionMedicineMatch> Matches { get; set; } = [];
}

public sealed class PrescriptionMedicineMatch : AuditedEntity
{
    public Guid PrescriptionExtractedItemId { get; set; }
    public Guid? ProductId { get; set; }
    public decimal Confidence { get; set; }
    public required string MatchType { get; set; }
    public required string Availability { get; set; }
    public int StockQuantity { get; set; }
    public bool NeedsPharmacistReview { get; set; }
    public PrescriptionExtractedItem? ExtractedItem { get; set; }
    public Product? Product { get; set; }
}

public sealed class PrescriptionReview : AuditedEntity
{
    public Guid PrescriptionId { get; set; }
    public required string Status { get; set; }
    public string? Notes { get; set; }
    public string? ReviewerId { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Prescription? Prescription { get; set; }
}

public sealed class PrescriptionStatusHistory : AuditedEntity
{
    public Guid PrescriptionId { get; set; }
    public required string Status { get; set; }
    public string? Note { get; set; }
    public string? ActorId { get; set; }
    public string? ActorRole { get; set; }
    public Prescription? Prescription { get; set; }
}

public sealed class WishlistItem : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid ProductId { get; set; }
    public Customer? Customer { get; set; }
    public Product? Product { get; set; }
}

public sealed class Cart : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public ICollection<CartItem> Items { get; set; } = [];
}

public sealed class CartItem : AuditedEntity
{
    public Guid CartId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public Cart? Cart { get; set; }
    public Product? Product { get; set; }
}

public sealed class PharmacyOrder : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? PharmacistId { get; set; }
    public Guid? SupervisorId { get; set; }
    public Guid? AssignedStaffUserId { get; set; }
    public Guid? DeliverySlotId { get; set; }
    public Guid? PrescriptionId { get; set; }
    public Guid? AddressId { get; set; }
    public required string OrderNumber { get; set; }
    public required string Status { get; set; }
    public required string PaymentStatus { get; set; }
    public string OrderMode { get; set; } = "SINGLE";
    public string PaymentMethod { get; set; } = PaymentMethods.CashOnDelivery;
    public decimal DeliveryFee { get; set; }
    public string? DeliveryInstructions { get; set; }
    public string? CustomerNotes { get; set; }
    public string? OrderCustomerName { get; set; }
    public string? OrderCustomerPhone { get; set; }
    public string? OrderCustomerEmail { get; set; }
    public string? CouponCode { get; set; }
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNumber { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal Total { get; set; }
    public Customer? Customer { get; set; }
    public Prescription? Prescription { get; set; }
    public Address? Address { get; set; }
    public Branch? Branch { get; set; }
    public StaffUser? Pharmacist { get; set; }
    public DeliverySlot? DeliverySlot { get; set; }
    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<OrderStatusHistory> StatusHistory { get; set; } = [];
    public ICollection<OrderAssignmentHistory> AssignmentHistory { get; set; } = [];
    public ICollection<OrderDocument> Documents { get; set; } = [];
    public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = [];
    public DeliveryAssignment? DeliveryAssignment { get; set; }
    public Invoice? Invoice { get; set; }
}

public sealed class PaymentTransaction : AuditedEntity
{
    public Guid OrderId { get; set; }
    public required string TransactionNumber { get; set; }
    public required string Method { get; set; }
    public required string Status { get; set; }
    public decimal Amount { get; set; }
    public string? ProviderReference { get; set; }
    public string? Notes { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? RefundedAt { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class Invoice : AuditedEntity
{
    public Guid OrderId { get; set; }
    public required string InvoiceNumber { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public decimal PaidAmount { get; set; }
    public DateTime? DueAt { get; set; }
    public string PaymentStatus { get; set; } = "UNPAID";
    public bool IsWholesale { get; set; } = true;
    public string? Notes { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class AccountantPayment : AuditedEntity
{
    public Guid? InvoiceId { get; set; }
    public Guid? SupplierInvoiceId { get; set; }
    public required string PaymentNumber { get; set; }
    public required string Method { get; set; }
    public string Status { get; set; } = "CLEARED";
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Invoice? Invoice { get; set; }
    public SupplierInvoice? SupplierInvoice { get; set; }
}

public sealed class CustomerLedgerEntry : AuditedEntity
{
    public Guid CustomerId { get; set; }
    public Guid? InvoiceId { get; set; }
    public Guid? PaymentId { get; set; }
    public required string EntryType { get; set; }
    public decimal Amount { get; set; }
    public DateTime EntryDate { get; set; }
    public DateTime? DueAt { get; set; }
    public required string Description { get; set; }
    public string? Reference { get; set; }
    public Customer? Customer { get; set; }
    public Invoice? Invoice { get; set; }
    public AccountantPayment? Payment { get; set; }
}

public sealed class SupplierInvoice : AuditedEntity
{
    public Guid SupplierId { get; set; }
    public Guid? PurchaseOrderId { get; set; }
    public Guid? BranchId { get; set; }
    public required string InvoiceNumber { get; set; }
    public DateTime InvoiceDate { get; set; }
    public DateTime? DueAt { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public string Status { get; set; } = "UNPAID";
    public string? Notes { get; set; }
    public Supplier? Supplier { get; set; }
    public Branch? Branch { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public ICollection<AccountantPayment> Payments { get; set; } = [];
}

public sealed class BusinessExpense : AuditedEntity
{
    public Guid? BranchId { get; set; }
    public required string Category { get; set; }
    public required string Description { get; set; }
    public decimal Amount { get; set; }
    public DateTime ExpenseDate { get; set; }
    public required string PaymentMethod { get; set; }
    public string? Reference { get; set; }
    public string Status { get; set; } = "RECORDED";
    public string? Notes { get; set; }
    public Branch? Branch { get; set; }
}

public sealed class BankReconciliation : AuditedEntity
{
    public Guid? BranchId { get; set; }
    public DateTime StatementDate { get; set; }
    public required string BankAccount { get; set; }
    public required string TransactionType { get; set; }
    public decimal Amount { get; set; }
    public required string Reference { get; set; }
    public string Status { get; set; } = "UNMATCHED";
    public string? MatchedSource { get; set; }
    public Guid? MatchedId { get; set; }
    public string? Notes { get; set; }
    public Branch? Branch { get; set; }
}

public sealed class TaxConfiguration : AuditedEntity
{
    public required string Name { get; set; }
    public decimal VatRate { get; set; } = 13m;
    public DateTime EffectiveFrom { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class JournalEntry : AuditedEntity
{
    public Guid? BranchId { get; set; }
    public DateTime EntryDate { get; set; }
    public required string Reference { get; set; }
    public required string Description { get; set; }
    public required string DebitAccount { get; set; }
    public required string CreditAccount { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "POSTED";
    public string? Notes { get; set; }
    public Branch? Branch { get; set; }
}

public sealed class CashHandover : AuditedEntity
{
    public required string HandoverNumber { get; set; }
    public Guid BranchId { get; set; }
    public Guid HandedByStaffUserId { get; set; }
    public Guid ReceivedByStaffUserId { get; set; }
    public DateTime HandoverAt { get; set; }
    public decimal Amount { get; set; }
    public required string Reference { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "POSTED";
    public Branch? Branch { get; set; }
    public StaffUser? HandedByStaffUser { get; set; }
    public StaffUser? ReceivedByStaffUser { get; set; }
}

public sealed class PartySector : AuditedEntity
{
    public required string Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Customer> Customers { get; set; } = [];
}

public sealed class ChartAccount : AuditedEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string AccountType { get; set; }
    public Guid? ParentAccountId { get; set; }
    public bool IsSubLedger { get; set; }
    public bool IsActive { get; set; } = true;
    public ChartAccount? ParentAccount { get; set; }
    public ICollection<ChartAccount> Children { get; set; } = [];
    public ICollection<AccountOpeningBalance> OpeningBalances { get; set; } = [];
}

public sealed class AccountOpeningBalance : AuditedEntity
{
    public Guid AccountId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? EnteredByStaffUserId { get; set; }
    public DateTime OpeningDate { get; set; }
    public decimal DebitAmount { get; set; }
    public decimal CreditAmount { get; set; }
    public required string Reference { get; set; }
    public string? Notes { get; set; }
    public ChartAccount? Account { get; set; }
    public Branch? Branch { get; set; }
    public StaffUser? EnteredByStaffUser { get; set; }
}

public sealed class OrderItem : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public required string ProductName { get; set; }
    public int Quantity { get; set; }
    public int BonusQuantity { get; set; }
    public string Unit { get; set; } = "base";
    public int UnitMultiplier { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public PharmacyOrder? Order { get; set; }
    public Product? Product { get; set; }
}

public sealed class OrderStatusHistory : AuditedEntity
{
    public Guid OrderId { get; set; }
    public required string Status { get; set; }
    public string? Note { get; set; }
    public string? ActorId { get; set; }
    public string? ActorRole { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class OrderAssignmentHistory : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid? ActorStaffUserId { get; set; }
    public required string ChangeType { get; set; }
    public string? PreviousValue { get; set; }
    public string? NewValue { get; set; }
    public string? Note { get; set; }
    public PharmacyOrder? Order { get; set; }
}

public sealed class OrderDocument : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid? UploadedByCustomerId { get; set; }
    public Guid? UploadedByStaffUserId { get; set; }
    public required string Kind { get; set; }
    public required string OriginalFileName { get; set; }
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long Length { get; set; }
    public required string Sha256 { get; set; }
    public PharmacyOrder? Order { get; set; }
    public Customer? UploadedByCustomer { get; set; }
    public StaffUser? UploadedByStaffUser { get; set; }
}

public sealed class Notification : AuditedEntity
{
    public Guid? CustomerId { get; set; }
    public Guid? StaffUserId { get; set; }
    public required string Type { get; set; }
    public required string Title { get; set; }
    public required string Body { get; set; }
    public DateTime? ReadAt { get; set; }
    public Customer? Customer { get; set; }
    public StaffUser? StaffUser { get; set; }
}

public sealed class NotificationTemplate : AuditedEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Channel { get; set; }
    public string? Subject { get; set; }
    public required string Body { get; set; }
    public string? Variables { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public sealed class DeliveryAssignment : AuditedEntity
{
    public Guid OrderId { get; set; }
    public Guid DeliveryStaffId { get; set; }
    public required string Status { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? PickedUpAt { get; set; }
    public DateTime? OutForDeliveryAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? FailedAt { get; set; }
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }
    public PharmacyOrder? Order { get; set; }
    public StaffUser? DeliveryStaff { get; set; }
    public DeliveryLocation? CurrentLocation { get; set; }
}

public sealed class DeliveryLocation : AuditedEntity
{
    public Guid DeliveryAssignmentId { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public decimal AccuracyMeters { get; set; }
    public DeliveryAssignment? DeliveryAssignment { get; set; }
}

public sealed class RiderAvailability : AuditedEntity
{
    public Guid StaffUserId { get; set; }
    public bool IsAvailable { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? AccuracyMeters { get; set; }
    public DateTime? LocationUpdatedAt { get; set; }
    public StaffUser? StaffUser { get; set; }
}

public sealed class StockTransaction : AuditedEntity
{
    public Guid InventoryId { get; set; }
    public required string Type { get; set; }
    public int Quantity { get; set; }
    public int QuantityBefore { get; set; }
    public int QuantityAfter { get; set; }
    public string? Note { get; set; }
    public Guid? BranchId { get; set; }
    public string Unit { get; set; } = "base";
    public string? ReferenceType { get; set; }
    public string? ReferenceId { get; set; }
    public string? Reason { get; set; }
    public string? BatchStatusBefore { get; set; }
    public string? BatchStatusAfter { get; set; }
    public Guid? ActorId { get; set; }
    public Inventory? Inventory { get; set; }
}

public sealed class ActivityLog : AuditedEntity
{
    public Guid? ActorId { get; set; }
    public string? ActorRole { get; set; }
    public required string Action { get; set; }
    public required string EntityType { get; set; }
    public required string EntityId { get; set; }
    public string? PreviousValue { get; set; }
    public string? NewValue { get; set; }
    public string? IpAddress { get; set; }
}

public sealed class SystemSetting : AuditedEntity
{
    public required string Key { get; set; }
    public required string Value { get; set; }
    public string Group { get; set; } = "general";
    public bool IsPublic { get; set; }
    public string? Description { get; set; }
}

public sealed class SystemBackup : AuditedEntity
{
    public required string FileName { get; set; }
    public required string Status { get; set; }
    public string Provider { get; set; } = "mysql";
    public long SizeBytes { get; set; }
    public string? Sha256 { get; set; }
    public string? FailureReason { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public sealed class PaymentMethodConfiguration : AuditedEntity
{
    public required string Code { get; set; }
    public required string DisplayName { get; set; }
    public string? Instructions { get; set; }
    public string? QrCodeUrl { get; set; }
    public decimal? MinimumOrder { get; set; }
    public decimal? MaximumOrder { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; }
    public bool RequiresServerVerification { get; set; }
}

public sealed class HomepageSection : AuditedEntity
{
    public required string SectionKey { get; set; }
    public required string Title { get; set; }
    public string? ContentJson { get; set; }
    public int DisplayOrder { get; set; }
    public bool Enabled { get; set; } = true;
}

public sealed class WebsiteAsset : AuditedEntity
{
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public string? Subtitle { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? MobileImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? ButtonText { get; set; }
    public string? Destination { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public int Priority { get; set; }
    public bool Enabled { get; set; } = true;
    public bool MobileEnabled { get; set; } = true;
    public bool DesktopEnabled { get; set; } = true;
    public string? SecondaryButtonText { get; set; }
    public string? SecondaryButtonUrl { get; set; }
    public int OverlayOpacity { get; set; } = 35;
    public string TextAlignment { get; set; } = "LEFT";
    public string ContentPosition { get; set; } = "CENTER";
    public string BackgroundPosition { get; set; } = "CENTER";
    public string? CustomLabel { get; set; }
    public string LayoutVariant { get; set; } = "STANDARD";
    public int TypingSpeedMs { get; set; } = 52;
    public string BackgroundColor { get; set; } = "#F8F6F1";
    public string AnimationType { get; set; } = "FADE_ZOOM";
    public int SlideDuration { get; set; } = 5000;
    public int TransitionDuration { get; set; } = 700;
    public bool AutoplayEnabled { get; set; } = true;
    public bool PauseOnHover { get; set; } = true;
    public bool ShowNavigationArrows { get; set; } = true;
    public bool ShowPaginationDots { get; set; } = true;
    public bool LoopSlides { get; set; } = true;
    public bool RandomizeSlides { get; set; }
    public bool RespectSchedule { get; set; } = true;
}

public sealed class NavigationMenuItem : AuditedEntity
{
    public required string MenuKey { get; set; }
    public required string Label { get; set; }
    public required string Url { get; set; }
    public Guid? ParentId { get; set; }
    public string? Icon { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsVisible { get; set; } = true;
    public bool OpenInNewTab { get; set; }
    public NavigationMenuItem? Parent { get; set; }
    public ICollection<NavigationMenuItem> Children { get; set; } = [];
}

public sealed class RoleSidebarMenuItem : AuditedEntity
{
    public required string Role { get; set; }
    public required string Label { get; set; }
    public required string Href { get; set; }
    public required string Icon { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsVisible { get; set; } = true;
}

public sealed class PopupCampaign : AuditedEntity
{
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? ButtonText { get; set; }
    public string? Destination { get; set; }
    public int DelaySeconds { get; set; } = 3;
    public string Frequency { get; set; } = "ONCE_PER_SESSION";
    public string Audience { get; set; } = "ALL";
    public bool MobileEnabled { get; set; } = true;
    public bool DesktopEnabled { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class SeoEntry : AuditedEntity
{
    public required string Scope { get; set; }
    public required string Path { get; set; }
    public string? Title { get; set; }
    public string? MetaDescription { get; set; }
    public string? Keywords { get; set; }
    public string? OgTitle { get; set; }
    public string? OgDescription { get; set; }
    public string? OgImageUrl { get; set; }
    public string? CanonicalUrl { get; set; }
    public string Robots { get; set; } = "index,follow";
    public bool IsActive { get; set; } = true;
}

public sealed class MediaAsset : AuditedEntity
{
    public required string OriginalFileName { get; set; }
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long Length { get; set; }
    public required string Sha256 { get; set; }
    public string Kind { get; set; } = "GENERAL";
    public string? AltText { get; set; }
    public bool IsPublic { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CmsPage : AuditedEntity
{
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public required string Content { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string? SeoTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime? PublishedAt { get; set; }
}

public sealed class HealthArticle : AuditedEntity
{
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public string? Excerpt { get; set; }
    public required string Content { get; set; }
    public string? Category { get; set; }
    public string? TagsCsv { get; set; }
    public string? AuthorName { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string? SeoTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public bool IsFeatured { get; set; }
}

public sealed class Faq : AuditedEntity
{
    public required string Question { get; set; }
    public required string Answer { get; set; }
    public string? Category { get; set; }
    public int DisplayOrder { get; set; }
    public bool Published { get; set; } = true;
}

public sealed class Supplier : AuditedEntity
{
    public required string Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Transporter : AuditedEntity
{
    public required string Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? VehicleNumber { get; set; }
    public string? LicenseNumber { get; set; }
    public string? ServiceArea { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class DeliveryZone : AuditedEntity
{
    public required string Name { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Municipality { get; set; }
    public string? Ward { get; set; }
    public Guid? BranchId { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal FreeDeliveryThreshold { get; set; }
    public decimal MinimumOrder { get; set; }
    public bool SameDayDelivery { get; set; }
    public bool Enabled { get; set; } = true;
    public Branch? Branch { get; set; }
}

public sealed class DeliverySlot : AuditedEntity
{
    public required string Label { get; set; }
    public required string StartTime { get; set; }
    public required string EndTime { get; set; }
    public Guid? BranchId { get; set; }
    public int? MaxOrders { get; set; }
    public int DisplayOrder { get; set; }
    public bool Enabled { get; set; } = true;
    public Branch? Branch { get; set; }
    public ICollection<PharmacyOrder> Orders { get; set; } = [];
}

public sealed class PurchaseOrder : AuditedEntity
{
    public required string OrderNumber { get; set; }
    public Guid SupplierId { get; set; }
    public Guid BranchId { get; set; }
    public string Status { get; set; } = PurchaseOrderStatuses.Draft;
    public string PaymentMethod { get; set; } = "CASH";
    public string PaymentStatus { get; set; } = "UNPAID";
    public DateTime? ExpectedAt { get; set; }
    public string? Notes { get; set; }
    public decimal TotalAmount { get; set; }
    public Supplier? Supplier { get; set; }
    public Branch? Branch { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = [];
}

public sealed class PurchaseOrderItem : AuditedEntity
{
    public Guid PurchaseOrderId { get; set; }
    public Guid ProductId { get; set; }
    public required string ProductName { get; set; }
    public int QuantityOrdered { get; set; }
    public int QuantityReceived { get; set; }
    public string Unit { get; set; } = "base";
    public int UnitMultiplier { get; set; } = 1;
    public decimal UnitCost { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public Product? Product { get; set; }
}

public sealed class Coupon : AuditedEntity
{
    public required string Code { get; set; }
    public string Type { get; set; } = "PERCENTAGE";
    public decimal Value { get; set; }
    public decimal? MinimumOrder { get; set; }
    public decimal? MaximumDiscount { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool FirstOrderOnly { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class FlashSale : AuditedEntity
{
    public required string Name { get; set; }
    public Guid ProductId { get; set; }
    public Guid? BranchId { get; set; }
    public decimal DiscountPercent { get; set; }
    public int? QuantityLimit { get; set; }
    public int QuantitySold { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public Product? Product { get; set; }
    public Branch? Branch { get; set; }
}

public static class PrescriptionStatuses
{
    public const string Uploaded = "Uploaded";
    public const string Scanning = "Scanning";
    public const string Scanned = "Scanned";
    public const string PendingPharmacistReview = "Pending Pharmacist Review";
    public const string UnderReview = "Under Review";
    public const string Approved = "Approved";
    public const string PartiallyApproved = "Partially Approved";
    public const string Rejected = "Rejected";
    public const string NeedClarification = "Need Clarification";
}

public static class StaffRoles
{
    public const string Pharmacist = "PHARMACIST";
    public const string Delivery = "DELIVERY";
    public const string Accountant = "ACCOUNTANT";
    public const string Admin = "ADMIN";
    public const string Supervisor = "SUPERVISOR";
    public const string SuperAdmin = "SUPERADMIN";
    public const string SalesExecutive = "SALES_EXECUTIVE";
    public const string SalesManager = "SALES_MANAGER";
    public const string PurchaseInventoryManager = "PURCHASE_INVENTORY_MANAGER";
    public const string HrManager = "HR_MANAGER";
    public const string ViewerAuditor = "VIEWER_AUDITOR";
    public const string Employee = "EMPLOYEE";
}

public static class AppPermissions
{
    public const string CatalogView = "catalog.view";
    public const string CatalogManage = "catalog.manage";
    public const string InventoryView = "inventory.view";
    public const string InventoryAdjust = "inventory.adjust";
    public const string InventoryValuationView = "inventory.valuation.view";
    public const string OrdersView = "orders.view";
    public const string OrdersManage = "orders.manage";
    public const string CustomersView = "customers.view";
    public const string CustomersManage = "customers.manage";
    public const string PrescriptionsView = "prescriptions.view";
    public const string PrescriptionsOverride = "prescriptions.override";
    public const string BranchesManage = "branches.manage";
    public const string WebsiteManage = "website.manage";
    public const string ReportsView = "reports.view";
    public const string AuditView = "audit.view";
    public const string SettingsManage = "settings.manage";
    public const string CouponsManage = "coupons.manage";
    public const string FlashSalesManage = "flash_sales.manage";
    public const string PurchaseOrdersManage = "purchase_orders.manage";
    public const string StaffManage = "staff.manage";
    public const string NotificationsView = "notifications.view";
    public const string NotificationsManage = "notifications.manage";
    public const string ReviewsManage = "reviews.manage";
    public const string SupportManage = "support.manage";
    public const string AttendanceSelf = "attendance.self";
    public const string AttendanceTeam = "attendance.team";
    public const string AttendanceAll = "attendance.all";
    public const string AttendanceManage = "attendance.manage";
    public const string HrmsView = "hrms.view";
    public const string HrmsManage = "hrms.manage";
    public const string AttendanceCorrect = "attendance.correct";
    public const string AttendanceApprove = "attendance.approve";
    public const string HrSettingsManage = "hr_settings.manage";
    public const string LeaveApply = "leave.apply";
    public const string LeaveView = "leave.view";
    public const string LeaveApprove = "leave.approve";
    public const string PayrollView = "payroll.view";
    public const string PayrollManage = "payroll.manage";
    public const string AccountsView = "accounts.view";
    public const string ExpensesManage = "expenses.manage";
    public const string FinanceInvoicesView = "finance.invoices.view";
    public const string FinanceInvoicesManage = "finance.invoices.manage";
    public const string FinancePaymentsManage = "finance.payments.manage";
    public const string FinanceLedgerView = "finance.ledger.view";
    public const string FinancePayablesManage = "finance.payables.manage";
    public const string FinanceReconciliationManage = "finance.reconciliation.manage";
    public const string FinanceTaxManage = "finance.tax.manage";
    public const string SalesAssignmentsManage = "sales_assignments.manage";

    public static IReadOnlyList<string> All =>
    [
        CatalogView, CatalogManage, InventoryView, InventoryAdjust, InventoryValuationView, OrdersView, OrdersManage,
        CustomersView, CustomersManage, PrescriptionsView, PrescriptionsOverride, BranchesManage, WebsiteManage,
        ReportsView, AuditView, SettingsManage, CouponsManage, FlashSalesManage, PurchaseOrdersManage, StaffManage, NotificationsView, NotificationsManage, ReviewsManage, SupportManage,
        AttendanceSelf, AttendanceTeam, AttendanceAll, AttendanceManage, HrmsView, HrmsManage, AttendanceCorrect, AttendanceApprove, HrSettingsManage, LeaveApply, LeaveView, LeaveApprove, PayrollView, PayrollManage, AccountsView, ExpensesManage,
        FinanceInvoicesView, FinanceInvoicesManage, FinancePaymentsManage, FinanceLedgerView, FinancePayablesManage, FinanceReconciliationManage, FinanceTaxManage, SalesAssignmentsManage
    ];

    public static IReadOnlySet<string> DefaultsFor(string role)
    {
        if (role.Equals(StaffRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Admin, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[]
        {
            CatalogView, CatalogManage, InventoryView, InventoryAdjust, InventoryValuationView, OrdersView, CustomersView, CustomersManage,
            PrescriptionsView, OrdersManage, BranchesManage, WebsiteManage, ReportsView, NotificationsView, NotificationsManage, ReviewsManage, SupportManage, FlashSalesManage, PurchaseOrdersManage,
            AttendanceSelf, AttendanceTeam, AttendanceAll, AttendanceManage, HrmsView, HrmsManage, AttendanceCorrect, AttendanceApprove, HrSettingsManage, LeaveApply, LeaveView, LeaveApprove, PayrollView, PayrollManage, AccountsView, ExpensesManage, StaffManage, SalesAssignmentsManage
        }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Supervisor, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[]
        {
            CatalogView, InventoryView, InventoryAdjust, OrdersView, CustomersView, PrescriptionsView, ReportsView, NotificationsView,
            AttendanceSelf, AttendanceTeam, HrmsView, AttendanceCorrect, AttendanceApprove, LeaveView, LeaveApprove
        }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Pharmacist, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[]
        {
            InventoryView, OrdersView, CustomersView, PrescriptionsView, AttendanceSelf, LeaveApply, LeaveView
        }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Delivery, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { AttendanceSelf, LeaveApply, LeaveView }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Accountant, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { AttendanceSelf, LeaveApply, LeaveView, InventoryView, InventoryValuationView, AccountsView, PayrollView, PayrollManage, ExpensesManage, ReportsView, FinanceInvoicesView, FinanceInvoicesManage, FinancePaymentsManage, FinanceLedgerView, FinancePayablesManage, FinanceReconciliationManage, FinanceTaxManage }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.SalesExecutive, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { CatalogView, OrdersView, OrdersManage, CustomersView, ReportsView }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.SalesManager, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { CatalogView, OrdersView, OrdersManage, CustomersView, CustomersManage, ReportsView, SalesAssignmentsManage }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.PurchaseInventoryManager, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { CatalogView, CatalogManage, InventoryView, InventoryAdjust, InventoryValuationView, PurchaseOrdersManage, BranchesManage, ReportsView }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.HrManager, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { HrmsView, HrmsManage, AttendanceTeam, AttendanceAll, AttendanceManage, AttendanceCorrect, AttendanceApprove, HrSettingsManage, LeaveView, LeaveApprove, PayrollView, ReportsView }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.ViewerAuditor, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { CatalogView, InventoryView, OrdersView, CustomersView, PrescriptionsView, ReportsView, AuditView }, StringComparer.OrdinalIgnoreCase);
        if (role.Equals(StaffRoles.Employee, StringComparison.OrdinalIgnoreCase)) return new HashSet<string>(new[] { AttendanceSelf, LeaveApply, LeaveView }, StringComparer.OrdinalIgnoreCase);
        return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    }
}

public static class AttendanceStatuses
{
    public const string Present = "PRESENT";
    public const string Late = "LATE";
    public const string CheckedOut = "CHECKED_OUT";
    public const string HalfDay = "HALF_DAY";
    public const string Absent = "ABSENT";
    public const string Leave = "LEAVE";
    public const string Holiday = "HOLIDAY";
    public const string Weekend = "WEEKEND";
}

public static class AttendanceLocationStatuses
{
    public const string Valid = "VALID";
    public const string OutsideAllowedArea = "OUTSIDE_ALLOWED_AREA";
    public const string NotConfigured = "NOT_CONFIGURED";
    public const string PermissionDenied = "PERMISSION_DENIED";
}

public static class AttendanceCorrectionStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class LeaveStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class LeaveDayTypes
{
    public const string FullDay = "FULL_DAY";
    public const string FirstHalf = "FIRST_HALF";
    public const string SecondHalf = "SECOND_HALF";
}

public static class OvertimeStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class EmploymentMovementStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class EmploymentMovementTypes
{
    public const string Promotion = "PROMOTION";
    public const string BranchTransfer = "BRANCH_TRANSFER";
    public const string ShiftTransfer = "SHIFT_TRANSFER";
    public const string PositionChange = "POSITION_CHANGE";
}

public static class PayrollStatuses
{
    public const string Draft = "DRAFT";
    public const string Approved = "APPROVED";
    public const string Paid = "PAID";
}

public static class PayrollComponentKinds
{
    public const string Earning = "EARNING";
    public const string Deduction = "DEDUCTION";
    public const string EmployerContribution = "EMPLOYER_CONTRIBUTION";
}

public static class SalaryRevisionStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
}

public static class PurchaseOrderStatuses
{
    public const string Draft = "DRAFT";
    public const string Sent = "SENT";
    public const string PartiallyReceived = "PARTIALLY_RECEIVED";
    public const string Received = "RECEIVED";
    public const string Cancelled = "CANCELLED";
}

public static class DeliveryStatuses
{
    public const string Assigned = "ASSIGNED_FOR_DELIVERY";
    public const string Accepted = "ACCEPTED";
    public const string PickedUp = "PICKED_UP";
    public const string OutForDelivery = "OUT_FOR_DELIVERY";
    public const string Delivered = "DELIVERED";
    public const string Failed = "FAILED";
}

public static class OrderStatuses
{
    public const string Pending = "PENDING";
    public const string PrescriptionVerification = "PRESCRIPTION_VERIFICATION";
    public const string Confirmed = "CONFIRMED";
    public const string Preparing = "PREPARING";
    public const string ReadyForPickup = "READY_FOR_PICKUP";
    public const string AssignedForDelivery = "ASSIGNED_FOR_DELIVERY";
    public const string OutForDelivery = "OUT_FOR_DELIVERY";
    public const string Delivered = "DELIVERED";
    public const string Cancelled = "CANCELLED";
    public const string Failed = "FAILED";
    public const string Rejected = "REJECTED";
}

public static class PaymentMethods
{
    public const string CashOnDelivery = "CASH_ON_DELIVERY";
    public const string Khalti = "KHALTI";
    public const string Esewa = "ESEWA";
    public const string BankTransfer = "BANK_TRANSFER";
    public static IReadOnlyList<string> Supported => [CashOnDelivery, Khalti, Esewa, BankTransfer];
}

public static class PaymentTransactionStatuses
{
    public const string Pending = "PENDING";
    public const string Paid = "PAID";
    public const string Failed = "FAILED";
    public const string Refunded = "REFUNDED";
}

public static class ReviewStatuses
{
    public const string Pending = "PENDING";
    public const string Published = "PUBLISHED";
    public const string Rejected = "REJECTED";
    public const string Hidden = "HIDDEN";
}

public static class SupportTicketStatuses
{
    public const string Open = "OPEN";
    public const string InProgress = "IN_PROGRESS";
    public const string WaitingOnCustomer = "WAITING_ON_CUSTOMER";
    public const string Resolved = "RESOLVED";
    public const string Closed = "CLOSED";
}

public static class SupportTicketPriorities
{
    public const string Low = "LOW";
    public const string Medium = "MEDIUM";
    public const string High = "HIGH";
    public const string Urgent = "URGENT";
}

public static class StockTransactionTypes
{
    public const string OpeningStock = "OPENING_STOCK";
    public const string Purchase = "PURCHASE";
    public const string PurchaseReturn = "PURCHASE_RETURN";
    public const string Sale = "SALE";
    public const string SalesReturn = "SALES_RETURN";
    public const string Reservation = "RESERVATION";
    public const string Release = "RELEASE";
    public const string Adjustment = "ADJUSTMENT";
    public const string Expired = "EXPIRED";
    public const string Damage = "DAMAGE";
    public const string Return = "RETURN";
    public const string TransferOut = "TRANSFER_OUT";
    public const string TransferIn = "TRANSFER_IN";
    public const string VoidReversal = "VOID_REVERSAL";
    public const string Expiry = "EXPIRY";
    public const string Other = "OTHER";
}

public static class MatchAvailability
{
    public const string Available = "AVAILABLE";
    public const string PartiallyAvailable = "PARTIALLY_AVAILABLE";
    public const string OutOfStock = "OUT_OF_STOCK";
    public const string NotFound = "NOT_FOUND";
    public const string NeedsReview = "NEEDS_REVIEW";
}
