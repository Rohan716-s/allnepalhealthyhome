using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<SystemCheck> SystemChecks => Set<SystemCheck>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<PharmacyDetails> PharmacyDetails => Set<PharmacyDetails>();
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();
    public DbSet<SalesExecutiveProductAssignment> SalesExecutiveProductAssignments => Set<SalesExecutiveProductAssignment>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<WorkShift> WorkShifts => Set<WorkShift>();
    public DbSet<HrmsSetupItem> HrmsSetupItems => Set<HrmsSetupItem>();
    public DbSet<OfficeOperationRecord> OfficeOperationRecords => Set<OfficeOperationRecord>();
    public DbSet<LeaveAllocation> LeaveAllocations => Set<LeaveAllocation>();
    public DbSet<OvertimeRecord> OvertimeRecords => Set<OvertimeRecord>();
    public DbSet<EmploymentMovement> EmploymentMovements => Set<EmploymentMovement>();
    public DbSet<SalaryRevision> SalaryRevisions => Set<SalaryRevision>();
    public DbSet<AttendanceSetting> AttendanceSettings => Set<AttendanceSetting>();
    public DbSet<AttendanceCorrection> AttendanceCorrections => Set<AttendanceCorrection>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<PayrollRecord> PayrollRecords => Set<PayrollRecord>();
    public DbSet<PayrollComponentLine> PayrollComponentLines => Set<PayrollComponentLine>();
    public DbSet<AccessRole> AccessRoles => Set<AccessRole>();
    public DbSet<AccessPermission> AccessPermissions => Set<AccessPermission>();
    public DbSet<AccessRolePermission> AccessRolePermissions => Set<AccessRolePermission>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Manufacturer> Manufacturers => Set<Manufacturer>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductRackGroup> ProductRackGroups => Set<ProductRackGroup>();
    public DbSet<ProductRack> ProductRacks => Set<ProductRack>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Inventory> Inventory => Set<Inventory>();
    public DbSet<ProductUnit> ProductUnits => Set<ProductUnit>();
    public DbSet<StockCount> StockCounts => Set<StockCount>();
    public DbSet<StockCountLine> StockCountLines => Set<StockCountLine>();
    public DbSet<InventoryTransfer> InventoryTransfers => Set<InventoryTransfer>();
    public DbSet<InventoryTransferItem> InventoryTransferItems => Set<InventoryTransferItem>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionExtractedItem> PrescriptionExtractedItems => Set<PrescriptionExtractedItem>();
    public DbSet<PrescriptionMedicineMatch> PrescriptionMedicineMatches => Set<PrescriptionMedicineMatch>();
    public DbSet<PrescriptionReview> PrescriptionReviews => Set<PrescriptionReview>();
    public DbSet<PrescriptionStatusHistory> PrescriptionStatusHistory => Set<PrescriptionStatusHistory>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<PharmacyOrder> Orders => Set<PharmacyOrder>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<OrderAssignmentHistory> OrderAssignmentHistory => Set<OrderAssignmentHistory>();
    public DbSet<OrderDocument> OrderDocuments => Set<OrderDocument>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<AccountantPayment> AccountantPayments => Set<AccountantPayment>();
    public DbSet<CustomerLedgerEntry> CustomerLedgerEntries => Set<CustomerLedgerEntry>();
    public DbSet<SupplierInvoice> SupplierInvoices => Set<SupplierInvoice>();
    public DbSet<BusinessExpense> BusinessExpenses => Set<BusinessExpense>();
    public DbSet<BankReconciliation> BankReconciliations => Set<BankReconciliation>();
    public DbSet<TaxConfiguration> TaxConfigurations => Set<TaxConfiguration>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<CashHandover> CashHandovers => Set<CashHandover>();
    public DbSet<PartySector> PartySectors => Set<PartySector>();
    public DbSet<ChartAccount> ChartAccounts => Set<ChartAccount>();
    public DbSet<AccountOpeningBalance> AccountOpeningBalances => Set<AccountOpeningBalance>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();
    public DbSet<DeliveryAssignment> DeliveryAssignments => Set<DeliveryAssignment>();
    public DbSet<DeliveryLocation> DeliveryLocations => Set<DeliveryLocation>();
    public DbSet<RiderAvailability> RiderAvailabilities => Set<RiderAvailability>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<SystemBackup> SystemBackups => Set<SystemBackup>();
    public DbSet<PaymentMethodConfiguration> PaymentMethodConfigurations => Set<PaymentMethodConfiguration>();
    public DbSet<HomepageSection> HomepageSections => Set<HomepageSection>();
    public DbSet<WebsiteAsset> WebsiteAssets => Set<WebsiteAsset>();
    public DbSet<NavigationMenuItem> NavigationMenuItems => Set<NavigationMenuItem>();
    public DbSet<RoleSidebarMenuItem> RoleSidebarMenuItems => Set<RoleSidebarMenuItem>();
    public DbSet<PopupCampaign> PopupCampaigns => Set<PopupCampaign>();
    public DbSet<SeoEntry> SeoEntries => Set<SeoEntry>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<CmsPage> CmsPages => Set<CmsPage>();
    public DbSet<HealthArticle> HealthArticles => Set<HealthArticle>();
    public DbSet<Faq> Faqs => Set<Faq>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Transporter> Transporters => Set<Transporter>();
    public DbSet<DeliveryZone> DeliveryZones => Set<DeliveryZone>();
    public DbSet<DeliverySlot> DeliverySlots => Set<DeliverySlot>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<FlashSale> FlashSales => Set<FlashSale>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<PurchaseReturn> PurchaseReturns => Set<PurchaseReturn>();
    public DbSet<PurchaseReturnItem> PurchaseReturnItems => Set<PurchaseReturnItem>();
    public DbSet<CustomerCredit> CustomerCredits => Set<CustomerCredit>();
    public DbSet<SaleReturn> SaleReturns => Set<SaleReturn>();
    public DbSet<SaleReturnItem> SaleReturnItems => Set<SaleReturnItem>();
    public DbSet<CustomerPayment> CustomerPayments => Set<CustomerPayment>();
    public DbSet<SupplierPayment> SupplierPayments => Set<SupplierPayment>();
    public DbSet<ContactWidgetLink> ContactWidgetLinks => Set<ContactWidgetLink>();
    public DbSet<TrustBadge> TrustBadges => Set<TrustBadge>();
    public DbSet<AssistantChatSession> AssistantChatSessions => Set<AssistantChatSession>();
    public DbSet<AssistantChatMessage> AssistantChatMessages => Set<AssistantChatMessage>();
    public DbSet<MessageConversation> MessageConversations => Set<MessageConversation>();
    public DbSet<MessageParticipant> MessageParticipants => Set<MessageParticipant>();
    public DbSet<PlatformMessage> PlatformMessages => Set<PlatformMessage>();
    public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
    public DbSet<MessagingRoleSetting> MessagingRoleSettings => Set<MessagingRoleSetting>();
    public DbSet<CustomerManufacturerDiscount> CustomerManufacturerDiscounts => Set<CustomerManufacturerDiscount>();
    public DbSet<SupplierManufacturerDiscount> SupplierManufacturerDiscounts => Set<SupplierManufacturerDiscount>();
    public DbSet<SalesTemplate> SalesTemplates => Set<SalesTemplate>();
    public DbSet<SalesTemplateLine> SalesTemplateLines => Set<SalesTemplateLine>();
    public DbSet<PharmacySalesBudget> PharmacySalesBudgets => Set<PharmacySalesBudget>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemCheck>(entity =>
        {
            entity.ToTable("system_checks");
            entity.HasKey(check => check.Id);
            entity.Property(check => check.Name).HasMaxLength(100).IsRequired();
            entity.Property(check => check.CreatedAt).HasColumnType("datetime(6)");
        });

        ConfigureAudited(modelBuilder.Entity<Customer>(), "customers");
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.Property(x => x.FullName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(80);
            entity.Property(x => x.Gender).HasMaxLength(40);
            entity.Property(x => x.DateOfBirth).HasColumnType("date");
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(x => x.CustomerType).HasMaxLength(30).IsRequired();
            entity.Property(x => x.AccountType).HasColumnName("account_type").HasMaxLength(20).HasDefaultValue("PERSONAL").IsRequired();
            entity.HasIndex(x => x.PartySectorId);
            entity.Property(x => x.TaxNumber).HasMaxLength(80);
            entity.Property(x => x.CreditLimit).HasPrecision(14, 2);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Phone);
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.AccountType);
            entity.HasOne(x => x.PharmacyDetails).WithOne(x => x.Customer).HasForeignKey<PharmacyDetails>(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.PartySector).WithMany(x => x.Customers).HasForeignKey(x => x.PartySectorId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<PharmacyDetails>(), "pharmacy_details");
        modelBuilder.Entity<PharmacyDetails>(entity =>
        {
            entity.Property(x => x.PanNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.PanRegisteredName).HasMaxLength(240);
            entity.Property(x => x.PharmacyName).HasMaxLength(240);
            entity.Property(x => x.Province).HasMaxLength(120);
            entity.Property(x => x.District).HasMaxLength(120);
            entity.Property(x => x.Municipality).HasMaxLength(160);
            entity.Property(x => x.Ward).HasMaxLength(30);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.DrugLicenseNumber).HasMaxLength(120);
            entity.Property(x => x.OwnerPhone).HasMaxLength(30);
            entity.Property(x => x.OwnerEmail).HasMaxLength(240);
            entity.Property(x => x.ContactPersonName).HasMaxLength(160);
            entity.Property(x => x.Telephone).HasMaxLength(30);
            entity.Property(x => x.Landmark).HasMaxLength(240);
            entity.Property(x => x.PharmacistRegistrationNumber).HasMaxLength(120);
            entity.Property(x => x.Category).HasMaxLength(30).IsRequired();
            entity.Property(x => x.PanVerificationStatus).HasMaxLength(40).IsRequired();
            entity.Property(x => x.PanVerificationSource).HasMaxLength(80);
            entity.HasIndex(x => x.CustomerId).IsUnique();
            entity.HasIndex(x => x.PanNumber).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<StaffUser>(), "staff_users");
        modelBuilder.Entity<StaffUser>(entity =>
        {
            entity.Property(x => x.FullName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(40).IsRequired();
            entity.Property(x => x.LicenseReference).HasMaxLength(120);
            entity.Property(x => x.EmployeeId).HasMaxLength(80);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.Department).HasMaxLength(160);
            entity.Property(x => x.JobTitle).HasMaxLength(160);
            entity.Property(x => x.AppointmentType).HasMaxLength(100);
            entity.Property(x => x.EmploymentStatus).HasMaxLength(100);
            entity.Property(x => x.OfficialEmail).HasMaxLength(240);
            entity.Property(x => x.DateOfBirth).HasColumnType("date");
            entity.Property(x => x.Gender).HasMaxLength(40);
            entity.Property(x => x.MaritalStatus).HasMaxLength(40);
            entity.Property(x => x.TaxNumber).HasMaxLength(80);
            entity.Property(x => x.CitizenshipNumber).HasMaxLength(100);
            entity.Property(x => x.EmergencyContactName).HasMaxLength(160);
            entity.Property(x => x.EmergencyContactPhone).HasMaxLength(30);
            entity.Property(x => x.BloodGroup).HasMaxLength(10);
            entity.Property(x => x.DeviceEnrollmentId).HasMaxLength(100);
            entity.Property(x => x.CurrentBasicSalary).HasPrecision(14, 2);
            entity.Property(x => x.ProfilePhotoStoredFileName).HasMaxLength(120);
            entity.Property(x => x.ProfilePhotoContentType).HasMaxLength(80);
            entity.HasIndex(x => x.EmployeeId).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Role);
            entity.HasOne(x => x.Branch).WithMany(x => x.StaffUsers).HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Shift).WithMany(x => x.StaffUsers).HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<SalesExecutiveProductAssignment>(), "sales_executive_product_assignments");
        modelBuilder.Entity<SalesExecutiveProductAssignment>(entity =>
        {
            entity.HasIndex(x => new { x.SalesExecutiveUserId, x.ProductId, x.CategoryId }).IsUnique();
            entity.HasIndex(x => new { x.SalesExecutiveUserId, x.IsActive });
            entity.HasIndex(x => new { x.ProductId, x.IsActive });
            entity.HasIndex(x => new { x.CategoryId, x.IsActive });
            entity.ToTable(table => table.HasCheckConstraint("CK_sales_executive_assignment_single_target", "((ProductId IS NOT NULL AND CategoryId IS NULL) OR (ProductId IS NULL AND CategoryId IS NOT NULL))"));
            entity.HasOne(x => x.SalesExecutiveUser).WithMany(x => x.SalesExecutiveAssignments).HasForeignKey(x => x.SalesExecutiveUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<AttendanceRecord>(), "attendance_records");
        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.WorkDate).HasColumnType("date");
            entity.Property(x => x.CheckInUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.CheckOutUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.CheckInLatitude).HasPrecision(10, 7);
            entity.Property(x => x.CheckInLongitude).HasPrecision(10, 7);
            entity.Property(x => x.CheckInAccuracy).HasPrecision(10, 2);
            entity.Property(x => x.CheckOutLatitude).HasPrecision(10, 7);
            entity.Property(x => x.CheckOutLongitude).HasPrecision(10, 7);
            entity.Property(x => x.CheckOutAccuracy).HasPrecision(10, 2);
            entity.Property(x => x.CheckInLocationStatus).HasMaxLength(40);
            entity.Property(x => x.CheckOutLocationStatus).HasMaxLength(40);
            entity.Property(x => x.CheckInLocationSource).HasMaxLength(40);
            entity.Property(x => x.CheckOutLocationSource).HasMaxLength(40);
            entity.HasOne(x => x.Shift).WithMany(x => x.AttendanceRecords).HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(x => new { x.StaffUserId, x.WorkDate }).IsUnique();
            entity.HasOne(x => x.StaffUser).WithMany(x => x.AttendanceRecords).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<WorkShift>(), "work_shifts");
        modelBuilder.Entity<WorkShift>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ShiftType).HasMaxLength(30).IsRequired();
            entity.Property(x => x.WeeklyOffDays).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => x.Name).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<HrmsSetupItem>(), "hrms_setup_items");
        modelBuilder.Entity<HrmsSetupItem>(entity =>
        {
            entity.Property(x => x.Category).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(60);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.Category, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.Category, x.DisplayOrder });
        });
        ConfigureAudited(modelBuilder.Entity<OfficeOperationRecord>(), "office_operation_records");
        modelBuilder.Entity<OfficeOperationRecord>(entity =>
        {
            entity.Property(x => x.Category).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Details).HasMaxLength(4000);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Location).HasMaxLength(300);
            entity.Property(x => x.Audience).HasMaxLength(60);
            entity.Property(x => x.ReferenceNumber).HasMaxLength(100);
            entity.Property(x => x.AttachmentUrl).HasMaxLength(1000);
            entity.Property(x => x.StartsAt).HasColumnType("datetime(6)");
            entity.Property(x => x.EndsAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.Category, x.Status, x.StartsAt });
            entity.HasIndex(x => new { x.StaffUserId, x.Category });
            entity.HasOne(x => x.StaffUser).WithMany().HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<AttendanceSetting>(), "attendance_settings");
        modelBuilder.Entity<AttendanceSetting>(entity =>
        {
            entity.Property(x => x.BusinessTimeZone).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Id).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<AttendanceCorrection>(), "attendance_corrections");
        modelBuilder.Entity<AttendanceCorrection>(entity =>
        {
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.ReviewComment).HasMaxLength(1000);
            entity.Property(x => x.WorkDate).HasColumnType("date");
            entity.Property(x => x.RequestedCheckInUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.RequestedCheckOutUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.ReviewedAtUtc).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.StaffUserId, x.WorkDate, x.Status });
            entity.HasOne(x => x.StaffUser).WithMany().HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ReviewedByStaffUser).WithMany().HasForeignKey(x => x.ReviewedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<LeaveRequest>(), "leave_requests");
        modelBuilder.Entity<LeaveRequest>(entity =>
        {
            entity.Property(x => x.LeaveType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.DayType).HasMaxLength(20).IsRequired();
            entity.Property(x => x.AppliedDays).HasPrecision(6, 2);
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.SupportingDocumentUrl).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.ApprovalComment).HasMaxLength(1000);
            entity.Property(x => x.StartDate).HasColumnType("date");
            entity.Property(x => x.EndDate).HasColumnType("date");
            entity.HasIndex(x => new { x.StaffUserId, x.StartDate, x.EndDate });
            entity.HasOne(x => x.StaffUser).WithMany(x => x.LeaveRequests).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ApprovedByStaffUser).WithMany().HasForeignKey(x => x.ApprovedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<LeaveAllocation>(), "leave_allocations");
        modelBuilder.Entity<LeaveAllocation>(entity =>
        {
            entity.Property(x => x.LeaveType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.AllocatedDays).HasPrecision(6, 2);
            entity.Property(x => x.CarryForwardDays).HasPrecision(6, 2);
            entity.Property(x => x.AdjustmentDays).HasPrecision(6, 2);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.StaffUserId, x.LeaveType, x.LeaveYear }).IsUnique();
            entity.HasOne(x => x.StaffUser).WithMany(x => x.LeaveAllocations).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<OvertimeRecord>(), "overtime_records");
        modelBuilder.Entity<OvertimeRecord>(entity =>
        {
            entity.Property(x => x.WorkDate).HasColumnType("date");
            entity.Property(x => x.StartTime).HasColumnType("time");
            entity.Property(x => x.EndTime).HasColumnType("time");
            entity.Property(x => x.OvertimeType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Remarks).HasMaxLength(1000);
            entity.Property(x => x.DecisionComment).HasMaxLength(1000);
            entity.Property(x => x.DecidedAtUtc).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.StaffUserId, x.WorkDate, x.Status });
            entity.HasOne(x => x.StaffUser).WithMany(x => x.OvertimeRecords).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DecidedByStaffUser).WithMany().HasForeignKey(x => x.DecidedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<EmploymentMovement>(), "employment_movements");
        modelBuilder.Entity<EmploymentMovement>(entity =>
        {
            entity.Property(x => x.MovementType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.EffectiveDate).HasColumnType("date");
            entity.Property(x => x.PreviousDepartment).HasMaxLength(160);
            entity.Property(x => x.NewDepartment).HasMaxLength(160);
            entity.Property(x => x.PreviousJobTitle).HasMaxLength(160);
            entity.Property(x => x.NewJobTitle).HasMaxLength(160);
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.DecisionComment).HasMaxLength(1000);
            entity.Property(x => x.DecidedAtUtc).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.StaffUserId, x.EffectiveDate, x.MovementType });
            entity.HasOne(x => x.StaffUser).WithMany(x => x.EmploymentMovements).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DecidedByStaffUser).WithMany().HasForeignKey(x => x.DecidedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PreviousBranch).WithMany().HasForeignKey(x => x.PreviousBranchId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.NewBranch).WithMany().HasForeignKey(x => x.NewBranchId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PreviousShift).WithMany().HasForeignKey(x => x.PreviousShiftId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.NewShift).WithMany().HasForeignKey(x => x.NewShiftId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<PayrollRecord>(), "payroll_records");
        modelBuilder.Entity<PayrollRecord>(entity =>
        {
            entity.Property(x => x.PayrollMonth).HasColumnType("date");
            entity.Property(x => x.BasicSalary).HasPrecision(14, 2);
            entity.Property(x => x.Allowances).HasPrecision(14, 2);
            entity.Property(x => x.OvertimeAmount).HasPrecision(14, 2);
            entity.Property(x => x.Bonus).HasPrecision(14, 2);
            entity.Property(x => x.Deductions).HasPrecision(14, 2);
            entity.Property(x => x.GrossSalary).HasPrecision(14, 2);
            entity.Property(x => x.NetSalary).HasPrecision(14, 2);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.ApprovedAtUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.PaidAtUtc).HasColumnType("datetime(6)");
            entity.Property(x => x.PaymentMethod).HasMaxLength(80);
            entity.Property(x => x.PaymentReference).HasMaxLength(160);
            entity.Property(x => x.PaymentNotes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.StaffUserId, x.PayrollMonth }).IsUnique();
            entity.HasOne(x => x.StaffUser).WithMany(x => x.PayrollRecords).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ApprovedByStaffUser).WithMany().HasForeignKey(x => x.ApprovedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<PayrollComponentLine>(), "payroll_component_lines");
        modelBuilder.Entity<PayrollComponentLine>(entity =>
        {
            entity.Property(x => x.ComponentName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ComponentKind).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(14, 2);
            entity.HasIndex(x => new { x.PayrollRecordId, x.DisplayOrder });
            entity.HasOne(x => x.PayrollRecord).WithMany(x => x.Components).HasForeignKey(x => x.PayrollRecordId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<SalaryRevision>(), "salary_revisions");
        modelBuilder.Entity<SalaryRevision>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(180).IsRequired();
            entity.Property(x => x.RevisionType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.EffectiveDate).HasColumnType("date");
            entity.Property(x => x.PreviousBasicSalary).HasPrecision(14, 2);
            entity.Property(x => x.RevisedBasicSalary).HasPrecision(14, 2);
            entity.Property(x => x.Reason).HasMaxLength(1000);
            entity.Property(x => x.AttachmentUrl).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.DecisionComment).HasMaxLength(1000);
            entity.Property(x => x.DecidedAtUtc).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.StaffUserId, x.EffectiveDate, x.Status });
            entity.HasOne(x => x.StaffUser).WithMany(x => x.SalaryRevisions).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DecidedByStaffUser).WithMany().HasForeignKey(x => x.DecidedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<AccessRole>(), "access_roles");
        modelBuilder.Entity<AccessRole>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(60).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => x.Name).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<AccessPermission>(), "access_permissions");
        modelBuilder.Entity<AccessPermission>(entity =>
        {
            entity.Property(x => x.Key).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Group).HasMaxLength(80).IsRequired();
            entity.HasIndex(x => x.Key).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<AccessRolePermission>(), "access_role_permissions");
        modelBuilder.Entity<AccessRolePermission>(entity =>
        {
            entity.HasIndex(x => new { x.RoleId, x.PermissionId }).IsUnique();
            entity.HasOne(x => x.Role).WithMany(x => x.RolePermissions).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Permission).WithMany(x => x.RolePermissions).HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<Address>(), "addresses");
        modelBuilder.Entity<Address>(entity =>
        {
            entity.Property(x => x.Label).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Province).HasMaxLength(120).IsRequired();
            entity.Property(x => x.District).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Municipality).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Ward).HasMaxLength(30).IsRequired();
            entity.Property(x => x.StreetTole).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Landmark).HasMaxLength(240);
            entity.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.HasOne(x => x.Customer).WithMany(x => x.Addresses).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<Category>(), "categories");
        modelBuilder.Entity<Category>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(180).IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<Brand>(), "brands");
        modelBuilder.Entity<Brand>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(180).IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<Manufacturer>(), "manufacturers");
        modelBuilder.Entity<Manufacturer>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Country).HasMaxLength(120);
        });

        ConfigureAudited(modelBuilder.Entity<Medicine>(), "medicines");
        modelBuilder.Entity<Medicine>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.GenericName).HasMaxLength(200);
            entity.Property(x => x.Strength).HasMaxLength(80);
            entity.Property(x => x.DosageForm).HasMaxLength(80);
            entity.HasIndex(x => x.Name);
            entity.HasIndex(x => x.GenericName);
            entity.HasOne(x => x.Category).WithMany(x => x.Medicines).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Manufacturer).WithMany(x => x.Medicines).HasForeignKey(x => x.ManufacturerId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<Product>(), "products");
        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Sku).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Mrp).HasPrecision(12, 2);
            entity.Property(x => x.SellingPrice).HasPrecision(12, 2);
            entity.Property(x => x.BonusScheme).HasMaxLength(120);
            entity.Property(x => x.CompanyCode).HasMaxLength(80);
            entity.Property(x => x.CompanyName).HasMaxLength(240);
            entity.Property(x => x.ImageSourceUrl).HasMaxLength(1000);
            entity.Property(x => x.ImageSourceWebsite).HasMaxLength(240);
            entity.Property(x => x.ImageSourcePageUrl).HasMaxLength(1000);
            entity.Property(x => x.ImageVerificationStatus).HasMaxLength(40).IsRequired().HasDefaultValue("MISSING");
            entity.Property(x => x.ImageSourceReference).HasMaxLength(500);
            entity.Property(x => x.ImageMatchingNotes).HasMaxLength(2000);
            entity.HasIndex(x => x.ImageMediaAssetId);
            entity.Property(x => x.DemandScore).HasPrecision(5, 2);
            entity.Property(x => x.DemandBasis).HasMaxLength(80).IsRequired().HasDefaultValue("NO_HISTORY");
            entity.Property(x => x.DemandSourceUrl).HasMaxLength(1000);
            entity.Property(x => x.DemandSourceReference).HasMaxLength(500);
            entity.Property(x => x.ImportStatus).HasMaxLength(40).IsRequired().HasDefaultValue("MANUAL");
            entity.Property(x => x.MissingImageStatus).HasMaxLength(40).IsRequired().HasDefaultValue("MISSING");
            entity.Property(x => x.BaseUnit).HasMaxLength(40).IsRequired().HasDefaultValue("piece");
            entity.Property(x => x.PurchaseUnit).HasMaxLength(40).IsRequired().HasDefaultValue("piece");
            entity.Property(x => x.SalesUnit).HasMaxLength(40).IsRequired().HasDefaultValue("piece");
            entity.Property(x => x.PurchaseUnitToBase).HasDefaultValue(1);
            entity.Property(x => x.SalesUnitToBase).HasDefaultValue(1);
            entity.Property(x => x.ReorderLevel).HasDefaultValue(5);
            entity.Property(x => x.StorageLocation).HasMaxLength(160);
            entity.HasIndex(x => x.RackId);
            entity.HasOne(x => x.Rack).WithMany(x => x.Products).HasForeignKey(x => x.RackId).OnDelete(DeleteBehavior.SetNull);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.Barcode);
            entity.HasIndex(x => x.ReorderLevel);
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.HasIndex(x => x.IsHotDeal);
            entity.HasIndex(x => new { x.IsActive, x.DemandScore, x.DisplayOrder });
            entity.HasIndex(x => new { x.CompanyCode, x.CompanyName });
            entity.HasOne(x => x.Medicine).WithMany(x => x.Products).HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Brand).WithMany(x => x.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<ProductRackGroup>(), "product_rack_groups");
        modelBuilder.Entity<ProductRackGroup>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(40);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.Name });
        });
        ConfigureAudited(modelBuilder.Entity<ProductRack>(), "product_racks");
        modelBuilder.Entity<ProductRack>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(40);
            entity.HasIndex(x => new { x.RackGroupId, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.RackGroupId, x.Name });
            entity.HasOne(x => x.RackGroup).WithMany(x => x.Racks).HasForeignKey(x => x.RackGroupId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<ProductUnit>(), "product_units");
        modelBuilder.Entity<ProductUnit>(entity =>
        {
            entity.Property(x => x.UnitName).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => new { x.ProductId, x.UnitName }).IsUnique();
            entity.HasOne(x => x.Product).WithMany(x => x.Units).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<ProductReview>(), "product_reviews");
        modelBuilder.Entity<ProductReview>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(160);
            entity.Property(x => x.Comment).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.AdminResponse).HasMaxLength(2000);
            entity.HasIndex(x => new { x.ProductId, x.Status, x.CreatedAt });
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Product).WithMany(x => x.Reviews).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<SupportTicket>(), "support_tickets");
        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.Property(x => x.TicketNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Priority).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80);
            entity.Property(x => x.Resolution).HasMaxLength(4000);
            entity.HasIndex(x => x.TicketNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.Priority, x.CreatedAt });
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.AssignedStaff).WithMany().HasForeignKey(x => x.AssignedStaffId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<SupportTicketMessage>(), "support_ticket_messages");
        modelBuilder.Entity<SupportTicketMessage>(entity =>
        {
            entity.Property(x => x.Message).HasMaxLength(4000).IsRequired();
            entity.HasIndex(x => new { x.SupportTicketId, x.CreatedAt });
            entity.HasOne(x => x.SupportTicket).WithMany(x => x.Messages).HasForeignKey(x => x.SupportTicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.StaffUser).WithMany().HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<Branch>(), "branches");
        modelBuilder.Entity<Branch>(entity => entity.Property(x => x.Name).HasMaxLength(160).IsRequired());

        ConfigureAudited(modelBuilder.Entity<Inventory>(), "inventory");
        modelBuilder.Entity<Inventory>(entity =>
        {
            entity.Property(x => x.BatchNumber).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PurchasePrice).HasPrecision(12, 2);
            entity.Property(x => x.Supplier).HasMaxLength(200);
            entity.Property(x => x.PurchaseReference).HasMaxLength(160);
            entity.Property(x => x.BatchStatus).HasMaxLength(30).IsRequired().HasDefaultValue("ACTIVE");
            entity.Property(x => x.SellingPrice).HasPrecision(12, 2);
            entity.Property(x => x.Mrp).HasPrecision(12, 2);
            entity.HasIndex(x => x.ExpiryDate);
            entity.HasIndex(x => x.BatchNumber);
            entity.HasIndex(x => new { x.ProductId, x.BranchId, x.BatchNumber }).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.BatchStatus, x.ExpiryDate });
            entity.HasOne(x => x.Product).WithMany(x => x.Inventory).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch).WithMany(x => x.Inventory).HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SupplierEntity).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PurchaseOrder).WithMany().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<StockCount>(), "stock_counts");
        modelBuilder.Entity<StockCount>(entity =>
        {
            entity.Property(x => x.CountNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Scope).HasMaxLength(80);
            entity.Property(x => x.CategoryFilter).HasMaxLength(160);
            entity.Property(x => x.LocationFilter).HasMaxLength(160);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.CountNumber).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.Status, x.CreatedAt });
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.FinalizedByStaffUser).WithMany().HasForeignKey(x => x.FinalizedByStaffId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<StockCountLine>(), "stock_count_lines");
        modelBuilder.Entity<StockCountLine>(entity =>
        {
            entity.Property(x => x.VarianceValue).HasPrecision(12, 2);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.HasIndex(x => new { x.StockCountId, x.InventoryId }).IsUnique();
            entity.HasOne(x => x.StockCount).WithMany(x => x.Lines).HasForeignKey(x => x.StockCountId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Inventory).WithMany().HasForeignKey(x => x.InventoryId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<InventoryTransfer>(), "inventory_transfers");
        modelBuilder.Entity<InventoryTransfer>(entity =>
        {
            entity.Property(x => x.TransferNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => x.TransferNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasOne(x => x.SourceBranch).WithMany().HasForeignKey(x => x.SourceBranchId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.TargetBranch).WithMany().HasForeignKey(x => x.TargetBranchId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.DispatchedByStaffUser).WithMany().HasForeignKey(x => x.DispatchedByStaffId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.ReceivedByStaffUser).WithMany().HasForeignKey(x => x.ReceivedByStaffId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<InventoryTransferItem>(), "inventory_transfer_items");
        modelBuilder.Entity<InventoryTransferItem>(entity =>
        {
            entity.Property(x => x.BatchNumber).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PurchasePrice).HasPrecision(12, 2);
            entity.HasIndex(x => new { x.InventoryTransferId, x.ProductId, x.BatchNumber }).IsUnique();
            entity.HasOne(x => x.InventoryTransfer).WithMany(x => x.Items).HasForeignKey(x => x.InventoryTransferId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SourceInventory).WithMany().HasForeignKey(x => x.SourceInventoryId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<Prescription>(), "prescriptions");
        modelBuilder.Entity<Prescription>(entity =>
        {
            entity.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.StoredFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(120).IsRequired();
            entity.Property(x => x.FileSha256).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.OcrProvider).HasMaxLength(80);
            entity.Property(x => x.OcrStatus).HasMaxLength(80);
            entity.HasIndex(x => new { x.CustomerId, x.CreatedAt });
            entity.HasOne(x => x.Customer).WithMany(x => x.Prescriptions).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<PrescriptionExtractedItem>(), "prescription_extracted_items");
        modelBuilder.Entity<PrescriptionExtractedItem>(entity =>
        {
            entity.Property(x => x.DetectedName).HasMaxLength(220).IsRequired();
            entity.Property(x => x.NormalizedName).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Strength).HasMaxLength(80);
            entity.Property(x => x.DosageForm).HasMaxLength(80);
            entity.Property(x => x.Dosage).HasMaxLength(160);
            entity.Property(x => x.Frequency).HasMaxLength(160);
            entity.Property(x => x.Duration).HasMaxLength(160);
            entity.Property(x => x.Timing).HasMaxLength(160);
            entity.HasOne(x => x.Prescription).WithMany(x => x.ExtractedItems).HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<PrescriptionMedicineMatch>(), "prescription_medicine_matches");
        modelBuilder.Entity<PrescriptionMedicineMatch>(entity =>
        {
            entity.Property(x => x.Confidence).HasPrecision(5, 2);
            entity.Property(x => x.MatchType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Availability).HasMaxLength(40).IsRequired();
            entity.HasOne(x => x.ExtractedItem).WithMany(x => x.Matches).HasForeignKey(x => x.PrescriptionExtractedItemId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<PrescriptionReview>(), "prescription_reviews");
        modelBuilder.Entity<PrescriptionReview>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.ReviewerId).HasMaxLength(120);
            entity.HasOne(x => x.Prescription).WithMany(x => x.Reviews).HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<PrescriptionStatusHistory>(), "prescription_status_history");
        modelBuilder.Entity<PrescriptionStatusHistory>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.ActorId).HasMaxLength(120);
            entity.Property(x => x.ActorRole).HasMaxLength(40);
            entity.HasIndex(x => new { x.PrescriptionId, x.CreatedAt });
            entity.HasOne(x => x.Prescription).WithMany(x => x.StatusHistory).HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<WishlistItem>(), "wishlist_items");
        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.HasIndex(x => new { x.CustomerId, x.ProductId }).IsUnique();
            entity.HasOne(x => x.Customer).WithMany(x => x.Wishlist).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<Cart>(), "carts");
        modelBuilder.Entity<Cart>(entity => entity.HasIndex(x => x.CustomerId).IsUnique());
        ConfigureAudited(modelBuilder.Entity<CartItem>(), "cart_items");
        modelBuilder.Entity<CartItem>(entity =>
        {
            entity.HasIndex(x => new { x.CartId, x.ProductId }).IsUnique();
            entity.HasOne(x => x.Cart).WithMany(x => x.Items).HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<PharmacyOrder>(), "pharmacy_orders");
        modelBuilder.Entity<PharmacyOrder>(entity =>
        {
            entity.Property(x => x.OrderNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PaymentStatus).HasMaxLength(80).IsRequired();
            entity.Property(x => x.OrderMode).HasMaxLength(20).HasDefaultValue("SINGLE").IsRequired();
            entity.Property(x => x.PaymentMethod).HasMaxLength(80).IsRequired();
            entity.Property(x => x.DeliveryInstructions).HasMaxLength(1000);
            entity.Property(x => x.CustomerNotes).HasMaxLength(1000);
            entity.Property(x => x.OrderCustomerName).HasMaxLength(160);
            entity.Property(x => x.OrderCustomerPhone).HasMaxLength(30);
            entity.Property(x => x.OrderCustomerEmail).HasMaxLength(240);
            entity.Property(x => x.CouponCode).HasMaxLength(80);
            entity.Property(x => x.InsuranceProvider).HasMaxLength(160);
            entity.Property(x => x.InsurancePolicyNumber).HasMaxLength(120);
            entity.HasIndex(x => new { x.BranchId, x.CreatedAt, x.Status });
            entity.Property(x => x.DeliveryFee).HasPrecision(12, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(12, 2);
            entity.Property(x => x.Total).HasPrecision(12, 2);
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Pharmacist).WithMany(x => x.AssignedOrders).HasForeignKey(x => x.PharmacistId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DeliverySlot).WithMany(x => x.Orders).HasForeignKey(x => x.DeliverySlotId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Prescription).WithMany().HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Address).WithMany().HasForeignKey(x => x.AddressId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<OrderItem>(), "order_items");
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(x => x.ProductName).HasMaxLength(220).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(12, 2);
            entity.Property(x => x.Unit).HasMaxLength(40).IsRequired().HasDefaultValue("base");
            entity.HasOne(x => x.Order).WithMany(x => x.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<OrderStatusHistory>(), "order_status_history");
        modelBuilder.Entity<OrderStatusHistory>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.ActorId).HasMaxLength(120);
            entity.Property(x => x.ActorRole).HasMaxLength(40);
            entity.HasOne(x => x.Order).WithMany(x => x.StatusHistory).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<OrderAssignmentHistory>(), "order_assignment_history");
        modelBuilder.Entity<OrderAssignmentHistory>(entity =>
        {
            entity.Property(x => x.ChangeType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.PreviousValue).HasMaxLength(2000);
            entity.Property(x => x.NewValue).HasMaxLength(2000);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.OrderId, x.CreatedAt });
            entity.HasOne(x => x.Order).WithMany(x => x.AssignmentHistory).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<OrderDocument>(), "order_documents");
        modelBuilder.Entity<OrderDocument>(entity =>
        {
            entity.Property(x => x.Kind).HasMaxLength(40).IsRequired();
            entity.Property(x => x.OriginalFileName).HasMaxLength(240).IsRequired();
            entity.Property(x => x.StoredFileName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Sha256).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => new { x.OrderId, x.Kind, x.CreatedAt });
            entity.HasOne(x => x.Order).WithMany(x => x.Documents).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.UploadedByCustomer).WithMany().HasForeignKey(x => x.UploadedByCustomerId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.UploadedByStaffUser).WithMany().HasForeignKey(x => x.UploadedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<PaymentTransaction>(), "payment_transactions");
        modelBuilder.Entity<PaymentTransaction>(entity =>
        {
            entity.Property(x => x.TransactionNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Method).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(12, 2);
            entity.Property(x => x.ProviderReference).HasMaxLength(160);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.TransactionNumber).IsUnique();
            entity.HasIndex(x => new { x.OrderId, x.CreatedAt });
            entity.HasOne(x => x.Order).WithMany(x => x.PaymentTransactions).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<Invoice>(), "invoices");
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.Property(x => x.InvoiceNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Subtotal).HasPrecision(12, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(12, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(12, 2);
            entity.Property(x => x.DeliveryFee).HasPrecision(12, 2);
            entity.Property(x => x.Total).HasPrecision(12, 2);
            entity.Property(x => x.PaidAmount).HasPrecision(12, 2);
            entity.Property(x => x.PaymentStatus).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.DueAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.HasOne(x => x.Order).WithOne(x => x.Invoice).HasForeignKey<Invoice>(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<AccountantPayment>(), "accountant_payments");
        modelBuilder.Entity<AccountantPayment>(entity =>
        {
            entity.Property(x => x.PaymentNumber).HasMaxLength(60).IsRequired(); entity.Property(x => x.Method).HasMaxLength(30).IsRequired(); entity.Property(x => x.Status).HasMaxLength(30).IsRequired(); entity.Property(x => x.Amount).HasPrecision(14, 2); entity.Property(x => x.Reference).HasMaxLength(160); entity.Property(x => x.Notes).HasMaxLength(1000); entity.Property(x => x.PaymentDate).HasColumnType("datetime(6)"); entity.HasIndex(x => x.PaymentNumber).IsUnique(); entity.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.SetNull); entity.HasOne(x => x.SupplierInvoice).WithMany(x => x.Payments).HasForeignKey(x => x.SupplierInvoiceId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<CustomerLedgerEntry>(), "customer_ledger_entries");
        modelBuilder.Entity<CustomerLedgerEntry>(entity => { entity.Property(x => x.EntryType).HasMaxLength(20).IsRequired(); entity.Property(x => x.Amount).HasPrecision(14, 2); entity.Property(x => x.Description).HasMaxLength(300).IsRequired(); entity.Property(x => x.Reference).HasMaxLength(160); entity.Property(x => x.EntryDate).HasColumnType("datetime(6)"); entity.Property(x => x.DueAt).HasColumnType("datetime(6)"); entity.HasIndex(x => new { x.CustomerId, x.EntryDate }); entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade); entity.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.SetNull); entity.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.SetNull); });
        ConfigureAudited(modelBuilder.Entity<SupplierInvoice>(), "supplier_invoices");
        modelBuilder.Entity<SupplierInvoice>(entity => { entity.Property(x => x.InvoiceNumber).HasMaxLength(80).IsRequired(); entity.Property(x => x.Subtotal).HasPrecision(14, 2); entity.Property(x => x.TaxAmount).HasPrecision(14, 2); entity.Property(x => x.Total).HasPrecision(14, 2); entity.Property(x => x.PaidAmount).HasPrecision(14, 2); entity.Property(x => x.Status).HasMaxLength(30).IsRequired(); entity.Property(x => x.Notes).HasMaxLength(1000); entity.HasIndex(x => new { x.SupplierId, x.InvoiceNumber }).IsUnique(); entity.HasIndex(x => x.PurchaseOrderId); entity.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict); entity.HasOne(x => x.PurchaseOrder).WithMany().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.SetNull); });
        ConfigureAudited(modelBuilder.Entity<BusinessExpense>(), "business_expenses");
        modelBuilder.Entity<BusinessExpense>(entity => { entity.Property(x => x.Category).HasMaxLength(80).IsRequired(); entity.Property(x => x.Description).HasMaxLength(300).IsRequired(); entity.Property(x => x.Amount).HasPrecision(14, 2); entity.Property(x => x.PaymentMethod).HasMaxLength(30).IsRequired(); entity.Property(x => x.Reference).HasMaxLength(160); entity.Property(x => x.Status).HasMaxLength(30).IsRequired(); entity.Property(x => x.Notes).HasMaxLength(1000); entity.HasIndex(x => x.ExpenseDate); });
        ConfigureAudited(modelBuilder.Entity<BankReconciliation>(), "bank_reconciliations");
        modelBuilder.Entity<BankReconciliation>(entity => { entity.Property(x => x.BankAccount).HasMaxLength(120).IsRequired(); entity.Property(x => x.TransactionType).HasMaxLength(20).IsRequired(); entity.Property(x => x.Amount).HasPrecision(14, 2); entity.Property(x => x.Reference).HasMaxLength(160).IsRequired(); entity.Property(x => x.Status).HasMaxLength(30).IsRequired(); entity.Property(x => x.MatchedSource).HasMaxLength(80); entity.Property(x => x.Notes).HasMaxLength(1000); entity.HasIndex(x => new { x.StatementDate, x.Status }); });
        ConfigureAudited(modelBuilder.Entity<TaxConfiguration>(), "tax_configurations");
        modelBuilder.Entity<TaxConfiguration>(entity => { entity.Property(x => x.Name).HasMaxLength(80).IsRequired(); entity.Property(x => x.VatRate).HasPrecision(6, 2); entity.Property(x => x.EffectiveFrom).HasColumnType("datetime(6)"); entity.HasIndex(x => new { x.IsActive, x.EffectiveFrom }); });
        ConfigureAudited(modelBuilder.Entity<JournalEntry>(), "journal_entries");
        modelBuilder.Entity<JournalEntry>(entity => { entity.Property(x => x.Reference).HasMaxLength(80).IsRequired(); entity.Property(x => x.Description).HasMaxLength(300).IsRequired(); entity.Property(x => x.DebitAccount).HasMaxLength(120).IsRequired(); entity.Property(x => x.CreditAccount).HasMaxLength(120).IsRequired(); entity.Property(x => x.Amount).HasPrecision(14, 2); entity.Property(x => x.Status).HasMaxLength(30).IsRequired(); entity.Property(x => x.Notes).HasMaxLength(1000); entity.HasIndex(x => new { x.EntryDate, x.Status }); });

        ConfigureAudited(modelBuilder.Entity<CashHandover>(), "cash_handovers");
        modelBuilder.Entity<CashHandover>(entity =>
        {
            entity.Property(x => x.HandoverNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.HandoverAt).HasColumnType("datetime(6)");
            entity.Property(x => x.Amount).HasPrecision(14, 2);
            entity.Property(x => x.Reference).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => x.HandoverNumber).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.HandoverAt });
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.HandedByStaffUser).WithMany().HasForeignKey(x => x.HandedByStaffUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReceivedByStaffUser).WithMany().HasForeignKey(x => x.ReceivedByStaffUserId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<PartySector>(), "party_sectors");
        modelBuilder.Entity<PartySector>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(40);
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => x.IsActive);
        });
        ConfigureAudited(modelBuilder.Entity<ChartAccount>(), "chart_accounts");
        modelBuilder.Entity<ChartAccount>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.AccountType).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.AccountType, x.IsActive });
            entity.HasOne(x => x.ParentAccount).WithMany(x => x.Children).HasForeignKey(x => x.ParentAccountId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<AccountOpeningBalance>(), "account_opening_balances");
        modelBuilder.Entity<AccountOpeningBalance>(entity =>
        {
            entity.Property(x => x.OpeningDate).HasColumnType("date");
            entity.Property(x => x.DebitAmount).HasPrecision(14, 2);
            entity.Property(x => x.CreditAmount).HasPrecision(14, 2);
            entity.Property(x => x.Reference).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.AccountId, x.OpeningDate });
            entity.HasIndex(x => new { x.BranchId, x.OpeningDate });
            entity.HasOne(x => x.Account).WithMany(x => x.OpeningBalances).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.EnteredByStaffUser).WithMany().HasForeignKey(x => x.EnteredByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });

        ConfigureAudited(modelBuilder.Entity<Notification>(), "notifications");
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(x => x.Type).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Body).HasMaxLength(1000).IsRequired();
            entity.HasIndex(x => new { x.CustomerId, x.CreatedAt });
            entity.HasIndex(x => new { x.StaffUserId, x.CreatedAt });
            entity.HasOne(x => x.Customer).WithMany(x => x.Notifications).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.StaffUser).WithMany(x => x.Notifications).HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<NotificationTemplate>(), "notification_templates");
        modelBuilder.Entity<NotificationTemplate>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Channel).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(240);
            entity.Property(x => x.Body).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Variables).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.Channel, x.IsEnabled });
        });

        ConfigureAudited(modelBuilder.Entity<DeliveryAssignment>(), "delivery_assignments");
        modelBuilder.Entity<DeliveryAssignment>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.FailureReason).HasMaxLength(240);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.HasIndex(x => new { x.DeliveryStaffId, x.Status });
            entity.HasOne(x => x.Order).WithOne(x => x.DeliveryAssignment).HasForeignKey<DeliveryAssignment>(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DeliveryStaff).WithMany(x => x.DeliveryAssignments).HasForeignKey(x => x.DeliveryStaffId).OnDelete(DeleteBehavior.Restrict);
        });

        ConfigureAudited(modelBuilder.Entity<DeliveryLocation>(), "delivery_locations");
        modelBuilder.Entity<DeliveryLocation>(entity =>
        {
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.Property(x => x.AccuracyMeters).HasPrecision(8, 2);
            entity.HasIndex(x => x.DeliveryAssignmentId).IsUnique();
            entity.HasOne(x => x.DeliveryAssignment).WithOne(x => x.CurrentLocation)
                .HasForeignKey<DeliveryLocation>(x => x.DeliveryAssignmentId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<RiderAvailability>(), "rider_availabilities");
        modelBuilder.Entity<RiderAvailability>(entity =>
        {
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.Property(x => x.AccuracyMeters).HasPrecision(8, 2);
            entity.HasIndex(x => x.StaffUserId).IsUnique();
            entity.HasIndex(x => new { x.IsAvailable, x.LocationUpdatedAt });
            entity.HasOne(x => x.StaffUser).WithOne(x => x.RiderAvailability)
                .HasForeignKey<RiderAvailability>(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<StockTransaction>(), "stock_transactions");
        modelBuilder.Entity<StockTransaction>(entity =>
        {
            entity.Property(x => x.Type).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.Unit).HasMaxLength(40).IsRequired().HasDefaultValue("base");
            entity.Property(x => x.ReferenceType).HasMaxLength(80);
            entity.Property(x => x.ReferenceId).HasMaxLength(120);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.BatchStatusBefore).HasMaxLength(30);
            entity.Property(x => x.BatchStatusAfter).HasMaxLength(30);
            entity.HasIndex(x => new { x.InventoryId, x.CreatedAt });
            entity.HasIndex(x => new { x.BranchId, x.Type, x.CreatedAt });
            entity.HasIndex(x => new { x.ReferenceType, x.ReferenceId });
            entity.HasOne(x => x.Inventory).WithMany().HasForeignKey(x => x.InventoryId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<ActivityLog>(), "activity_logs");
        modelBuilder.Entity<ActivityLog>(entity =>
        {
            entity.Property(x => x.Action).HasMaxLength(120).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(120).IsRequired();
            entity.Property(x => x.ActorRole).HasMaxLength(40);
            // Audit payloads can contain complete before/after snapshots (for
            // example, a role sidebar with many menu items). Keep them in a
            // text column instead of truncating otherwise valid audit events.
            entity.Property(x => x.PreviousValue).HasColumnType("longtext");
            entity.Property(x => x.NewValue).HasColumnType("longtext");
            entity.Property(x => x.IpAddress).HasMaxLength(80);
            entity.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt });
        });

        modelBuilder.Entity<StaffUser>().Property(x => x.PermissionsCsv).HasMaxLength(4000);
        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(x => x.Barcode).HasMaxLength(80);
            entity.Property(x => x.PackSize).HasMaxLength(80);
            entity.Property(x => x.TaxRate).HasPrecision(6, 2);
            entity.Property(x => x.DiscountPercent).HasPrecision(6, 2);
            entity.Property(x => x.SearchKeywords).HasMaxLength(1000);
            entity.HasIndex(x => x.Barcode);
        });
        ConfigureAudited(modelBuilder.Entity<ProductImage>(), "product_images");
        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.Property(x => x.Url).HasMaxLength(500).IsRequired();
            entity.Property(x => x.AltText).HasMaxLength(240);
            entity.Property(x => x.BackgroundRemoved).HasDefaultValue(false);
            entity.Property(x => x.SourceUrl).HasMaxLength(1000);
            entity.Property(x => x.SourceWebsite).HasMaxLength(240);
            entity.Property(x => x.SourcePageUrl).HasMaxLength(1000);
            entity.Property(x => x.VerificationStatus).HasMaxLength(40).IsRequired().HasDefaultValue("MISSING");
            entity.Property(x => x.MatchingNotes).HasMaxLength(2000);
            entity.Property(x => x.MissingImageStatus).HasMaxLength(40).IsRequired().HasDefaultValue("MISSING");
            entity.HasIndex(x => x.MediaAssetId);
            entity.HasIndex(x => new { x.ProductId, x.DisplayOrder }).IsUnique();
            entity.HasOne(x => x.Product).WithMany(x => x.Images).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Branch>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(40);
            entity.Property(x => x.Phone).HasMaxLength(30);
            entity.Property(x => x.Email).HasMaxLength(240);
            entity.Property(x => x.Province).HasMaxLength(120);
            entity.Property(x => x.District).HasMaxLength(120);
            entity.Property(x => x.Municipality).HasMaxLength(160);
            entity.Property(x => x.Ward).HasMaxLength(30);
            entity.Property(x => x.StreetTole).HasMaxLength(240);
            entity.Property(x => x.Landmark).HasMaxLength(240);
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.Property(x => x.AttendanceRadiusMeters).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<SystemSetting>(), "system_settings");
        modelBuilder.Entity<SystemSetting>(entity =>
        {
            entity.Property(x => x.Key).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Value).HasColumnType("longtext").IsRequired();
            entity.Property(x => x.Group).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => x.Key).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<SystemBackup>(), "system_backups");
        modelBuilder.Entity<SystemBackup>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Provider).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Sha256).HasMaxLength(64);
            entity.Property(x => x.FailureReason).HasMaxLength(1000);
            entity.Property(x => x.CreatedBy).HasMaxLength(120);
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasIndex(x => x.FileName).IsUnique();
        });

        ConfigureAudited(modelBuilder.Entity<PaymentMethodConfiguration>(), "payment_method_configurations");
        modelBuilder.Entity<PaymentMethodConfiguration>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(60).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Instructions).HasMaxLength(1000);
            entity.Property(x => x.QrCodeUrl).HasMaxLength(2000);
            entity.Property(x => x.MinimumOrder).HasPrecision(18, 2);
            entity.Property(x => x.MaximumOrder).HasPrecision(18, 2);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.IsEnabled, x.DisplayOrder });
        });
        ConfigureAudited(modelBuilder.Entity<HomepageSection>(), "homepage_sections");
        modelBuilder.Entity<HomepageSection>(entity =>
        {
            entity.Property(x => x.SectionKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ContentJson).HasColumnType("longtext");
            entity.HasIndex(x => new { x.DisplayOrder, x.Enabled });
        });
        ConfigureAudited(modelBuilder.Entity<WebsiteAsset>(), "website_assets");
        modelBuilder.Entity<WebsiteAsset>(entity =>
        {
            entity.Property(x => x.Kind).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Subtitle).HasMaxLength(240);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.Property(x => x.MobileImageUrl).HasMaxLength(500);
            entity.Property(x => x.VideoUrl).HasMaxLength(500);
            entity.Property(x => x.ButtonText).HasMaxLength(100);
            entity.Property(x => x.Destination).HasMaxLength(500);
            entity.Property(x => x.SecondaryButtonText).HasMaxLength(100);
            entity.Property(x => x.SecondaryButtonUrl).HasMaxLength(500);
            entity.Property(x => x.TextAlignment).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ContentPosition).HasMaxLength(20).IsRequired();
            entity.Property(x => x.BackgroundPosition).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CustomLabel).HasMaxLength(100);
            entity.Property(x => x.LayoutVariant).HasMaxLength(30).HasDefaultValue("STANDARD").IsRequired();
            entity.Property(x => x.TypingSpeedMs).HasDefaultValue(52);
            entity.Property(x => x.BackgroundColor).HasMaxLength(7).HasDefaultValue("#F8F6F1").IsRequired();
            entity.Property(x => x.AnimationType).HasMaxLength(30).IsRequired();
            entity.Property(x => x.OverlayOpacity).HasDefaultValue(35);
            entity.Property(x => x.SlideDuration).HasDefaultValue(5000);
            entity.Property(x => x.TransitionDuration).HasDefaultValue(700);
            entity.Property(x => x.AutoplayEnabled).HasDefaultValue(true);
            entity.Property(x => x.PauseOnHover).HasDefaultValue(true);
            entity.Property(x => x.ShowNavigationArrows).HasDefaultValue(true);
            entity.Property(x => x.ShowPaginationDots).HasDefaultValue(true);
            entity.Property(x => x.LoopSlides).HasDefaultValue(true);
            entity.Property(x => x.RandomizeSlides).HasDefaultValue(false);
            entity.Property(x => x.RespectSchedule).HasDefaultValue(true);
            entity.HasIndex(x => new { x.Kind, x.Enabled, x.Priority });
        });
        ConfigureAudited(modelBuilder.Entity<NavigationMenuItem>(), "navigation_menu_items");
        modelBuilder.Entity<NavigationMenuItem>(entity =>
        {
            entity.Property(x => x.MenuKey).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Url).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Icon).HasMaxLength(80);
            entity.HasIndex(x => new { x.MenuKey, x.DisplayOrder, x.IsVisible });
            entity.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<RoleSidebarMenuItem>(), "role_sidebar_menu_items");
        modelBuilder.Entity<RoleSidebarMenuItem>(entity =>
        {
            entity.Property(x => x.Role).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Href).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Icon).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.Role, x.DisplayOrder }).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<PopupCampaign>(), "popup_campaigns");
        modelBuilder.Entity<PopupCampaign>(entity =>
        {
            entity.Property(x => x.Kind).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1600);
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.Property(x => x.ButtonText).HasMaxLength(120);
            entity.Property(x => x.Destination).HasMaxLength(500);
            entity.Property(x => x.Frequency).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Audience).HasMaxLength(30).IsRequired();
            entity.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
        });
        ConfigureAudited(modelBuilder.Entity<SeoEntry>(), "seo_entries");
        modelBuilder.Entity<SeoEntry>(entity =>
        {
            entity.Property(x => x.Scope).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Path).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(240);
            entity.Property(x => x.MetaDescription).HasMaxLength(500);
            entity.Property(x => x.Keywords).HasMaxLength(1000);
            entity.Property(x => x.OgTitle).HasMaxLength(240);
            entity.Property(x => x.OgDescription).HasMaxLength(500);
            entity.Property(x => x.OgImageUrl).HasMaxLength(500);
            entity.Property(x => x.CanonicalUrl).HasMaxLength(500);
            entity.Property(x => x.Robots).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => new { x.Scope, x.Path }).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<MediaAsset>(), "media_assets");
        modelBuilder.Entity<MediaAsset>(entity =>
        {
            entity.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.StoredFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Sha256).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Kind).HasMaxLength(40).IsRequired();
            entity.Property(x => x.AltText).HasMaxLength(240);
            entity.HasIndex(x => x.Sha256);
            entity.HasIndex(x => new { x.Kind, x.IsPublic, x.IsActive });
        });
        ConfigureAudited(modelBuilder.Entity<CmsPage>(), "cms_pages");
        modelBuilder.Entity<CmsPage>(entity =>
        {
            entity.Property(x => x.Slug).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Content).HasColumnType("longtext").IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.SeoTitle).HasMaxLength(240);
            entity.Property(x => x.MetaDescription).HasMaxLength(500);
            entity.HasIndex(x => x.Slug).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<HealthArticle>(), "health_articles");
        modelBuilder.Entity<HealthArticle>(entity =>
        {
            entity.Property(x => x.Slug).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Excerpt).HasMaxLength(500);
            entity.Property(x => x.Content).HasColumnType("longtext").IsRequired();
            entity.Property(x => x.Category).HasMaxLength(120);
            entity.Property(x => x.TagsCsv).HasMaxLength(1000);
            entity.Property(x => x.AuthorName).HasMaxLength(160);
            entity.Property(x => x.FeaturedImageUrl).HasMaxLength(500);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.SeoTitle).HasMaxLength(240);
            entity.Property(x => x.MetaDescription).HasMaxLength(500);
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => new { x.Status, x.PublishedAt, x.ScheduledAt });
        });
        ConfigureAudited(modelBuilder.Entity<Faq>(), "faqs");
        modelBuilder.Entity<Faq>(entity =>
        {
            entity.Property(x => x.Question).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Answer).HasColumnType("longtext").IsRequired();
            entity.Property(x => x.Category).HasMaxLength(120);
            entity.HasIndex(x => new { x.Published, x.DisplayOrder });
        });
        ConfigureAudited(modelBuilder.Entity<Supplier>(), "suppliers");
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ContactPerson).HasMaxLength(160);
            entity.Property(x => x.Phone).HasMaxLength(30);
            entity.Property(x => x.Email).HasMaxLength(240);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.TaxNumber).HasMaxLength(80);
            entity.HasIndex(x => x.Name);
        });
        ConfigureAudited(modelBuilder.Entity<Transporter>(), "transporters");
        modelBuilder.Entity<Transporter>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ContactPerson).HasMaxLength(160);
            entity.Property(x => x.Phone).HasMaxLength(30);
            entity.Property(x => x.Email).HasMaxLength(240);
            entity.Property(x => x.VehicleNumber).HasMaxLength(40);
            entity.Property(x => x.LicenseNumber).HasMaxLength(80);
            entity.Property(x => x.ServiceArea).HasMaxLength(300);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.Name);
            entity.HasIndex(x => new { x.IsActive, x.Name });
        });
        ConfigureAudited(modelBuilder.Entity<DeliveryZone>(), "delivery_zones");
        modelBuilder.Entity<DeliveryZone>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Province).HasMaxLength(120);
            entity.Property(x => x.District).HasMaxLength(120);
            entity.Property(x => x.Municipality).HasMaxLength(160);
            entity.Property(x => x.Ward).HasMaxLength(30);
            entity.Property(x => x.DeliveryFee).HasPrecision(12, 2);
            entity.Property(x => x.FreeDeliveryThreshold).HasPrecision(12, 2);
            entity.Property(x => x.MinimumOrder).HasPrecision(12, 2);
            entity.HasIndex(x => new { x.District, x.Municipality, x.Ward, x.Enabled });
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<DeliverySlot>(), "delivery_slots");
        modelBuilder.Entity<DeliverySlot>(entity =>
        {
            entity.Property(x => x.Label).HasMaxLength(120).IsRequired();
            entity.Property(x => x.StartTime).HasMaxLength(5).IsRequired();
            entity.Property(x => x.EndTime).HasMaxLength(5).IsRequired();
            entity.HasIndex(x => new { x.BranchId, x.DisplayOrder, x.Enabled });
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<Coupon>(), "coupons");
        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Value).HasPrecision(12, 2);
            entity.Property(x => x.MinimumOrder).HasPrecision(12, 2);
            entity.Property(x => x.MaximumDiscount).HasPrecision(12, 2);
            entity.HasIndex(x => x.Code).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<FlashSale>(), "flash_sales");
        modelBuilder.Entity<FlashSale>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.DiscountPercent).HasPrecision(6, 2);
            entity.Property(x => x.StartsAt).HasColumnType("datetime(6)");
            entity.Property(x => x.EndsAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.ProductId, x.IsActive, x.StartsAt, x.EndsAt });
            entity.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<PurchaseOrder>(), "purchase_orders");
        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.PaymentMethod).HasMaxLength(40).IsRequired();
            entity.Property(x => x.PaymentStatus).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.TotalAmount).HasPrecision(14, 2);
            entity.Property(x => x.ExpectedAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<PurchaseOrderItem>(), "purchase_order_items");
        modelBuilder.Entity<PurchaseOrderItem>(entity =>
        {
            entity.Property(x => x.ProductName).HasMaxLength(220).IsRequired();
            entity.Property(x => x.Unit).HasMaxLength(40).IsRequired();
            entity.Property(x => x.UnitCost).HasPrecision(14, 2);
            entity.Property(x => x.BatchNumber).HasMaxLength(100);
            entity.HasIndex(x => new { x.PurchaseOrderId, x.ProductId });
            entity.HasOne(x => x.PurchaseOrder).WithMany(x => x.Items).HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<PurchaseReturn>(), "purchase_returns");
        modelBuilder.Entity<PurchaseReturn>(entity =>
        {
            entity.Property(x => x.ReturnNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.TotalAmount).HasPrecision(14, 2);
            entity.Property(x => x.Reason).HasMaxLength(1000);
            entity.HasOne(x => x.SupplierInvoice).WithMany().HasForeignKey(x => x.SupplierInvoiceId).OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(x => x.ReturnNumber).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.ReturnDate });
            entity.HasOne(x => x.PurchaseOrder).WithMany().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<PurchaseReturnItem>(), "purchase_return_items");
        modelBuilder.Entity<PurchaseReturnItem>(entity =>
        {
            entity.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.UnitCost).HasPrecision(14, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(14, 2);
            entity.HasIndex(x => new { x.PurchaseReturnId, x.ProductId, x.BatchNumber });
            entity.HasOne(x => x.PurchaseReturn).WithMany(x => x.Items).HasForeignKey(x => x.PurchaseReturnId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<CustomerCredit>(), "customer_credit");
        modelBuilder.Entity<CustomerCredit>(entity =>
        {
            entity.Property(x => x.CreditLimit).HasPrecision(14, 2);
            entity.Property(x => x.CurrentBalance).HasPrecision(14, 2);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.HasIndex(x => x.CustomerId).IsUnique();
            entity.HasIndex(x => x.Status);
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<SaleReturn>(), "sale_returns");
        modelBuilder.Entity<SaleReturn>(entity =>
        {
            entity.Property(x => x.ReturnNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.ReturnType).HasMaxLength(20).HasDefaultValue("STANDARD").IsRequired();
            entity.Property(x => x.TotalAmount).HasPrecision(14, 2);
            entity.Property(x => x.RefundMethod).HasMaxLength(20);
            entity.Property(x => x.CashRefundAmount).HasPrecision(14, 2);
            entity.Property(x => x.CreditReliefAmount).HasPrecision(14, 2);
            entity.Property(x => x.Reason).HasMaxLength(1000);
            entity.HasIndex(x => x.ReturnNumber).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.ReturnDate });
            entity.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<SaleReturnItem>(), "sale_return_items");
        modelBuilder.Entity<SaleReturnItem>(entity =>
        {
            entity.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(14, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(14, 2);
            entity.HasIndex(x => new { x.SaleReturnId, x.ProductId, x.BatchNumber });
            entity.HasOne(x => x.SaleReturn).WithMany(x => x.Items).HasForeignKey(x => x.SaleReturnId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<CustomerPayment>(), "customer_payments");
        modelBuilder.Entity<CustomerPayment>(entity =>
        {
            entity.Property(x => x.PaymentNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(14, 2);
            entity.Property(x => x.Method).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(160);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.PaymentNumber).IsUnique();
            entity.HasIndex(x => new { x.CustomerId, x.PaymentDate });
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<SupplierPayment>(), "supplier_payments");
        modelBuilder.Entity<SupplierPayment>(entity =>
        {
            entity.Property(x => x.PaymentNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(14, 2);
            entity.Property(x => x.Method).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(160);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.PaymentNumber).IsUnique();
            entity.HasIndex(x => new { x.SupplierId, x.PaymentDate });
            entity.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<ContactWidgetLink>(), "contact_widget_links");
        modelBuilder.Entity<ContactWidgetLink>(entity =>
        {
            entity.Property(x => x.Type).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Target).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Icon).HasMaxLength(80);
            entity.Property(x => x.PredefinedMessage).HasMaxLength(500);
            entity.HasIndex(x => new { x.IsEnabled, x.DisplayOrder });
        });
        ConfigureAudited(modelBuilder.Entity<TrustBadge>(), "trust_badges");
        modelBuilder.Entity<TrustBadge>(entity =>
        {
            entity.Property(x => x.BadgeKey).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.HasIndex(x => x.BadgeKey).IsUnique();
            entity.HasIndex(x => new { x.IsEnabled, x.DisplayOrder });
        });
        ConfigureAudited(modelBuilder.Entity<AssistantChatSession>(), "assistant_chat_sessions");
        modelBuilder.Entity<AssistantChatSession>(entity =>
        {
            entity.Property(x => x.SessionKey).HasMaxLength(100).IsRequired();
            entity.Property(x => x.VisitorReference).HasMaxLength(160);
            entity.HasIndex(x => x.SessionKey).IsUnique();
            entity.HasIndex(x => x.UpdatedAt);
        });
        ConfigureAudited(modelBuilder.Entity<AssistantChatMessage>(), "assistant_chat_messages");
        modelBuilder.Entity<AssistantChatMessage>(entity =>
        {
            entity.Property(x => x.Role).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Content).HasColumnType("longtext").IsRequired();
            entity.HasIndex(x => new { x.SessionId, x.CreatedAt });
            entity.HasOne(x => x.Session).WithMany(x => x.Messages).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAudited(modelBuilder.Entity<MessageConversation>(), "message_conversations");
        modelBuilder.Entity<MessageConversation>(entity =>
        {
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.Property(x => x.Subject).HasMaxLength(200);
            entity.HasIndex(x => x.LastMessageAt);
            entity.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<MessageParticipant>(), "message_participants");
        modelBuilder.Entity<MessageParticipant>(entity =>
        {
            entity.Property(x => x.ParticipantRole).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => new { x.CustomerId, x.ConversationId });
            entity.HasIndex(x => new { x.StaffUserId, x.ConversationId });
            entity.HasOne(x => x.Conversation).WithMany(x => x.Participants).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.StaffUser).WithMany().HasForeignKey(x => x.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<PlatformMessage>(), "platform_messages");
        modelBuilder.Entity<PlatformMessage>(entity =>
        {
            entity.Property(x => x.Body).HasColumnType("longtext").IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.Property(x => x.LocationLabel).HasMaxLength(300);
            entity.Property(x => x.LocationSource).HasMaxLength(30);
            entity.HasIndex(x => new { x.ConversationId, x.CreatedAt });
            entity.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SenderCustomer).WithMany().HasForeignKey(x => x.SenderCustomerId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.SenderStaffUser).WithMany().HasForeignKey(x => x.SenderStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<MessageAttachment>(), "message_attachments");
        modelBuilder.Entity<MessageAttachment>(entity =>
        {
            entity.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.StoredFileName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Sha256).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.StoredFileName).IsUnique();
            entity.HasOne(x => x.Message).WithMany(x => x.Attachments).HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Cascade);
        });
        ConfigureAudited(modelBuilder.Entity<MessagingRoleSetting>(), "messaging_role_settings");
        modelBuilder.Entity<MessagingRoleSetting>(entity =>
        {
            entity.Property(x => x.Role).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => x.Role).IsUnique();
            entity.HasOne(x => x.UpdatedByStaffUser).WithMany().HasForeignKey(x => x.UpdatedByStaffUserId).OnDelete(DeleteBehavior.SetNull);
        });
        ConfigureAudited(modelBuilder.Entity<CustomerManufacturerDiscount>(), "customer_manufacturer_discounts");
        modelBuilder.Entity<CustomerManufacturerDiscount>(entity =>
        {
            entity.Property(x => x.DiscountPercent).HasPrecision(6, 2);
            entity.Property(x => x.StartsAt).HasColumnType("datetime(6)");
            entity.Property(x => x.EndsAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.CustomerId, x.ManufacturerId }).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
            entity.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Manufacturer).WithMany().HasForeignKey(x => x.ManufacturerId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<SupplierManufacturerDiscount>(), "supplier_manufacturer_discounts");
        modelBuilder.Entity<SupplierManufacturerDiscount>(entity =>
        {
            entity.Property(x => x.DiscountPercent).HasPrecision(6, 2);
            entity.Property(x => x.StartsAt).HasColumnType("datetime(6)");
            entity.Property(x => x.EndsAt).HasColumnType("datetime(6)");
            entity.HasIndex(x => new { x.SupplierId, x.ManufacturerId }).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
            entity.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Manufacturer).WithMany().HasForeignKey(x => x.ManufacturerId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<SalesTemplate>(), "sales_templates");
        modelBuilder.Entity<SalesTemplate>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => new { x.IsActive, x.Name });
            entity.HasIndex(x => x.Name).IsUnique();
        });
        ConfigureAudited(modelBuilder.Entity<SalesTemplateLine>(), "sales_template_lines");
        modelBuilder.Entity<SalesTemplateLine>(entity =>
        {
            entity.Property(x => x.Unit).HasMaxLength(40);
            entity.Property(x => x.DiscountPercent).HasPrecision(6, 2);
            entity.HasIndex(x => new { x.SalesTemplateId, x.ProductId }).IsUnique();
            entity.HasOne(x => x.SalesTemplate).WithMany(x => x.Lines).HasForeignKey(x => x.SalesTemplateId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        ConfigureAudited(modelBuilder.Entity<PharmacySalesBudget>(), "pharmacy_sales_budgets");
        modelBuilder.Entity<PharmacySalesBudget>(entity =>
        {
            entity.Property(x => x.PeriodStart).HasColumnType("datetime(6)");
            entity.Property(x => x.PeriodEnd).HasColumnType("datetime(6)");
            entity.Property(x => x.TargetAmount).HasPrecision(14, 2);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.HasIndex(x => new { x.BranchId, x.PeriodStart, x.PeriodEnd }).IsUnique();
            entity.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureAudited<TEntity>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> entity, string tableName) where TEntity : AuditedEntity
    {
        entity.ToTable(tableName);
        entity.HasKey(x => x.Id);
        entity.Property(x => x.CreatedAt).HasColumnType("datetime(6)");
        entity.Property(x => x.UpdatedAt).HasColumnType("datetime(6)");
    }
}
