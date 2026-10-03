using System.Security.Claims;
using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public sealed class AuthController(ApplicationDbContext dbContext, IPasswordService passwordService, IAuthTokenService tokenService, IPanVerificationService panVerificationService) : ControllerBase
{
    private static readonly ConcurrentDictionary<Guid, DemoResetChallenge> DemoResetChallenges = new();
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var accountType = request.AccountType.Trim().ToUpperInvariant();
        if (accountType is not ("PERSONAL" or "PHARMACY")) return BadRequest(new { message = "Choose Personal Use or Pharmacy as your account type." });
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Phone)) return BadRequest(new { message = "Email and phone are required." });
        if (request.Password.Length < 8 || request.Password != request.ConfirmPassword) return BadRequest(new { message = "Passwords must match and be at least 8 characters." });
        var email = request.Email.Trim().ToLowerInvariant();
        var phone = request.Phone.Trim();
        if (!Regex.IsMatch(phone, "^(98|97)\\d{8}$")) return BadRequest(new { message = "Enter a valid Nepal mobile number starting with 98 or 97." });
        var username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim().ToLowerInvariant();
        if (username is not null && !Regex.IsMatch(username, "^[a-z0-9._-]{3,80}$")) return BadRequest(new { message = "Username must be 3–80 characters and use only letters, numbers, dots, underscores, or hyphens." });
        if (await dbContext.Customers.AnyAsync(x => x.Email == email || x.Phone == phone || (username != null && x.Username == username), cancellationToken)) return Conflict(new { message = "An account with that email, phone, or username already exists." });
        if (accountType == "PHARMACY")
        {
            var pan = new string((request.PanNumber ?? string.Empty).Where(char.IsDigit).ToArray());
            if (pan.Length != 9) return BadRequest(new { message = "A valid 9-digit PAN number is required for pharmacy accounts." });
            if (string.IsNullOrWhiteSpace(request.PharmacyName) || string.IsNullOrWhiteSpace(request.DrugLicenseNumber) || string.IsNullOrWhiteSpace(request.ContactPersonName) || string.IsNullOrWhiteSpace(request.OwnerPhone) || string.IsNullOrWhiteSpace(request.OwnerEmail) || string.IsNullOrWhiteSpace(request.Province) || string.IsNullOrWhiteSpace(request.District) || string.IsNullOrWhiteSpace(request.Municipality) || string.IsNullOrWhiteSpace(request.Ward) || string.IsNullOrWhiteSpace(request.DeliveryAddress)) return BadRequest(new { message = "Complete PAN, pharmacy name, license, contact person, mobile, email, and full location details." });
            var ownerPhone = request.OwnerPhone.Trim();
            if (!Regex.IsMatch(ownerPhone, "^(98|97)\\d{8}$")) return BadRequest(new { message = "Enter a valid Nepal contact mobile number starting with 98 or 97." });
            if (await dbContext.PharmacyDetails.AnyAsync(x => x.PanNumber == pan, cancellationToken)) return Conflict(new { message = "An account with this PAN number already exists." });
            var verification = await panVerificationService.VerifyAsync(pan, cancellationToken);
            var registeredName = verification.RegisteredName ?? request.PanRegisteredName?.Trim();
            if (!verification.IsVerified && string.IsNullOrWhiteSpace(registeredName)) return BadRequest(new { message = verification.Message, panVerificationStatus = verification.Status });
            var customer = new Customer { FullName = request.ContactPersonName.Trim(), Email = email, Phone = phone, Username = username, PasswordHash = passwordService.Hash(request.Password), AccountType = accountType };
            dbContext.Customers.Add(customer);
            dbContext.PharmacyDetails.Add(new PharmacyDetails { Customer = customer, PanNumber = pan, PanRegisteredName = registeredName, PharmacyName = request.PharmacyName.Trim(), Province = request.Province.Trim(), District = request.District.Trim(), Municipality = request.Municipality.Trim(), Ward = request.Ward.Trim(), Address = request.DeliveryAddress.Trim(), DrugLicenseNumber = request.DrugLicenseNumber.Trim(), OwnerPhone = ownerPhone, OwnerEmail = request.OwnerEmail.Trim().ToLowerInvariant(), ContactPersonName = request.ContactPersonName.Trim(), Telephone = request.Telephone?.Trim(), Landmark = request.Landmark?.Trim(), PharmacistRegistrationNumber = request.PharmacistRegistrationNumber?.Trim(), PreferredBranchId = request.PreferredBranchId, Category = string.Equals(request.PharmacyCategory, "WHOLESALE", StringComparison.OrdinalIgnoreCase) ? "WHOLESALE" : "RETAIL", PanVerificationStatus = verification.IsVerified ? "VERIFIED" : "MANUAL_FALLBACK", PanVerifiedAtUtc = verification.IsVerified ? DateTime.UtcNow : null, PanVerificationSource = verification.Source });
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(CreateResponse(customer));
        }
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Province) || string.IsNullOrWhiteSpace(request.District) || string.IsNullOrWhiteSpace(request.Municipality) || string.IsNullOrWhiteSpace(request.Ward) || string.IsNullOrWhiteSpace(request.DeliveryAddress)) return BadRequest(new { message = "Complete full name, email, mobile, and full delivery location details." });
        var personal = new Customer { FullName = request.FullName.Trim(), Email = email, Phone = phone, Username = username, Gender = request.Gender?.Trim(), DateOfBirth = request.DateOfBirth?.Date, PasswordHash = passwordService.Hash(request.Password), AccountType = accountType };
        personal.Addresses.Add(new Address { Label = "Primary delivery address", Province = request.Province.Trim(), District = request.District.Trim(), Municipality = request.Municipality.Trim(), Ward = request.Ward.Trim(), StreetTole = request.DeliveryAddress.Trim(), Landmark = request.Landmark?.Trim(), Phone = phone, IsDefault = true });
        dbContext.Customers.Add(personal);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(CreateResponse(personal));
    }

    [HttpPost("verify-pan")]
    public async Task<ActionResult<PanVerificationResponse>> VerifyPan(PanVerificationRequest request, CancellationToken cancellationToken)
    {
        var result = await panVerificationService.VerifyAsync(request.PanNumber, cancellationToken);
        return Ok(new PanVerificationResponse(result.Status, result.RegisteredName, result.Message, result.Source));
    }

    [HttpPost("forgot-password/demo")]
    public async Task<ActionResult<ForgotPasswordDemoResponse>> ForgotPasswordDemo(ForgotPasswordDemoRequest request, CancellationToken cancellationToken)
    {
        var identifier = request.Identifier?.Trim() ?? string.Empty;
        var accountType = request.AccountType.Trim().ToUpperInvariant();
        if (identifier.Length < 3 || identifier.Length > 240) return BadRequest(new { message = "Enter your email address or username." });
        if (accountType is not ("CUSTOMER" or "STAFF")) return BadRequest(new { message = "Choose a valid account type." });
        foreach (var expired in DemoResetChallenges.Where(x => x.Value.ExpiresAt <= DateTime.UtcNow).Select(x => x.Key).ToList()) DemoResetChallenges.TryRemove(expired, out _);

        Guid accountId;
        if (accountType == "STAFF")
        {
            var staff = await dbContext.StaffUsers.AsNoTracking().SingleOrDefaultAsync(x => x.Email == identifier.ToLowerInvariant() || x.Phone == identifier, cancellationToken);
            accountId = staff?.Id ?? Guid.Empty;
        }
        else
        {
            var customer = await dbContext.Customers.AsNoTracking().SingleOrDefaultAsync(x => x.Email == identifier.ToLowerInvariant() || x.Username == identifier.ToLowerInvariant() || x.Phone == identifier, cancellationToken);
            accountId = customer?.Id ?? Guid.Empty;
        }
        var expiresAt = DateTime.UtcNow.AddMinutes(10);
        if (accountId == Guid.Empty) return Ok(new ForgotPasswordDemoResponse(Guid.Empty, "If the account exists, a demo verification code is available for the next 10 minutes.", null, expiresAt));
        var challengeId = Guid.NewGuid();
        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString(CultureInfo.InvariantCulture);
        DemoResetChallenges[challengeId] = new DemoResetChallenge(accountType, accountId, passwordService.Hash(code), expiresAt);
        return Ok(new ForgotPasswordDemoResponse(challengeId, "Demo mode: use the verification code shown below. Real email/SMS delivery is not configured yet.", code, expiresAt));
    }

    [HttpPost("reset-password/demo")]
    public async Task<IActionResult> ResetPasswordDemo(ResetPasswordDemoRequest request, CancellationToken cancellationToken)
    {
        if (request.NewPassword.Length < 8 || request.NewPassword != request.ConfirmPassword) return BadRequest(new { message = "Passwords must match and be at least 8 characters." });
        if (!DemoResetChallenges.TryGetValue(request.ChallengeId, out var challenge) || challenge.ExpiresAt <= DateTime.UtcNow) return BadRequest(new { message = "This demo verification has expired. Start again." });
        if (!passwordService.Verify(request.VerificationCode.Trim(), challenge.CodeHash)) return BadRequest(new { message = "The demo verification code is incorrect." });
        if (challenge.AccountType == "STAFF")
        {
            var staff = await dbContext.StaffUsers.SingleOrDefaultAsync(x => x.Id == challenge.AccountId, cancellationToken);
            if (staff is null) return BadRequest(new { message = "The account could not be found." });
            staff.PasswordHash = passwordService.Hash(request.NewPassword); staff.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var customer = await dbContext.Customers.SingleOrDefaultAsync(x => x.Id == challenge.AccountId, cancellationToken);
            if (customer is null) return BadRequest(new { message = "The account could not be found." });
            customer.PasswordHash = passwordService.Hash(request.NewPassword); customer.UpdatedAt = DateTime.UtcNow;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        DemoResetChallenges.TryRemove(request.ChallengeId, out _);
        return Ok(new { message = "Password reset successfully. You can now sign in with the new password." });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var login = request.EmailOrPhone.Trim();
        var customer = await dbContext.Customers.Include(x => x.PharmacyDetails).SingleOrDefaultAsync(x => x.Email == login.ToLowerInvariant() || x.Phone == login || x.Username == login.ToLowerInvariant(), cancellationToken);
        if (customer is null || !customer.IsActive || !passwordService.Verify(request.Password, customer.PasswordHash)) return Unauthorized(new { message = "The email/phone or password is incorrect." });
        return Ok(CreateResponse(customer));
    }

    [HttpGet("me")]
    public async Task<ActionResult<CustomerResponse>> Me(CancellationToken cancellationToken)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var customer = await dbContext.Customers.AsNoTracking().Include(x => x.PharmacyDetails).SingleOrDefaultAsync(x => x.Id == customerId, cancellationToken);
        return customer is null ? NotFound() : Ok(ToResponse(customer));
    }

    [HttpPost("staff-login")]
    public async Task<ActionResult<StaffAuthResponse>> StaffLogin(LoginRequest request, CancellationToken cancellationToken)
    {
        var login = request.EmailOrPhone.Trim();
        var staff = await dbContext.StaffUsers.Include(x => x.Branch).SingleOrDefaultAsync(x => x.Email == login.ToLowerInvariant() || x.Phone == login, cancellationToken);
        var roleActive = staff is null ? true : await dbContext.AccessRoles.AsNoTracking().Where(x => x.Name == staff.Role).Select(x => (bool?)x.IsActive).SingleOrDefaultAsync(cancellationToken) ?? true;
        if (staff is null || !staff.IsActive || !roleActive || !passwordService.Verify(request.Password, staff.PasswordHash)) return Unauthorized(new { message = "The staff email/phone or password is incorrect." });
        var token = tokenService.Create(staff);
        return Ok(new StaffAuthResponse(token.Token, token.ExpiresAt, ToResponse(staff)));
    }

    [HttpGet("staff-me")]
    public async Task<ActionResult<StaffResponse>> StaffMe(CancellationToken cancellationToken)
    {
        if (!User.TryGetStaffId(out var staffId)) return Unauthorized();
        var staff = await dbContext.StaffUsers.AsNoTracking().Include(x => x.Branch).SingleOrDefaultAsync(x => x.Id == staffId, cancellationToken);
        return staff is null ? NotFound() : Ok(ToResponse(staff));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            tokenService.Revoke(authorization[7..].Trim());
        return NoContent();
    }

    private AuthResponse CreateResponse(Customer customer)
    {
        var token = tokenService.Create(customer);
        return new AuthResponse(token.Token, token.ExpiresAt, ToResponse(customer));
    }

    private static CustomerResponse ToResponse(Customer customer) => new(customer.Id, customer.FullName, customer.Email, customer.Phone, customer.AccountType, customer.PharmacyDetails is null ? null : new PharmacyDetailsResponse(customer.PharmacyDetails.CustomerId, customer.PharmacyDetails.PanNumber, customer.PharmacyDetails.PanRegisteredName, customer.PharmacyDetails.PharmacyName, customer.PharmacyDetails.Province, customer.PharmacyDetails.District, customer.PharmacyDetails.Municipality, customer.PharmacyDetails.Ward, customer.PharmacyDetails.Address, customer.PharmacyDetails.DrugLicenseNumber, customer.PharmacyDetails.OwnerPhone, customer.PharmacyDetails.OwnerEmail, customer.PharmacyDetails.Category, customer.PharmacyDetails.PanVerificationStatus, customer.PharmacyDetails.PanVerifiedAtUtc, customer.PharmacyDetails.ContactPersonName, customer.PharmacyDetails.Telephone, customer.PharmacyDetails.Landmark, customer.PharmacyDetails.PharmacistRegistrationNumber, customer.PharmacyDetails.PreferredBranchId), customer.Username, customer.Gender, customer.DateOfBirth);
    private static StaffResponse ToResponse(StaffUser staff) => new(staff.Id, staff.FullName, staff.Email, staff.Phone, staff.Role, staff.BranchId, staff.Branch?.Name, staff.LicenseReference, staff.IsActive, EffectivePermissions(staff));
    private static string[] EffectivePermissions(StaffUser staff) => string.IsNullOrWhiteSpace(staff.PermissionsCsv) ? AppPermissions.DefaultsFor(staff.Role).OrderBy(x => x).ToArray() : staff.PermissionsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToArray();
    private sealed record DemoResetChallenge(string AccountType, Guid AccountId, string CodeHash, DateTime ExpiresAt);
}

internal static class ClaimsPrincipalExtensions
{
    public static bool TryGetCustomerId(this ClaimsPrincipal principal, out Guid customerId)
    {
        customerId = Guid.Empty;
        var accountType = principal.FindFirstValue("account_type");
        return (string.IsNullOrWhiteSpace(accountType) || accountType.Equals("customer", StringComparison.OrdinalIgnoreCase)) && Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out customerId);
    }

    public static bool TryGetStaffId(this ClaimsPrincipal principal, out Guid staffId)
    {
        staffId = Guid.Empty;
        return principal.HasClaim("account_type", "staff") && Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out staffId);
    }

    public static bool IsStaffRole(this ClaimsPrincipal principal, params string[] roles)
    {
        return principal.TryGetStaffId(out _) && roles.Contains(principal.FindFirstValue(ClaimTypes.Role), StringComparer.OrdinalIgnoreCase);
    }

    public static bool HasStaffPermission(this ClaimsPrincipal principal, string permission)
    {
        if (!principal.TryGetStaffId(out _)) return false;
        if (principal.IsStaffRole(StaffRoles.SuperAdmin)) return true;
        var role = principal.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var permissions = principal.FindAll("permission").Select(x => x.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return permissions.Count == 0 ? AppPermissions.DefaultsFor(role).Contains(permission) : permissions.Contains(permission);
    }
}
