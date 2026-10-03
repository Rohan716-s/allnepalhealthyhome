using backend.Models;

namespace backend.Contracts;

public sealed record AdminDashboardResponse(decimal TodayRevenue, decimal WeekRevenue, decimal MonthRevenue, decimal TotalRevenue, Dictionary<string, int> Orders, Dictionary<string, int> Prescriptions, Dictionary<string, int> Inventory, Dictionary<string, int> Staff, IReadOnlyList<AdminTrendPoint> RevenueTrend, IReadOnlyList<AdminTopProduct> TopProducts, IReadOnlyList<AdminCategorySale> CategorySales, IReadOnlyList<AdminOrderRow> RecentOrders, AdminKpiSummary Kpis, AdminDashboardOperations Operations);
public sealed record AdminDashboardOperations(decimal YesterdayRevenue, decimal YearRevenue, int ActiveCustomers, int InactiveCustomers, int TotalProducts, decimal StockValue, Dictionary<string, int> Delivery, Dictionary<string, int> PaymentMethods, IReadOnlyList<AdminRegistrationPoint> CustomerRegistrations, IReadOnlyList<AdminBranchPerformance> BranchPerformance);
public sealed record AdminRegistrationPoint(string Label, int Customers);
public sealed record AdminBranchPerformance(Guid? BranchId, string BranchName, int Orders, decimal Revenue, decimal CashIn = 0, decimal CashOut = 0, decimal NetCashFlow = 0);
public sealed record AdminKpiSummary(int TotalCustomers, int NewCustomers, int PendingOrders, int ProcessingOrders, int DeliveredOrders, int CancelledOrders, int PendingPrescriptions, int ApprovedPrescriptions, int RejectedPrescriptions, int PendingPayments, int CodOrders, int OnlineOrders, int ActiveBranches, int ActivePharmacists, int ActiveDeliveryStaff, string RangeStart, string RangeEnd);
public sealed record AdminTrendPoint(string Label, decimal Revenue, int Orders);
public sealed record AdminTopProduct(Guid ProductId, string ProductName, int Quantity, decimal Revenue);
public sealed record AdminCategorySale(string Category, int Quantity, decimal Revenue);
public sealed record AdminProductRow(Guid Id, string Name, string Sku, string Slug, Guid MedicineId, Guid BrandId, string Brand, string Category, string GenericName, decimal Mrp, decimal SellingPrice, bool IsActive, bool PrescriptionRequired, int Stock, DateTime CreatedAt, string? ImageUrl = null, string? BonusScheme = null, IReadOnlyList<string>? ImageUrls = null, bool IsTrending = false, bool IsHotDeal = false, string BaseUnit = "piece", string PurchaseUnit = "piece", int PurchaseUnitToBase = 1, IReadOnlyList<ProductUnitOption>? Units = null, string? CompanyCode = null, string? CompanyName = null, string? ImageSourceUrl = null, string ImageVerificationStatus = "MISSING", string? ImageSourceReference = null, decimal DemandScore = 0, string DemandBasis = "NO_HISTORY", string? DemandSourceUrl = null, string? DemandSourceReference = null, int DisplayOrder = 0, string ImportStatus = "MANUAL", string MissingImageStatus = "MISSING");
public sealed record ProductUnitOption(string Name, int MultiplierToBase, bool IsPurchaseUnit, bool IsSalesUnit);
public sealed record BranchSalesSummary(Guid? BranchId, string BranchName, decimal TotalSales, int OrderCount, IReadOnlyList<string> Customers);
public sealed record BranchSalesOrder(Guid Id, Guid? BranchId, string OrderNumber, string CustomerName, DateTime OrderDate, decimal Amount, string Status, string? BranchName);
public sealed record BranchSalesReportResponse(IReadOnlyList<BranchSalesSummary> Branches, IReadOnlyList<BranchSalesOrder> Orders, DateTime From, DateTime To);
public sealed record AdminInventoryRow(Guid Id, Guid ProductId, Guid BranchId, string ProductName, string Sku, string BatchNumber, string Branch, int StockQuantity, int ReservedQuantity, int AvailableQuantity, int MinimumStock, decimal PurchasePrice, decimal SellingPrice, DateTime? ExpiryDate, string Status);
public sealed record AdminOrderRow(Guid Id, string OrderNumber, string CustomerName, string CustomerPhone, string? Branch, string Status, string PaymentStatus, decimal Total, DateTime CreatedAt, string OrderMode = "SINGLE");
public sealed record AdminOrderDetailResponse(Guid Id, string OrderNumber, string CustomerName, string CustomerEmail, string CustomerPhone, DateTime CreatedAt, string Status, string PaymentStatus, string PaymentMethod, decimal Total, decimal DeliveryFee, decimal DiscountAmount, string? CouponCode, string? DeliveryInstructions, StaffAddressItem? Address, IReadOnlyList<StaffOrderItem> Items, StaffPrescriptionSummary? Prescription, IReadOnlyList<StatusHistoryItem> Timeline, DeliverySummary? Delivery, string? BranchName = null, Guid? BranchId = null, Guid? PharmacistId = null, string? PharmacistName = null, Guid? DeliveryStaffId = null, string? InvoiceNumber = null, string? CustomerNotes = null, string OrderMode = "SINGLE", Guid? SupervisorId = null, Guid? AssignedStaffUserId = null, IReadOnlyList<OrderDocumentRow>? Documents = null);
public sealed record AdminOrderAssignmentRequest(Guid? BranchId, Guid? PharmacistId, Guid? DeliveryStaffId, string? Note, Guid? SupervisorId = null, Guid? AssignedStaffUserId = null);
public sealed record AdminInvoiceResponse(Guid Id, string InvoiceNumber, Guid OrderId, string OrderNumber, decimal Subtotal, decimal TaxAmount, decimal DiscountAmount, decimal DeliveryFee, decimal Total, DateTime IssuedAt);
public sealed record AdminPaymentRow(Guid Id, string OrderNumber, string CustomerName, string Method, string Status, decimal Amount, DateTime CreatedAt);
public sealed record AdminPaymentTransactionRow(Guid Id, Guid OrderId, string OrderNumber, string CustomerName, string TransactionNumber, string Method, string Status, decimal Amount, string? ProviderReference, string? Notes, DateTime? PaidAt, DateTime? RefundedAt, DateTime CreatedAt);
public sealed record AdminNotificationRow(Guid Id, Guid? CustomerId, Guid? StaffUserId, string Recipient, string Type, string Title, string Body, bool IsRead, DateTime CreatedAt);
public sealed record AdminPrescriptionRow(Guid Id, string PrescriptionNumber, string CustomerName, string Status, int ItemCount, string? Reviewer, decimal OcrConfidence, DateTime CreatedAt);
public sealed record PrescriptionOverrideRequest(string Status, string Reason);
public sealed record StaffHrProfileResponse(string? Department, string? JobTitle, string? AppointmentType, string? EmploymentStatus, string? OfficialEmail, DateTime? DateOfBirth, string? Gender, string? MaritalStatus, string? TaxNumber, string? CitizenshipNumber, string? EmergencyContactName, string? EmergencyContactPhone, string? BloodGroup, string? DeviceEnrollmentId, bool MobileAccessEnabled, bool WebAccessEnabled);
public sealed record AdminStaffRow(Guid Id, string FullName, string Email, string Phone, string Role, Guid? BranchId, string? BranchName, bool IsActive, string[] Permissions, DateTime CreatedAt, string? EmployeeId = null, string? Address = null, DateTime? JoiningDate = null, string? ProfilePhotoUrl = null, StaffHrProfileResponse? HrProfile = null, string? Territory = null);
public sealed record SalesExecutiveAssignmentRow(Guid Id, Guid SalesExecutiveUserId, string SalesExecutiveName, Guid? ProductId, string? ProductName, Guid? CategoryId, string? CategoryName, bool IsActive, DateTime CreatedAt, string? Phone = null, string? Email = null, string? BranchName = null, string? Territory = null, Guid? BranchId = null, string? ProductSku = null, string? ProductBrand = null, string? ProductCategory = null, decimal? ProductSellingPrice = null);
public sealed record SalesExecutiveOption(Guid Id, string FullName, string Email, string Phone, Guid? BranchId, string? BranchName, string? Territory);
public sealed record SalesAssignmentBranchOption(Guid Id, string Name);
public sealed record UpsertSalesExecutiveAssignmentRequest(Guid SalesExecutiveUserId, Guid? ProductId, Guid? CategoryId, bool IsActive = true);
public sealed record BulkSalesExecutiveAssignmentRequest(IReadOnlyList<Guid> SalesExecutiveUserIds, IReadOnlyList<Guid> ProductIds, bool IsActive = true);
public sealed record BulkSalesExecutiveAssignmentResponse(IReadOnlyList<SalesExecutiveAssignmentRow> Created, int SkippedDuplicates);
public sealed record BulkSalesExecutiveAssignmentUpdateRequest(IReadOnlyList<Guid> AssignmentIds, bool? IsActive = null, Guid? SalesExecutiveUserId = null, Guid? ProductId = null);
public sealed record BulkSalesExecutiveAssignmentDeleteRequest(IReadOnlyList<Guid> AssignmentIds);
public sealed record BulkSalesExecutiveAssignmentMutationResponse(int Updated, int Deleted);
public sealed record SalesExecutiveOrderItemRow(Guid ProductId, string ProductName, string? CategoryName, int Quantity, decimal UnitPrice, decimal SalesValue);
public sealed record SalesExecutiveOrderRow(Guid Id, string OrderNumber, string CustomerName, string? CustomerPhone, DateTime CreatedAt, string Status, string? BranchName, IReadOnlyList<SalesExecutiveOrderItemRow> Items, decimal RelevantSalesValue);
public sealed record SalesExecutiveDashboardResponse(int TotalOrders, decimal TotalSalesValue, DateTime From, DateTime To, IReadOnlyList<SalesExecutiveOrderRow> RecentOrders);
public sealed record SalesExecutiveOrdersResponse(IReadOnlyList<SalesExecutiveOrderRow> Items, int Page, int PageSize, int Total, int TotalPages);
public sealed record AdminRoleRow(Guid Id, string Name, string DisplayName, string? Description, bool IsActive, bool IsSystem, string[] Permissions, DateTime CreatedAt);
public sealed record AdminPermissionRow(Guid Id, string Key, string Description, string Group, bool IsSystem);
public sealed record AdminCustomerRow(Guid Id, string FullName, string Email, string Phone, bool IsActive, int Orders, int Prescriptions, DateTime CreatedAt);
public sealed record AdminCustomerAddressRow(Guid Id, string Label, string Province, string District, string Municipality, string Ward, string StreetTole, string? Landmark, string Phone, bool IsDefault);
public sealed record AdminCustomerOrderRow(Guid Id, string OrderNumber, string Status, string PaymentStatus, decimal Total, string? BranchName, DateTime CreatedAt);
public sealed record AdminCustomerPrescriptionRow(Guid Id, string Status, string OriginalFileName, int ItemCount, DateTime CreatedAt);
public sealed record AdminCustomerReviewRow(Guid Id, string ProductName, int Rating, string Status, string? Title, string Comment, DateTime CreatedAt);
public sealed record AdminCustomerDetailResponse(Guid Id, string FullName, string Email, string Phone, bool IsActive, DateTime CreatedAt, IReadOnlyList<AdminCustomerAddressRow> Addresses, IReadOnlyList<AdminCustomerOrderRow> Orders, IReadOnlyList<AdminCustomerPrescriptionRow> Prescriptions, IReadOnlyList<AdminCustomerReviewRow> Reviews, IReadOnlyList<AdminSupportTicketRow> SupportTickets);
public sealed record AdminAuditRow(Guid Id, string Action, string EntityType, string EntityId, string? ActorRole, string? PreviousValue, string? NewValue, DateTime CreatedAt);
public sealed record AdminGlobalSearchResult(string Type, Guid Id, string Label, string? Secondary, string Href);
public sealed record AdminRoleSidebarMenuItem(Guid Id, string Role, string Label, string Href, string Icon, int DisplayOrder, bool IsVisible);
public sealed record RoleSidebarMenuInput(string Label, string Href, string Icon, int DisplayOrder, bool IsVisible);
public sealed record UpsertRoleSidebarMenuRequest(IReadOnlyList<RoleSidebarMenuInput> Items);
public sealed record AdminPaymentMethodRow(Guid Id, string Code, string DisplayName, string? Instructions, decimal? MinimumOrder, decimal? MaximumOrder, int DisplayOrder, bool IsEnabled, bool RequiresServerVerification, string? QrCodeUrl = null);
public sealed record AdminReviewRow(Guid Id, Guid ProductId, string ProductName, string CustomerName, string CustomerEmail, Guid? OrderId, int Rating, string? Title, string Comment, string Status, string? AdminResponse, DateTime CreatedAt, DateTime? PublishedAt);
public sealed record UpdateReviewRequest(string Status, string? AdminResponse);
public sealed record CreateReviewRequest(Guid ProductId, Guid? OrderId, int Rating, string? Title, string Comment);
public sealed record PublicReviewRow(Guid Id, string CustomerName, int Rating, string? Title, string Comment, DateTime CreatedAt, string? AdminResponse);
public sealed record AdminSupportTicketRow(Guid Id, string TicketNumber, string CustomerName, string CustomerEmail, string Subject, string Description, string Status, string Priority, string? Category, string? Resolution, string? AssignedStaff, DateTime CreatedAt, DateTime? ResolvedAt);
public sealed record AdminSupportTicketMessageRow(Guid Id, Guid SupportTicketId, string Message, bool IsInternal, string? Author, string AuthorType, DateTime CreatedAt);
public sealed record CreateSupportTicketMessageRequest(string Message, bool IsInternal);
public sealed record CreateSupportTicketRequest(string Subject, string Description, string? Category, string Priority);
public sealed record UpdateSupportTicketRequest(string Status, string Priority, string? Resolution, Guid? AssignedStaffId);
public sealed record AdminNotificationTemplateRow(Guid Id, string Code, string Name, string Channel, string? Subject, string Body, string? Variables, bool IsEnabled, DateTime UpdatedAt);
public sealed record UpsertNotificationTemplateRequest(string Code, string Name, string Channel, string? Subject, string Body, string? Variables, bool IsEnabled);
public sealed record PublicPaymentMethodRow(string Code, string DisplayName, string? Instructions, decimal? MinimumOrder, decimal? MaximumOrder, int DisplayOrder, bool Enabled, bool RequiresServerVerification, string? QrCodeUrl = null);
public sealed record PublicSiteConfigResponse(Dictionary<string, string> Settings, IReadOnlyList<HomepageSection> Sections, IReadOnlyList<WebsiteAsset> Assets, IReadOnlyList<Faq> Faqs, IReadOnlyList<PublicPaymentMethodRow> PaymentMethods, IReadOnlyList<PublicNavigationMenuItem>? Navigation = null, IReadOnlyList<PublicPopupCampaign>? Popups = null, PublicSeoEntry? Seo = null, IReadOnlyList<PublicDeliverySlot>? DeliverySlots = null);
public sealed record PublicSiteSummaryResponse(int CustomerCount, int ProductCount, int CompletedOrderCount, int ActiveBranchCount, int PublishedReviewCount);
public sealed record UpsertSettingRequest(string Key, string Value, string Group, bool IsPublic, string? Description);
public sealed record SidebarThemeSettings(
    string SidebarBackground,
    string SidebarText,
    string SidebarIcon,
    string SidebarHoverBackground,
    string SidebarHoverText,
    string SidebarActiveBackground,
    string SidebarActiveText,
    string SidebarActiveIcon,
    string SidebarBorder,
    string SidebarDivider,
    string SidebarHeaderBackground,
    string SidebarHeaderText,
    string SidebarFooterBackground,
    string SidebarFooterText,
    string SidebarBadgeBackground,
    string SidebarBadgeText);

public sealed record UpdateSidebarThemeRequest(
    string SidebarBackground,
    string SidebarText,
    string SidebarIcon,
    string SidebarHoverBackground,
    string SidebarHoverText,
    string SidebarActiveBackground,
    string SidebarActiveText,
    string SidebarActiveIcon,
    string SidebarBorder,
    string SidebarDivider,
    string SidebarHeaderBackground,
    string SidebarHeaderText,
    string SidebarFooterBackground,
    string SidebarFooterText,
    string SidebarBadgeBackground,
    string SidebarBadgeText);
public sealed record EmailIntegrationStatus(bool Configured, string? Host, int? Port, string? Username, string? SenderName, string? SenderEmail, string Encryption);
public sealed record SmsIntegrationStatus(bool Configured, string? Provider, string? ApiUrl, string? SenderId, int OtpExpiryMinutes, int OtpLength, int RateLimitPerHour, int RetryLimit);
public sealed record WhatsAppIntegrationStatus(bool Configured, string? Provider, string? ApiUrl, string? BusinessNumber, string? Templates);
public sealed record IntegrationStatusResponse(EmailIntegrationStatus Email, SmsIntegrationStatus Sms, WhatsAppIntegrationStatus WhatsApp);
public sealed record AssistantIntegrationStatus(bool Enabled, bool Configured, string Provider, string? Model, string? BaseUrl);
public sealed record UpsertAssistantIntegrationRequest(bool Enabled, string Provider, string Model, string BaseUrl, string? ApiKey);
public sealed record UpsertEmailIntegrationRequest(string Host, int Port, string Username, string? Password, string SenderName, string SenderEmail, string Encryption);
public sealed record UpsertSmsIntegrationRequest(string? Provider, string? ApiUrl, string? ApiKey, string? SenderId, int OtpExpiryMinutes, int OtpLength, int RateLimitPerHour, int RetryLimit);
public sealed record UpsertWhatsAppIntegrationRequest(string? Provider, string? ApiUrl, string? ApiKey, string? BusinessNumber, string? Templates);
public sealed record TestEmailRequest(string To);
public sealed record MaintenanceSettingsResponse(bool Enabled, string Message, bool AllowAdmin);
public sealed record UpdateMaintenanceRequest(bool Enabled, string Message, bool AllowAdmin);
public sealed record AdminBackupRow(Guid Id, string FileName, string Status, string Provider, long SizeBytes, string? Sha256, string? FailureReason, string? CreatedBy, DateTime CreatedAt, DateTime? CompletedAt);
public sealed record RestoreBackupRequest(bool Confirm);
public sealed record UpsertHomepageSectionRequest(string SectionKey, string Title, string? ContentJson, int DisplayOrder, bool Enabled);
public sealed record UpsertWebsiteAssetRequest(string Kind, string Title, string? Subtitle, string? Description, string? ImageUrl, string? MobileImageUrl, string? ButtonText, string? Destination, DateTime? StartsAt, DateTime? EndsAt, int Priority, bool Enabled, bool MobileEnabled, bool DesktopEnabled);
public sealed record AdminHeroSlide(Guid Id, string Title, string? Subtitle, string? Description, string? ButtonText, string? ButtonUrl, string? SecondaryButtonText, string? SecondaryButtonUrl, string? DesktopImage, string? MobileImage, string? CustomLabel, string LayoutVariant, int TypingSpeedMs, string BackgroundColor, int OverlayOpacity, string TextAlignment, string ContentPosition, string BackgroundPosition, string AnimationType, int SlideDuration, int TransitionDuration, int DisplayOrder, bool IsActive, bool AutoplayEnabled, bool PauseOnHover, bool ShowNavigationArrows, bool ShowPaginationDots, bool LoopSlides, bool RandomizeSlides, bool RespectSchedule, DateTime? StartDate, DateTime? EndDate, string? VideoUrl, DateTime UpdatedAt);
public sealed record UpsertHeroSlideRequest(string Title, string? Subtitle, string? Description, string? ButtonText, string? ButtonUrl, string? SecondaryButtonText, string? SecondaryButtonUrl, string? DesktopImage, string? MobileImage, string? CustomLabel, string LayoutVariant, int TypingSpeedMs, string BackgroundColor, int OverlayOpacity, string TextAlignment, string ContentPosition, string BackgroundPosition, string AnimationType, int SlideDuration, int TransitionDuration, int DisplayOrder, bool IsActive, bool AutoplayEnabled, bool PauseOnHover, bool ShowNavigationArrows, bool ShowPaginationDots, bool LoopSlides, bool RandomizeSlides, bool RespectSchedule, DateTime? StartDate, DateTime? EndDate, string? VideoUrl = null);
public sealed record HeroSlideOrder(Guid Id, int DisplayOrder);
public sealed record ReorderHeroSlidesRequest(IReadOnlyList<HeroSlideOrder> Slides);
public sealed record AdminNavigationMenuItem(Guid Id, string MenuKey, string Label, string Url, Guid? ParentId, string? Icon, int DisplayOrder, bool IsVisible, bool OpenInNewTab, DateTime UpdatedAt);
public sealed record UpsertNavigationMenuItemRequest(string MenuKey, string Label, string Url, Guid? ParentId, string? Icon, int DisplayOrder, bool IsVisible, bool OpenInNewTab);
public sealed record AdminPopupCampaign(Guid Id, string Kind, string Title, string? Description, string? ImageUrl, string? ButtonText, string? Destination, int DelaySeconds, string Frequency, string Audience, bool MobileEnabled, bool DesktopEnabled, DateTime? StartsAt, DateTime? EndsAt, bool IsActive, DateTime UpdatedAt);
public sealed record UpsertPopupCampaignRequest(string Kind, string Title, string? Description, string? ImageUrl, string? ButtonText, string? Destination, int DelaySeconds, string Frequency, string Audience, bool MobileEnabled, bool DesktopEnabled, DateTime? StartsAt, DateTime? EndsAt, bool IsActive);
public sealed record AdminSeoEntry(Guid Id, string Scope, string Path, string? Title, string? MetaDescription, string? Keywords, string? OgTitle, string? OgDescription, string? OgImageUrl, string? CanonicalUrl, string Robots, bool IsActive, DateTime UpdatedAt);
public sealed record UpsertSeoEntryRequest(string Scope, string Path, string? Title, string? MetaDescription, string? Keywords, string? OgTitle, string? OgDescription, string? OgImageUrl, string? CanonicalUrl, string Robots, bool IsActive);
public sealed record AdminMediaAsset(Guid Id, string OriginalFileName, string ContentType, long Length, string Sha256, string Kind, string? AltText, string Url, bool IsPublic, bool IsActive, DateTime CreatedAt);
public sealed record PublicNavigationMenuItem(Guid Id, string MenuKey, string Label, string Url, Guid? ParentId, string? Icon, int DisplayOrder, bool OpenInNewTab);
public sealed record PublicPopupCampaign(Guid Id, string Kind, string Title, string? Description, string? ImageUrl, string? ButtonText, string? Destination, int DelaySeconds, string Frequency, string Audience, bool MobileEnabled, bool DesktopEnabled);
public sealed record PublicSeoEntry(string Scope, string Path, string? Title, string? MetaDescription, string? Keywords, string? OgTitle, string? OgDescription, string? OgImageUrl, string? CanonicalUrl, string Robots);
public sealed record UpsertCmsPageRequest(string Slug, string Title, string Content, string Status, string? SeoTitle, string? MetaDescription, DateTime? PublishedAt);
public sealed record AdminHealthArticleRow(Guid Id, string Slug, string Title, string? Excerpt, string Content, string? Category, string? TagsCsv, string? AuthorName, string? FeaturedImageUrl, string Status, string? SeoTitle, string? MetaDescription, DateTime? PublishedAt, DateTime? ScheduledAt, bool IsFeatured, DateTime UpdatedAt);
public sealed record UpsertHealthArticleRequest(string Slug, string Title, string? Excerpt, string Content, string? Category, string? TagsCsv, string? AuthorName, string? FeaturedImageUrl, string Status, string? SeoTitle, string? MetaDescription, DateTime? PublishedAt, DateTime? ScheduledAt, bool IsFeatured);
public sealed record UpsertFaqRequest(string Question, string Answer, string? Category, int DisplayOrder, bool Published);
public sealed record UpsertCategoryRequest(string Name, string Slug, string? Description, bool IsActive);
public sealed record UpsertBrandRequest(string Name, string Slug, bool IsActive);
public sealed record UpsertManufacturerRequest(string Name, string? Country);
public sealed record UpsertSupplierRequest(string Name, string? ContactPerson, string? Phone, string? Email, string? Address, string? TaxNumber, bool IsActive);
public sealed record UpsertBranchRequest(string Name, string Address, string? Code, string? Phone, string? Email, string? Province, string? District, string? Municipality, string? Ward, string? StreetTole, string? Landmark, decimal? Latitude, decimal? Longitude, TimeOnly? OpeningTime, TimeOnly? ClosingTime, bool DeliveryEnabled, bool PickupEnabled, bool IsActive);
public sealed record UpsertZoneRequest(string Name, string? Province, string? District, string? Municipality, string? Ward, Guid? BranchId, decimal DeliveryFee, decimal FreeDeliveryThreshold, decimal MinimumOrder, bool SameDayDelivery, bool Enabled);
public sealed record AdminDeliverySlot(Guid Id, string Label, string StartTime, string EndTime, Guid? BranchId, string? BranchName, int? MaxOrders, int DisplayOrder, bool Enabled, DateTime UpdatedAt);
public sealed record PublicDeliverySlot(Guid Id, string Label, string StartTime, string EndTime, Guid? BranchId, int? MaxOrders);
public sealed record UpsertDeliverySlotRequest(string Label, string StartTime, string EndTime, Guid? BranchId, int? MaxOrders, int DisplayOrder, bool Enabled);
public sealed record UpsertProductRequest(string Name, string Slug, string Sku, Guid MedicineId, Guid BrandId, decimal Mrp, decimal SellingPrice, string? ImageUrl, bool IsFeatured, bool IsActive, string? Barcode, string? PackSize, decimal TaxRate, decimal DiscountPercent, bool IsBestSeller, bool IsNewArrival, string? SearchKeywords, string? BonusScheme = null, IReadOnlyList<string>? ImageUrls = null, bool IsTrending = false, bool IsHotDeal = false, string? CompanyCode = null, string? CompanyName = null, string? ImageSourceUrl = null, string ImageVerificationStatus = "MISSING", string? ImageSourceReference = null, decimal DemandScore = 0, string DemandBasis = "NO_HISTORY", string? DemandSourceUrl = null, string? DemandSourceReference = null, int DisplayOrder = 0);

public sealed record UpdateProductImageRequest(string ImageUrl, IReadOnlyList<string>? ImageUrls = null, string? ImageSourceUrl = null, string ImageVerificationStatus = "UNVERIFIED", string? ImageSourceReference = null);

public sealed record CatalogWorkbookPreviewRow(int RowNumber, string CompanyCode, string CompanyName, string ProductName, bool IsValid, bool IsDuplicate, bool WillUpdate, IReadOnlyList<string> Errors, string ImageStatus, decimal DemandScore, string DemandBasis);
public sealed record CatalogWorkbookPreviewResponse(IReadOnlyList<CatalogWorkbookPreviewRow> Rows, int TotalRows, int ValidRows, int DuplicateRows, int InvalidRows, int BlankRows);
public sealed record CatalogWorkbookImportResult(int Added, int Updated, int SkippedDuplicates, int InvalidRows, int MissingImageRows, int SalesHistoryRows, int ResearchBasedRows, IReadOnlyList<string> Errors);
public sealed record BulkProductStatusRequest(IReadOnlyList<Guid> ProductIds, bool IsActive);
public sealed record BulkOperationResponse(int Requested, int Updated, IReadOnlyList<Guid> Missing);
public sealed record ProductImportPreviewRow(int RowNumber, string ProductName, string Category, string BranchName, string? Barcode, decimal? SalePrice, bool IsTrending, IReadOnlyList<string> ImageFilenames, bool IsValid, IReadOnlyList<string> Errors, bool WillUpdate);
public sealed record ProductImportPreviewResponse(IReadOnlyList<ProductImportPreviewRow> Rows, int ValidRows, int ErrorRows);
public sealed record ProductImportResult(int Added, int Updated, int Failed, IReadOnlyList<string> Errors);
public sealed record UpsertMedicineRequest(string Name, string? GenericName, string? Strength, string? DosageForm, string? Description, string? Uses, string? Warnings, string? SideEffects, string? StorageInformation, bool PrescriptionRequired, bool IsActive, Guid? CategoryId, Guid? ManufacturerId);
public sealed record StockAdjustmentRequest(int QuantityDelta, string Note, string Type);
public sealed record InventoryTransferRequest(Guid TargetBranchId, int Quantity, string Note);
public sealed record InventoryTransferResponse(AdminInventoryRow Source, AdminInventoryRow Target);
public sealed record UpsertStaffRequest(string FullName, string Email, string Phone, string Role, Guid? BranchId, string? LicenseReference, string[]? Permissions, bool IsActive, string? Password, string? EmployeeId = null, string? Address = null, DateTime? JoiningDate = null, string? Department = null, string? JobTitle = null, string? AppointmentType = null, string? EmploymentStatus = null, string? OfficialEmail = null, DateTime? DateOfBirth = null, string? Gender = null, string? MaritalStatus = null, string? TaxNumber = null, string? CitizenshipNumber = null, string? EmergencyContactName = null, string? EmergencyContactPhone = null, string? BloodGroup = null, string? DeviceEnrollmentId = null, bool MobileAccessEnabled = true, bool WebAccessEnabled = true);
public sealed record UpsertRoleRequest(string Name, string DisplayName, string? Description, bool IsActive, string[] Permissions);
public sealed record UpsertPaymentMethodRequest(string Code, string DisplayName, string? Instructions, decimal? MinimumOrder, decimal? MaximumOrder, int DisplayOrder, bool IsEnabled, bool RequiresServerVerification, string? QrCodeUrl = null);
public sealed record UpdatePaymentTransactionRequest(string Status, string? ProviderReference, string? Notes);
public sealed record UpsertCouponRequest(string Code, string Type, decimal Value, decimal? MinimumOrder, decimal? MaximumDiscount, int? UsageLimit, DateTime? StartsAt, DateTime? EndsAt, bool FirstOrderOnly, bool IsActive);
public sealed record SetActiveRequest(bool IsActive);
public sealed record AdminFlashSaleRow(Guid Id, string Name, Guid ProductId, string ProductName, Guid? BranchId, string? BranchName, decimal DiscountPercent, int? QuantityLimit, int QuantitySold, DateTime StartsAt, DateTime EndsAt, bool IsActive, string Status);
public sealed record UpsertFlashSaleRequest(string Name, Guid ProductId, Guid? BranchId, decimal DiscountPercent, int? QuantityLimit, DateTime StartsAt, DateTime EndsAt, bool IsActive);
public sealed record AdminPurchaseOrderItemRow(Guid Id, Guid ProductId, string ProductName, string Sku, int QuantityOrdered, int QuantityReceived, decimal UnitCost, string? BatchNumber, DateTime? ExpiryDate, string Unit = "piece", int UnitMultiplier = 1);
public sealed record AdminPurchaseOrderRow(Guid Id, string OrderNumber, Guid SupplierId, string SupplierName, Guid BranchId, string BranchName, string Status, DateTime? ExpectedAt, decimal TotalAmount, int ItemCount, int ReceivedItemCount, DateTime CreatedAt);
public sealed record AdminPurchaseOrderDetail(Guid Id, string OrderNumber, Guid SupplierId, string SupplierName, Guid BranchId, string BranchName, string Status, DateTime? ExpectedAt, string? Notes, decimal TotalAmount, DateTime CreatedAt, IReadOnlyList<AdminPurchaseOrderItemRow> Items);
public sealed record PurchaseOrderItemRequest(Guid ProductId, int Quantity, decimal UnitCost, string? BatchNumber, DateTime? ExpiryDate, string? Unit = null);
public sealed record CreatePurchaseOrderRequest(Guid SupplierId, Guid BranchId, DateTime? ExpectedAt, string? Notes, IReadOnlyList<PurchaseOrderItemRequest> Items);
public sealed record ReceivePurchaseOrderItemRequest(Guid ItemId, int Quantity, string? BatchNumber, DateTime? ExpiryDate);
public sealed record ReceivePurchaseOrderRequest(IReadOnlyList<ReceivePurchaseOrderItemRequest> Items, string PaymentMode = "CREDIT", decimal? PaidAmount = null, string? SupplierInvoiceReference = null);
