namespace backend.Contracts;

public sealed record ProductListItem(
    Guid Id,
    string Name,
    string Slug,
    string Sku,
    string GenericName,
    string Brand,
    string Category,
    string? Strength,
    string? DosageForm,
    decimal Mrp,
    decimal SellingPrice,
    int StockQuantity,
    bool PrescriptionRequired,
    bool IsFeatured,
    DateTime CreatedAt,
    decimal? FlashSalePrice = null,
    decimal? FlashSaleDiscountPercent = null,
    DateTime? FlashSaleEndsAt = null,
    int? FlashSaleRemaining = null,
    string? ImageUrl = null,
    decimal? WholesaleDiscountPercent = null,
    string? BonusScheme = null,
    IReadOnlyList<string>? ImageUrls = null,
    bool IsTrending = false,
    bool IsHotDeal = false,
    bool PricesVisible = true,
    string? CompanyCode = null,
    string? CompanyName = null,
    decimal DemandScore = 0);

public sealed record ProductDetailResponse(
    Guid Id,
    string Name,
    string Slug,
    string Sku,
    string GenericName,
    string Brand,
    string Manufacturer,
    string Category,
    string? Strength,
    string? DosageForm,
    string? Description,
    string? Uses,
    string? Warnings,
    string? SideEffects,
    string? StorageInformation,
    decimal Mrp,
    decimal SellingPrice,
    int StockQuantity,
    bool PrescriptionRequired,
    string? ImageUrl,
    DateTime CreatedAt,
    decimal? FlashSalePrice = null,
    decimal? FlashSaleDiscountPercent = null,
    DateTime? FlashSaleEndsAt = null,
    int? FlashSaleRemaining = null,
    decimal? WholesaleDiscountPercent = null,
    string? BonusScheme = null,
    IReadOnlyList<string>? ImageUrls = null,
    bool IsTrending = false,
    bool IsHotDeal = false,
    bool PricesVisible = true,
    string? CompanyCode = null,
    string? CompanyName = null,
    decimal DemandScore = 0,
    string? ImageSourceUrl = null,
    string ImageVerificationStatus = "MISSING",
    string? ImageSourceReference = null,
    string DemandBasis = "NO_HISTORY",
    string? DemandSourceUrl = null,
    string? DemandSourceReference = null);

public sealed record TrendingProductItem(Guid Id, string Name, string Slug, decimal SellingPrice, string? ImageUrl, IReadOnlyList<string> ImageUrls, bool PricesVisible = true);

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems, int TotalPages);

public sealed record RegisterRequest(
    string? FullName,
    string Email,
    string Phone,
    string Password,
    string ConfirmPassword,
    string AccountType = "PERSONAL",
    string? Username = null,
    string? Gender = null,
    DateTime? DateOfBirth = null,
    string? Province = null,
    string? District = null,
    string? Municipality = null,
    string? Ward = null,
    string? DeliveryAddress = null,
    string? PanNumber = null,
    string? PanRegisteredName = null,
    string? PharmacyName = null,
    string? DrugLicenseNumber = null,
    string? OwnerPhone = null,
    string? OwnerEmail = null,
    string? ContactPersonName = null,
    string? Telephone = null,
    string? Landmark = null,
    string? PharmacistRegistrationNumber = null,
    Guid? PreferredBranchId = null,
    string? PharmacyCategory = null,
    string? PanVerificationStatus = null);
public sealed record LoginRequest(string EmailOrPhone, string Password);
public sealed record ForgotPasswordDemoRequest(string Identifier, string AccountType = "CUSTOMER");
public sealed record ForgotPasswordDemoResponse(Guid ChallengeId, string Message, string? DemoCode, DateTime ExpiresAt);
public sealed record ResetPasswordDemoRequest(Guid ChallengeId, string VerificationCode, string NewPassword, string ConfirmPassword);
public sealed record PharmacyDetailsResponse(Guid CustomerId, string PanNumber, string? PanRegisteredName, string? PharmacyName, string? Province, string? District, string? Municipality, string? Ward, string? Address, string? DrugLicenseNumber, string? OwnerPhone, string? OwnerEmail, string Category, string PanVerificationStatus, DateTime? PanVerifiedAtUtc, string? ContactPersonName = null, string? Telephone = null, string? Landmark = null, string? PharmacistRegistrationNumber = null, Guid? PreferredBranchId = null);
public sealed record CustomerResponse(Guid Id, string FullName, string Email, string Phone, string AccountType = "PERSONAL", PharmacyDetailsResponse? Pharmacy = null, string? Username = null, string? Gender = null, DateTime? DateOfBirth = null);
public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, CustomerResponse Customer);
public sealed record PanVerificationRequest(string PanNumber);
public sealed record PanVerificationResponse(string Status, string? RegisteredName, string Message, string Source);
public sealed record PublicBranchResponse(Guid Id, string Name, string Address, string? Province, string? District, string? Municipality, string? Ward);
public sealed record StaffResponse(Guid Id, string FullName, string Email, string Phone, string Role, Guid? BranchId, string? BranchName, string? LicenseReference, bool IsActive, string[] Permissions);
public sealed record StaffAuthResponse(string AccessToken, DateTime ExpiresAt, StaffResponse Staff);

public sealed record PrescriptionExtractedItemResponse(
    Guid Id,
    string DetectedName,
    string NormalizedName,
    string? Strength,
    string? DosageForm,
    int? Quantity,
    string? Frequency,
    string? Duration,
    string? Instructions,
    bool CustomerEdited,
    IReadOnlyList<PrescriptionMatchResponse> Matches,
    string? Dosage = null,
    string? Timing = null);

public sealed record PrescriptionMatchResponse(
    Guid Id,
    Guid? ProductId,
    string? ProductName,
    string? Brand,
    decimal? SellingPrice,
    decimal Confidence,
    string MatchType,
    string Availability,
    int StockQuantity,
    bool NeedsPharmacistReview,
    bool PrescriptionRequired,
    string? ProductSlug = null);

public sealed record PrescriptionResponse(
    Guid Id,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    string Status,
    string? OcrProvider,
    string? OcrStatus,
    string? CustomerNote,
    DateTime CreatedAt,
    DateTime? SubmittedAt,
    IReadOnlyList<PrescriptionExtractedItemResponse> Items);

public sealed record UpdatePrescriptionItemRequest(
    string DetectedName,
    string? Strength,
    string? DosageForm,
    int? Quantity,
    string? Frequency,
    string? Duration,
    string? Instructions,
    string? Dosage = null,
    string? Timing = null);

public sealed record SubmitPrescriptionRequest(string? CustomerNote);

public sealed record AssistantChatRequest(string Message, string? SessionId = null);
public sealed record AssistantSuggestedPrompt(string Label, string Prompt);
public sealed record AssistantProduct(
    Guid Id,
    string Name,
    string Slug,
    string Brand,
    decimal Price,
    string? ImageUrl,
    IReadOnlyList<string> ImageUrls,
    int StockQuantity,
    bool PrescriptionRequired,
    bool PricesVisible = true);
public sealed record AssistantChatResponse(
    string Message,
    IReadOnlyList<AssistantSuggestedPrompt> SuggestedPrompts,
    IReadOnlyList<AssistantProduct> Products,
    string SessionId,
    string SupportUrl);
