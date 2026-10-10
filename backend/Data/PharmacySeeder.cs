using backend.Models;
using backend.Contracts;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace backend.Data;

public static class PharmacySeeder
{
    public static async Task SeedAsync(ApplicationDbContext dbContext, CancellationToken cancellationToken = default)
    {
        var hasCatalogue = await dbContext.Products.AnyAsync(cancellationToken);
        if (!hasCatalogue)
        {
        var medicinesCategory = new Category { Name = "Everyday medicines", Slug = "everyday-medicines" };
        var vitaminsCategory = new Category { Name = "Vitamins & supplements", Slug = "vitamins-supplements" };
        var deviceCategory = new Category { Name = "Medical devices", Slug = "medical-devices" };
        var firstAidCategory = new Category { Name = "First aid", Slug = "first-aid" };
        var cipla = new Brand { Name = "Cipla", Slug = "cipla" };
        var himalaya = new Brand { Name = "Himalaya", Slug = "himalaya" };
        var omron = new Brand { Name = "Omron", Slug = "omron" };
        var sanofi = new Brand { Name = "Sanofi", Slug = "sanofi" };
        var localManufacturer = new Manufacturer { Name = "Development catalogue", Country = "Nepal" };
        var branch = new Branch { Name = "Kathmandu central pharmacy", Address = "Kathmandu, Nepal" };
        dbContext.AddRange(medicinesCategory, vitaminsCategory, deviceCategory, firstAidCategory, cipla, himalaya, omron, sanofi, localManufacturer, branch);
        var paracetamol = new Medicine { Name = "Paracetamol", GenericName = "Paracetamol", Strength = "500 mg", DosageForm = "Tablet", PrescriptionRequired = false, Category = medicinesCategory, Manufacturer = localManufacturer, Description = "Pain and fever relief medicine. Follow pack directions or professional advice." };
        var cetirizine = new Medicine { Name = "Cetirizine", GenericName = "Cetirizine hydrochloride", Strength = "10 mg", DosageForm = "Tablet", PrescriptionRequired = false, Category = medicinesCategory, Manufacturer = localManufacturer, Description = "Allergy symptom relief. Ask a pharmacist if you have questions." };
        var amoxicillin = new Medicine { Name = "Amoxicillin", GenericName = "Amoxicillin", Strength = "500 mg", DosageForm = "Capsule", PrescriptionRequired = true, Category = medicinesCategory, Manufacturer = localManufacturer, Description = "Prescription antibiotic. Pharmacist verification is required before dispensing." };
        var vitaminC = new Medicine { Name = "Vitamin C + Zinc", GenericName = "Ascorbic acid and zinc", Strength = "60 tablets", DosageForm = "Tablet", PrescriptionRequired = false, Category = vitaminsCategory, Manufacturer = localManufacturer, Description = "Daily nutritional support in tablet form." };
        var thermometer = new Medicine { Name = "Digital Thermometer", GenericName = "Digital clinical thermometer", Strength = null, DosageForm = "Device", PrescriptionRequired = false, Category = deviceCategory, Manufacturer = localManufacturer, Description = "Easy-to-read digital thermometer for home health checks." };
        var antiseptic = new Medicine { Name = "Antiseptic Solution", GenericName = "Povidone iodine solution", Strength = "100 ml", DosageForm = "Solution", PrescriptionRequired = false, Category = firstAidCategory, Manufacturer = localManufacturer, Description = "For external first-aid use. Follow label directions." };
        dbContext.AddRange(paracetamol, cetirizine, amoxicillin, vitaminC, thermometer, antiseptic);
        dbContext.AddRange(
            Product("Paracetamol 500 mg", "paracetamol-500-mg", "ANHH-PAR-500", 50, 42, cipla, paracetamol, true),
            Product("Cetirizine 10 mg", "cetirizine-10-mg", "ANHH-CET-010", 32, 28, himalaya, cetirizine, true),
            Product("Amoxicillin 500 mg", "amoxicillin-500-mg", "ANHH-AMX-500", 180, 155, cipla, amoxicillin, false),
            Product("Vitamin C + Zinc", "vitamin-c-zinc", "ANHH-VIT-CZ", 450, 395, himalaya, vitaminC, true),
            Product("Digital Thermometer", "digital-thermometer", "ANHH-OMR-THERM", 600, 525, omron, thermometer, true),
            Product("Antiseptic Solution", "antiseptic-solution", "ANHH-SAN-ANT", 210, 185, sanofi, antiseptic, true));
        await dbContext.SaveChangesAsync(cancellationToken);
        var products = await dbContext.Products.ToListAsync(cancellationToken);
        dbContext.AddRange(products.Select(product => new Inventory { ProductId = product.Id, BranchId = branch.Id, BatchNumber = $"DEV-{product.Sku[^6..]}", PurchasePrice = product.SellingPrice * .7m, ExpiryDate = DateTime.UtcNow.Date.AddMonths(product.Sku.Contains("AMX", StringComparison.Ordinal) ? 4 : 18), MinimumStock = 5, Supplier = "Development supplier", StockQuantity = product.Sku.Contains("AMX", StringComparison.Ordinal) ? 0 : 24, ReservedQuantity = 0 }));
        await dbContext.SaveChangesAsync(cancellationToken);
        }

        await EnsureProductImages(dbContext, cancellationToken);

        var centralBranch = await dbContext.Branches.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        if (centralBranch is not null)
        {
            centralBranch.Code ??= "KTM-CENTRAL";
            centralBranch.Phone ??= "01-5550100";
            centralBranch.Email ??= "support@example.com";
            centralBranch.Province ??= "Bagmati";
            centralBranch.District ??= "Kathmandu";
            centralBranch.Municipality ??= "Kathmandu Metropolitan City";
            centralBranch.Ward ??= "10";
            centralBranch.StreetTole ??= "New Baneshwor";
            centralBranch.DeliveryEnabled = true;
            centralBranch.PickupEnabled = true;
            centralBranch.UpdatedAt = DateTime.UtcNow;
            var passwordService = new PasswordService();
            await EnsureStaff(dbContext, passwordService, "Development Pharmacist", "pharmacist@example.com", "9800000001", StaffRoles.Pharmacist, centralBranch.Id, "Pharmacist!123", "DEV-PHARM-001", cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development Delivery Staff", "delivery@example.com", "9800000002", StaffRoles.Delivery, centralBranch.Id, "Delivery!123", null, cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development Admin", "admin@example.com", "9800000003", StaffRoles.Admin, centralBranch.Id, "Admin!123", null, cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development Supervisor", "supervisor@example.com", "9800000004", StaffRoles.Supervisor, centralBranch.Id, "Supervisor!123", null, cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development Accountant", "accountant@example.com", "9800000006", StaffRoles.Accountant, centralBranch.Id, "Accountant!123", null, cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development Sales Executive", "sales@example.com", "9800000007", StaffRoles.SalesExecutive, centralBranch.Id, "Sales!123", null, cancellationToken);
            await EnsureStaff(dbContext, passwordService, "Development SuperAdmin", "superadmin@example.com", "9800000005", StaffRoles.SuperAdmin, centralBranch.Id, "SuperAdmin!123", null, cancellationToken);
            await EnsureCustomer(dbContext, passwordService, "Development Customer", "customer@example.com", "9810000000", "Customer!123", cancellationToken);
            await EnsurePharmacyCustomer(dbContext, passwordService, "Development Pharmacy", "pharmacy@example.com", "9810000010", "Pharmacy!123", cancellationToken);
        }

        if (!await dbContext.SystemSettings.AnyAsync(cancellationToken))
        {
            dbContext.SystemSettings.AddRange(
                new SystemSetting { Key = "website.name", Value = "All Nepal Healthy Home", Group = "general", IsPublic = true },
                new SystemSetting { Key = "website.shortName", Value = "ANHH", Group = "general", IsPublic = true },
                new SystemSetting { Key = "website.tagline", Value = "Trusted pharmacy care, delivered home", Group = "general", IsPublic = true },
                new SystemSetting { Key = "website.contactPhone", Value = "01-5550100", Group = "contact", IsPublic = true },
                new SystemSetting { Key = "website.contactEmail", Value = "support@example.com", Group = "contact", IsPublic = true },
                new SystemSetting { Key = "website.address", Value = "New Baneshwor, Kathmandu, Nepal", Group = "contact", IsPublic = true },
                new SystemSetting { Key = "theme.primaryColor", Value = "#003893", Group = "branding", IsPublic = true },
                new SystemSetting { Key = "theme.accentColor", Value = "#2563EB", Group = "branding", IsPublic = true },
                new SystemSetting { Key = "system.currency", Value = "NPR", Group = "system", IsPublic = true },
                new SystemSetting { Key = "system.timezone", Value = "Asia/Kathmandu", Group = "system", IsPublic = true });
        }
        await EnsureSystemSetting(dbContext, "system.dateFormat", "AD", "system", true, "Global date display format: AD or BS.", cancellationToken);
        await EnsureSystemSetting(dbContext, "system.timeFormat", "12", "system", true, "Global time display format: 12-hour or 24-hour.", cancellationToken);
        await EnsureSystemSetting(dbContext, "system.timezone", "Asia/Kathmandu", "system", true, "Global IANA timezone used for platform display and business time.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.banner.message", "Trusted healthcare operations · Accurate stock, sales and reports", "workspace", true, "Message shown in the pharmacy dashboard banner.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.header.right", "ALL NEPAL", "workspace", true, "Small right-side header label in the pharmacy workspace.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.footer.developer", "Developed for {company_name}", "workspace", true, "Left-side workspace footer text.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.footer.contact", "Pharmacy Management Workspace", "workspace", true, "Center workspace footer text.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.footer.version", "PMC Workspace", "workspace", true, "Right-side workspace footer text.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.labels", "{}", "workspace", true, "Editable pharmacy workspace menu, screen, report, and breadcrumb labels.", cancellationToken);
        await EnsureSystemSetting(dbContext, "workspace.menuOrder", "[\"Sales-Department\",\"Purchase-Department\",\"Reports-Inventory\",\"Reports-Account\",\"Catalogue\",\"Utility\",\"Setup\"]", "workspace", true, "Admin-configurable ordering for the pharmacy workspace top navigation and nested menus. Exit remains at the end.", cancellationToken);
        await EnsureSystemSetting(dbContext, "orders.configuration", OrderingConfiguration.DefaultJson, "orders", true, "Superadmin-controlled order modes, minimum quantities, product eligibility, and English/Nepali storefront copy.", cancellationToken);
        await EnsureSystemSetting(dbContext, "assistant.enabled", "true", "assistant", true, "Enable the customer-facing AI pharmacy assistant.", cancellationToken);
        await EnsureSystemSetting(dbContext, "assistant.name", "ANHH Assistant", "assistant", true, "Customer-facing assistant name.", cancellationToken);
        await EnsureSystemSetting(dbContext, "assistant.policy", "This assistant provides platform information only and does not diagnose, prescribe, or replace a pharmacist.", "assistant", true, "Additional policy context supplied to the assistant.", cancellationToken);
        await EnsureSystemSetting(dbContext, "system.tablePageSize", "25", "system", true, "Global default number of rows shown on management tables.", cancellationToken);
        await EnsureSystemSetting(dbContext, "notification.toast.position", "top-right", "notifications", true, "Global position for short success, error, and information notifications.", cancellationToken);
        await EnsureSystemSetting(dbContext, "notification.toast.duration", "4000", "notifications", true, "How long short notifications remain visible, in milliseconds.", cancellationToken);
        await EnsureSystemSetting(dbContext, "notification.toast.signedIn", "Signed in successfully", "notifications", true, "Success message shown after a customer signs in.", cancellationToken);
        await EnsureSystemSetting(dbContext, "notification.toast.accountCreated", "Account created successfully", "notifications", true, "Success message shown after a customer account is created.", cancellationToken);
        await EnsureSystemSetting(dbContext, "notification.toast.staffSignedIn", "Secure staff sign-in complete", "notifications", true, "Success message shown after a staff member signs in.", cancellationToken);
        await EnsureSystemSetting(dbContext, "maintenance.enabled", "false", "maintenance", true, "Put the customer website into maintenance mode.", cancellationToken);
        await EnsureSystemSetting(dbContext, "maintenance.message", "We are making a few improvements. Please check back shortly.", "maintenance", true, "Customer-facing maintenance message.", cancellationToken);
        await EnsureSystemSetting(dbContext, "maintenance.allowAdmin", "true", "maintenance", false, "Keep protected staff portals available during maintenance.", cancellationToken);
        await EnsureSystemSetting(dbContext, "website.design", JsonSerializer.Serialize(new { primary = "#003893", primaryDark = "#002B6F", primaryLight = "#EAF1FF", secondary = "#2563EB", secondaryDark = "#1D4ED8", secondaryLight = "#EFF6FF", background = "#FFFFFF", surface = "#F8FAFC", surfaceSecondary = "#F1F5F9", textPrimary = "#111827", textSecondary = "#64748B", border = "#E2E8F0", success = "#2563EB", warning = "#D97706", danger = "#DC2626", info = "#2563EB", fontFamily = "Inter", sideNavPosition = "LEFT", baseFontSize = 16, headingWeight = 700, bodyWeight = 400, buttonWeight = 700, headingLetterSpacing = "-0.02em", bodyLineHeight = 1.6, headingLineHeight = 1.15, hoverStyle = "COMBINED_SUBTLE", hoverDuration = 200, hoverScale = 1.02, buttonRadius = 8, buttonHeight = 44, cardRadius = 16, cardShadow = "SOFT", headerBackground = "#FFFFFF", headerText = "#111827", headerActive = "#003893", headerSticky = true, headerHeight = 72, heroTextAnimation = "FADE_UP", heroImageAnimation = "SOFT_SCALE", textDuration = 700, textDelay = 0, imageDuration = 700, imageDelay = 100, animationEasing = "ease-out" }), "website-design", true, "Customer website semantic design tokens.", cancellationToken);
        await EnsureSystemSetting(dbContext, "website.marquee", JsonSerializer.Serialize(new { enabled = true, mode = "SCROLL", backgroundColor = "#003893", textColor = "#FFFFFF", linkColor = "#FFFFFF", height = 36, fontSize = 13, fontWeight = 600, separator = "DIVIDER", messages = Array.Empty<object>() }), "website-design", true, "Customer announcement bar configuration.", cancellationToken);
        await EnsureViberContactWidget(dbContext, cancellationToken);
        foreach (var theme in ManagementSidebarThemeDefaults.Values)
            await EnsureSystemSetting(dbContext, $"management.sidebar.{theme.Key}", theme.Value, ManagementSidebarThemeDefaults.Group, false, "Global management sidebar appearance.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.prefix", "ANHH-INV", "invoice", false, "Prefix used for newly generated invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.companyName", "All Nepal Healthy Home", "invoice", false, "Business name printed on invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.companyAddress", "New Baneshwor, Kathmandu, Nepal", "invoice", false, "Business address printed on invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.panVat", "", "invoice", false, "Optional PAN or VAT number printed on invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.footer", "Thank you for choosing All Nepal Healthy Home.", "invoice", false, "Footer message printed on invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.terms", "Prescription medicines are dispensed only after pharmacist verification.", "invoice", false, "Terms printed on invoices.", cancellationToken);
        await EnsureSystemSetting(dbContext, "invoice.showTax", "true", "invoice", false, "Show the tax line when an invoice has tax applied.", cancellationToken);
        var homepageSectionDefaults = new[]
        {
            (Key: "hero", Title: "Your health, closer to home", Order: 10),
            (Key: "quick-services", Title: "Care made simple", Order: 20),
            (Key: "categories", Title: "Shop by category", Order: 30),
            (Key: "featured", Title: "Featured medicines", Order: 40),
            (Key: "deals", Title: "Current offers", Order: 50),
            (Key: "brands", Title: "Shop trusted brands", Order: 60),
            (Key: "prescription", Title: "Upload a prescription", Order: 70),
            (Key: "new-arrivals", Title: "New to the catalogue", Order: 80),
            (Key: "trust", Title: "A clearer way to shop for health", Order: 90),
            (Key: "articles", Title: "Health information", Order: 100),
        };
        foreach (var section in homepageSectionDefaults)
        {
            if (!await dbContext.HomepageSections.AnyAsync(x => x.SectionKey == section.Key, cancellationToken))
                dbContext.HomepageSections.Add(new HomepageSection
                {
                    SectionKey = section.Key,
                    Title = section.Title,
                    ContentJson = section.Key == "trust"
                        ? "{\"imageInformation\":\"/trust-product-information.png\",\"imageVerification\":\"/trust-verification.png\",\"imageDelivery\":\"/trust-delivery-nepal.png\"}"
                        : null,
                    DisplayOrder = section.Order,
                    Enabled = true,
                });
        }
        if (!await dbContext.WebsiteAssets.AnyAsync(x => x.Kind == "BANNER", cancellationToken)) dbContext.WebsiteAssets.Add(new WebsiteAsset { Kind = "BANNER", Title = "Care that comes to you", Subtitle = "Order trusted health essentials from All Nepal Healthy Home.", ButtonText = "Shop medicines", Destination = "/products", Priority = 10 });
        if (!await dbContext.WebsiteAssets.AnyAsync(x => x.Kind == "HERO" && x.LayoutVariant == "TYPEWRITER_GRAPHIC", cancellationToken))
        {
            var source = await dbContext.WebsiteAssets.AsNoTracking()
                .Where(x => x.Kind == "HERO")
                .OrderByDescending(x => x.Title.Contains("Danalac"))
                .ThenBy(x => x.Priority)
                .FirstOrDefaultAsync(cancellationToken);
            if (source is not null)
            {
                dbContext.WebsiteAssets.Add(new WebsiteAsset
                {
                    Kind = "HERO",
                    Title = source.Title,
                    Subtitle = source.Subtitle,
                    Description = source.Description,
                    ImageUrl = source.ImageUrl,
                    MobileImageUrl = source.MobileImageUrl ?? source.ImageUrl,
                    ButtonText = source.ButtonText,
                    Destination = source.Destination,
                    Priority = source.Priority + 1,
                    Enabled = true,
                    MobileEnabled = source.MobileEnabled,
                    DesktopEnabled = source.DesktopEnabled,
                    SecondaryButtonText = source.SecondaryButtonText,
                    SecondaryButtonUrl = source.SecondaryButtonUrl,
                    CustomLabel = source.CustomLabel,
                    LayoutVariant = "TYPEWRITER_GRAPHIC",
                    TypingSpeedMs = 52,
                    BackgroundColor = "#F8F6F1",
                    OverlayOpacity = source.OverlayOpacity,
                    TextAlignment = "LEFT",
                    ContentPosition = source.ContentPosition,
                    BackgroundPosition = source.BackgroundPosition,
                    AnimationType = source.AnimationType,
                    SlideDuration = source.SlideDuration,
                    TransitionDuration = source.TransitionDuration,
                    AutoplayEnabled = source.AutoplayEnabled,
                    PauseOnHover = source.PauseOnHover,
                    ShowNavigationArrows = source.ShowNavigationArrows,
                    ShowPaginationDots = source.ShowPaginationDots,
                    LoopSlides = source.LoopSlides,
                    RandomizeSlides = source.RandomizeSlides,
                    RespectSchedule = source.RespectSchedule,
                });
            }
        }
        if (!await dbContext.NavigationMenuItems.AnyAsync(cancellationToken))
        {
            dbContext.NavigationMenuItems.AddRange(
                new NavigationMenuItem { MenuKey = "header", Label = "Home", Url = "/", DisplayOrder = 10 },
                new NavigationMenuItem { MenuKey = "header", Label = "Shop medicines", Url = "/products", DisplayOrder = 20 },
                new NavigationMenuItem { MenuKey = "header", Label = "Categories", Url = "/categories", DisplayOrder = 30 },
                new NavigationMenuItem { MenuKey = "header", Label = "Brands", Url = "/brands", DisplayOrder = 40 },
                new NavigationMenuItem { MenuKey = "header", Label = "Prescription", Url = "/prescription", DisplayOrder = 50 },
                new NavigationMenuItem { MenuKey = "header", Label = "Health articles", Url = "/articles", DisplayOrder = 60 },
                new NavigationMenuItem { MenuKey = "header", Label = "Contact", Url = "/contact", DisplayOrder = 70 });
        }
        if (!await dbContext.SeoEntries.AnyAsync(cancellationToken))
            dbContext.SeoEntries.Add(new SeoEntry { Scope = "GLOBAL", Path = "/", Title = "All Nepal Healthy Home | Trusted Pharmacy Care", MetaDescription = "Licensed pharmacy care, genuine medicines and doorstep delivery across Nepal.", Keywords = "pharmacy Nepal, genuine medicines, prescription delivery", Robots = "index,follow" });
        if (!await dbContext.Coupons.AnyAsync(x => x.Code == "DEMO10", cancellationToken)) dbContext.Coupons.Add(new Coupon { Code = "DEMO10", Type = "PERCENTAGE", Value = 10, MaximumDiscount = 500, UsageLimit = 100, IsActive = true });
        if (!await dbContext.DeliveryZones.AnyAsync(cancellationToken)) dbContext.DeliveryZones.Add(new DeliveryZone { Name = "Kathmandu delivery", Province = "Bagmati", District = "Kathmandu", BranchId = centralBranch?.Id, DeliveryFee = 100, FreeDeliveryThreshold = 1000, MinimumOrder = 0, SameDayDelivery = true, Enabled = true });
        if (!await dbContext.DeliverySlots.AnyAsync(cancellationToken)) dbContext.DeliverySlots.AddRange(new DeliverySlot { Label = "Morning delivery", StartTime = "09:00", EndTime = "12:00", BranchId = centralBranch?.Id, MaxOrders = 20, DisplayOrder = 10 }, new DeliverySlot { Label = "Afternoon delivery", StartTime = "13:00", EndTime = "17:00", BranchId = centralBranch?.Id, MaxOrders = 20, DisplayOrder = 20 }, new DeliverySlot { Label = "Evening delivery", StartTime = "17:00", EndTime = "20:00", BranchId = centralBranch?.Id, MaxOrders = 20, DisplayOrder = 30 });
        if (!await dbContext.CmsPages.AnyAsync(cancellationToken)) dbContext.CmsPages.AddRange(new CmsPage { Slug = "about-us", Title = "About Us", Content = "All Nepal Healthy Home connects families with dependable pharmacy care.", Status = "PUBLISHED", PublishedAt = DateTime.UtcNow }, new CmsPage { Slug = "privacy-policy", Title = "Privacy Policy", Content = "We protect customer and prescription information and use it only to provide pharmacy services.", Status = "PUBLISHED", PublishedAt = DateTime.UtcNow });
        if (!await dbContext.Faqs.AnyAsync(cancellationToken)) dbContext.Faqs.AddRange(new Faq { Question = "How do I upload a prescription?", Answer = "Open the prescription area, select a clear JPG, PNG, or PDF file, and submit it for pharmacist review.", DisplayOrder = 10 }, new Faq { Question = "Can I order prescription medicines without review?", Answer = "No. Prescription medicines require pharmacist verification before they can be dispensed.", DisplayOrder = 20 });
        await EnsurePaymentMethods(dbContext, cancellationToken);
        await EnsureNotificationTemplates(dbContext, cancellationToken);
        await EnsureAccessControl(dbContext, cancellationToken);
        await EnsureHrms(dbContext, cancellationToken);
        await EnsureRoleSidebarDefaults(dbContext, cancellationToken);
        await EnsureHomepageArticles(dbContext, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureHomepageArticles(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var articles = new[]
        {
            new HealthArticle
            {
                Slug = "delivering-across-nepal",
                Title = "Delivering across Nepal: what to expect",
                Excerpt = "Learn how All Nepal Healthy Home prepares, verifies and delivers everyday healthcare products to your doorstep.",
                Content = "We prepare every order from our pharmacy catalogue with clear product information and careful packing. Delivery availability, timing and fees depend on your saved address and the delivery zone selected at checkout.\n\nOur team keeps prescription medicines in a separate verification flow so a pharmacist can review them before fulfillment. For questions about an order, contact our support team with your order number and delivery details.",
                Category = "Delivery & support",
                TagsCsv = "delivery, Nepal, pharmacy support",
                AuthorName = "All Nepal Healthy Home care team",
                Status = "PUBLISHED",
                PublishedAt = now,
                IsFeatured = true,
            },
            new HealthArticle
            {
                Slug = "pharmacy-support-and-verification",
                Title = "Pharmacy support and prescription verification",
                Excerpt = "Understand how our pharmacy team helps with product questions and prescription-only medicines.",
                Content = "Our pharmacy support team can help you understand product information, availability and the next step for an order. Prescription medicines are reviewed by a pharmacist before they are dispensed, helping the team check the prescription details and any information that needs clarification.\n\nIf a prescription needs clarification, we will contact you through the available order or support channel. This process does not replace a consultation with your doctor or pharmacist.",
                Category = "Pharmacy care",
                TagsCsv = "pharmacist, prescription, verification",
                AuthorName = "All Nepal Healthy Home pharmacy team",
                Status = "PUBLISHED",
                PublishedAt = now,
                IsFeatured = true,
            },
        };

        foreach (var article in articles)
        {
            if (!await dbContext.HealthArticles.AnyAsync(x => x.Slug == article.Slug, cancellationToken))
                dbContext.HealthArticles.Add(article);
        }
    }

    private static async Task EnsureRoleSidebarDefaults(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var definitions = new Dictionary<string, (string Label, string Href, string Icon)[]>(StringComparer.OrdinalIgnoreCase)
        {
            [StaffRoles.SuperAdmin] =
            [
                ("Products", "/superadmin/products", "TAGS"), ("Dashboard", "/superadmin", "LAYOUT_DASHBOARD"), ("HRMS", "/superadmin/hrms", "USERS"),
                ("Attendance", "/attendance", "CALENDAR_DAYS"), ("Sales & Purchase", "/superadmin/sales-purchase", "CREDIT_CARD"), ("Orders", "/superadmin/orders", "STORE"),
                ("Prescriptions", "/superadmin/prescriptions", "FILE_TEXT"), ("Customers", "/superadmin/customers", "USERS"), ("Payments", "/superadmin/payments", "CREDIT_CARD"),
                ("Payment methods", "/superadmin/payment-methods", "CREDIT_CARD"), ("Reviews", "/superadmin/reviews", "MESSAGE_SQUARE"), ("Support", "/superadmin/support-tickets", "HEADPHONES"),
                ("Templates", "/superadmin/notification-templates", "BELL"), ("Articles", "/superadmin/articles", "FILE_TEXT"), ("Notifications", "/superadmin/notifications", "BELL"),
                ("Website settings", "/superadmin/settings", "SETTINGS"), ("Design settings", "/superadmin/website/design", "PALETTE"), ("Animation settings", "/superadmin/website/animations", "SPARKLES"),
                ("Homepage builder", "/superadmin/website", "STORE"), ("Hero slides", "/superadmin/website/hero-slides", "IMAGES"), ("Navigation", "/superadmin/navigation", "MENU"),
                ("Popups", "/superadmin/popups", "BELL"), ("SEO", "/superadmin/seo", "TAGS"), ("Media library", "/superadmin/media", "STORE"), ("CMS pages", "/superadmin/cms", "FILE_TEXT"),
                ("Catalog", "/superadmin/catalog", "TAGS"),
                ("Branches", "/superadmin/branches", "STORE"), ("Delivery zones", "/superadmin/zones", "MAP_PIN"), ("Coupons", "/superadmin/coupons", "BAR_CHART_3"),
                ("Flash sales", "/superadmin/flash-sales", "TIMER_RESET"), ("Staff accounts", "/superadmin/staff", "USERS"), ("Roles & permissions", "/superadmin/roles", "KEY_ROUND"),
                ("Audit logs", "/superadmin/audit-logs", "SHIELD"), ("System health", "/superadmin/system-health", "SHIELD"), ("Reports", "/superadmin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.Admin] =
            [
                ("Dashboard", "/admin", "LAYOUT_DASHBOARD"), ("HRMS", "/admin/hrms", "USERS"), ("Attendance", "/attendance", "CALENDAR_DAYS"), ("Sales & Purchase", "/admin/sales-purchase", "CREDIT_CARD"),
                ("Orders", "/admin/orders", "STORE"), ("Prescriptions", "/admin/prescriptions", "FILE_TEXT"), ("Products", "/admin/products", "TAGS"), ("Catalog foundations", "/admin/catalog", "TAGS"),
                ("Branches", "/admin/branches", "STORE"), ("Delivery zones", "/admin/zones", "MAP_PIN"),
                ("Customers", "/admin/customers", "USERS"), ("Payments", "/admin/payments", "CREDIT_CARD"), ("Reviews", "/admin/reviews", "MESSAGE_SQUARE"), ("Support", "/admin/support-tickets", "HEADPHONES"),
                ("Templates", "/admin/notification-templates", "BELL"), ("Articles", "/admin/articles", "FILE_TEXT"), ("Flash sales", "/admin/flash-sales", "TIMER_RESET"), ("Notifications", "/admin/notifications", "BELL"), ("Reports", "/admin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.Supervisor] =
            [
                ("Dashboard", "/supervisor", "LAYOUT_DASHBOARD"), ("Sales & Purchase", "/admin/sales-purchase", "CREDIT_CARD"), ("Orders", "/supervisor/orders", "STORE"), ("Prescriptions", "/supervisor/prescriptions", "FILE_TEXT"), ("Customers", "/supervisor/customers", "USERS"),
                ("Reports", "/supervisor/reports", "BAR_CHART_3"), ("Notifications", "/supervisor/notifications", "BELL")
            ],
            [StaffRoles.Accountant] = [("Sales & Purchase", "/admin/sales-purchase", "CREDIT_CARD"), ("Attendance", "/attendance", "CALENDAR_DAYS")],
            [StaffRoles.Pharmacist] =
            [
                ("Dashboard", "/pharmacist", "LAYOUT_DASHBOARD"), ("My attendance", "/attendance", "CALENDAR_DAYS"), ("Prescriptions", "/pharmacist/prescriptions", "FILE_TEXT"), ("Orders", "/pharmacist/orders", "CLIPBOARD_LIST"),
                ("Medicines", "/pharmacist/inventory", "BOXES"), ("Low stock", "/pharmacist/inventory/low-stock", "PACKAGE"), ("Expiry alerts", "/pharmacist/inventory/expiry", "FILE_TEXT"), ("Customers", "/pharmacist/customers", "USERS"),
                ("Notifications", "/pharmacist/notifications", "BELL"), ("Activity", "/pharmacist/activity", "ACTIVITY"), ("Profile", "/pharmacist/profile", "USERS")
            ],
            [StaffRoles.Delivery] =
            [
                ("Dashboard", "/delivery", "LAYOUT_DASHBOARD"), ("My attendance", "/attendance", "CALENDAR_DAYS"), ("My deliveries", "/delivery/orders", "TRUCK"), ("Pending pickup", "/delivery/orders?status=ASSIGNED_FOR_DELIVERY", "PACKAGE"),
                ("Out for delivery", "/delivery/orders?status=OUT_FOR_DELIVERY", "CLIPBOARD_LIST"), ("Completed", "/delivery/history?status=DELIVERED", "SHIELD"), ("Failed", "/delivery/history?status=FAILED", "FILE_TEXT"),
                ("Notifications", "/delivery/notifications", "BELL"), ("Profile", "/delivery/profile", "USERS")
            ],
            [StaffRoles.SalesExecutive] =
            [
                ("Dashboard", "/sales-executive", "LAYOUT_DASHBOARD"), ("Orders", "/sales-executive/orders", "CLIPBOARD_LIST"), ("Sales performance", "/sales-executive", "BAR_CHART_3"), ("Messages", "/messages", "MESSAGE_SQUARE")
            ],
            [StaffRoles.SalesManager] =
            [
                ("Sales workspace", "/admin/sales-purchase/sales", "BAR_CHART_3"), ("Customers", "/admin/customers", "USERS"), ("Products", "/admin/products", "TAGS"), ("Sales assignments", "/admin/sales-executives", "TAGS"), ("Reports", "/admin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.PurchaseInventoryManager] =
            [
                ("Purchase workspace", "/admin/sales-purchase/purchase", "CREDIT_CARD"), ("Products", "/admin/products", "TAGS"), ("Inventory", "/admin/inventory", "BOXES"), ("Branches", "/admin/branches", "STORE"), ("Reports", "/admin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.HrManager] =
            [
                ("HRMS", "/admin/hrms", "USERS"), ("Attendance", "/admin/hrms?tab=attendance", "CALENDAR_DAYS"), ("Leave", "/admin/hrms?tab=leave", "CALENDAR_DAYS"), ("Reports", "/admin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.ViewerAuditor] =
            [
                ("Dashboard", "/admin", "LAYOUT_DASHBOARD"), ("Orders", "/admin/orders", "STORE"), ("Reports", "/admin/reports", "BAR_CHART_3")
            ],
            [StaffRoles.Employee] =
            [
                ("My attendance", "/attendance", "CALENDAR_DAYS"), ("My leave", "/leave", "CALENDAR_DAYS"), ("Profile", "/pharmacist/profile", "USERS")
            ]
        };

        foreach (var definition in definitions)
        {
            var existing = await dbContext.RoleSidebarMenuItems.Where(x => x.Role == definition.Key).ToListAsync(cancellationToken);
            if (existing.Count > 0)
            {
                foreach (var old in existing.Where(x => x.Href.Equals("/accounts", StringComparison.OrdinalIgnoreCase) || x.Href.EndsWith("/inventory", StringComparison.OrdinalIgnoreCase) || x.Href.EndsWith("/purchase-orders", StringComparison.OrdinalIgnoreCase))) old.IsVisible = false;
                var salesPurchaseItem = definition.Value
                    .Where(x => x.Label.Equals("Sales & Purchase", StringComparison.OrdinalIgnoreCase))
                    .Select(item => ((string Label, string Href, string Icon)?)item)
                    .FirstOrDefault();
                if (salesPurchaseItem is { } sidebarItem &&
                    !existing.Any(x => x.Label.Equals("Sales & Purchase", StringComparison.OrdinalIgnoreCase)))
                {
                    dbContext.RoleSidebarMenuItems.Add(new RoleSidebarMenuItem
                    {
                        Role = definition.Key,
                        Label = sidebarItem.Label,
                        Href = sidebarItem.Href,
                        Icon = sidebarItem.Icon,
                        DisplayOrder = 5,
                        IsVisible = true
                    });
                }
                continue;
            }
            dbContext.RoleSidebarMenuItems.AddRange(definition.Value.Select((item, index) => new RoleSidebarMenuItem
            {
                Role = definition.Key,
                Label = item.Label,
                Href = item.Href,
                Icon = item.Icon,
                DisplayOrder = (index + 1) * 10,
                IsVisible = true
            }));
        }
    }

    private static async Task EnsureProductImages(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var mappings = new Dictionary<string, (string FileName, string AltText)>(StringComparer.OrdinalIgnoreCase)
        {
            ["paracetamol-500-mg"] = ("product-paracetamol-500mg.png", "Paracetamol 500 mg tablets"),
            ["cetirizine-10-mg"] = ("product-cetirizine-10mg.png", "Cetirizine 10 mg tablets"),
            ["amoxicillin-500-mg"] = ("product-amoxicillin-500mg.png", "Amoxicillin 500 mg capsules"),
            ["vitamin-c-zinc"] = ("product-vitamin-c-zinc.png", "Vitamin C and zinc tablets"),
            ["digital-thermometer"] = ("product-digital-thermometer.png", "Digital thermometer"),
            ["antiseptic-solution"] = ("product-antiseptic-solution.png", "Antiseptic solution bottle"),
        };
        var products = await dbContext.Products.Where(x => mappings.Keys.Contains(x.Slug)).ToListAsync(cancellationToken);
        var mediaRoot = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "media");

        foreach (var product in products)
        {
            var mapping = mappings[product.Slug];
            var filePath = Path.Combine(mediaRoot, mapping.FileName);
            if (!File.Exists(filePath)) continue;

            var asset = await dbContext.MediaAssets.SingleOrDefaultAsync(x => x.StoredFileName == mapping.FileName, cancellationToken);
            if (asset is null)
            {
                var bytes = await File.ReadAllBytesAsync(filePath, cancellationToken);
                asset = new MediaAsset
                {
                    OriginalFileName = mapping.FileName,
                    StoredFileName = mapping.FileName,
                    ContentType = "image/png",
                    Length = bytes.LongLength,
                    Sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
                    Kind = "PRODUCT",
                    AltText = mapping.AltText,
                    IsPublic = true,
                    IsActive = true,
                };
                dbContext.MediaAssets.Add(asset);
            }
            else
            {
                asset.Kind = "PRODUCT";
                asset.AltText = mapping.AltText;
                asset.IsPublic = true;
                asset.IsActive = true;
                asset.UpdatedAt = DateTime.UtcNow;
            }

            if (string.IsNullOrWhiteSpace(product.ImageUrl))
            {
                product.ImageUrl = $"/api/site/media/{asset.Id}";
                product.UpdatedAt = DateTime.UtcNow;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureHrms(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        if (!await dbContext.WorkShifts.AnyAsync(cancellationToken))
            dbContext.WorkShifts.Add(new WorkShift { Name = "General Shift", ShiftType = "REGULAR", StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(17, 0), BreakDurationMinutes = 30, GracePeriodMinutes = 15, MinimumWorkingMinutes = 480, LateThresholdMinutes = 1, HalfDayThresholdMinutes = 270, OvertimeThresholdMinutes = 540, WeeklyOffDays = "SATURDAY" });
        if (!await dbContext.AttendanceSettings.AnyAsync(cancellationToken))
            dbContext.AttendanceSettings.Add(new AttendanceSetting { LateCheckInGraceMinutes = 15, DefaultRadiusMeters = 100, LocationRequired = true, BusinessTimeZone = "Asia/Kathmandu" });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsurePaymentMethods(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var definitions = new (string Code, string DisplayName, string Instructions, int DisplayOrder, bool Enabled, bool Verify)[]
        {
            (PaymentMethods.CashOnDelivery, "Cash on Delivery", "Pay when your order arrives.", 10, true, false),
            (PaymentMethods.Khalti, "Khalti", "Online payment through Khalti. Provider verification is required before capture.", 20, false, true),
            (PaymentMethods.Esewa, "eSewa", "Online payment through eSewa. Provider verification is required before capture.", 30, false, true),
            (PaymentMethods.BankTransfer, "Bank transfer", "Transfer instructions will be shown after order review.", 40, false, true)
        };
        foreach (var definition in definitions)
        {
            if (!await dbContext.PaymentMethodConfigurations.AnyAsync(x => x.Code == definition.Code, cancellationToken))
                dbContext.PaymentMethodConfigurations.Add(new PaymentMethodConfiguration { Code = definition.Code, DisplayName = definition.DisplayName, Instructions = definition.Instructions, DisplayOrder = definition.DisplayOrder, IsEnabled = definition.Enabled, RequiresServerVerification = definition.Verify });
        }
    }

    private static async Task EnsureNotificationTemplates(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var definitions = new (string Code, string Name, string Channel, string Subject, string Body, string Variables)[]
        {
            ("REGISTRATION", "Registration", "EMAIL", "Welcome to {{website_name}}", "Hello {{customer_name}}, your All Nepal Healthy Home account is ready.", "customer_name,website_name"),
            ("PRESCRIPTION_SUBMITTED", "Prescription submitted", "IN_APP", "Prescription received", "Your prescription {{prescription_id}} is ready for pharmacist review.", "prescription_id"),
            ("PRESCRIPTION_APPROVED", "Prescription approved", "IN_APP", "Prescription approved", "Your prescription {{prescription_id}} has been approved.", "prescription_id"),
            ("PRESCRIPTION_CLARIFICATION", "Prescription clarification", "IN_APP", "More information needed", "Please review the clarification request for prescription {{prescription_id}}.", "prescription_id"),
            ("ORDER_PLACED", "Order placed", "IN_APP", "Order {{order_id}} received", "Your order {{order_id}} for {{total_amount}} has been received.", "order_id,total_amount"),
            ("ORDER_STATUS", "Order status update", "IN_APP", "Order {{order_id}} is {{order_status}}", "Your order {{order_id}} is now {{order_status}}.", "order_id,order_status"),
            ("DELIVERY_ASSIGNED", "Delivery assigned", "SMS", "Delivery assigned", "Your order {{order_id}} is assigned for delivery. Follow updates in your account.", "order_id"),
            ("OUT_FOR_DELIVERY", "Out for delivery", "SMS", "Order on the way", "Your order {{order_id}} is out for delivery.", "order_id"),
            ("PAYMENT_UPDATE", "Payment update", "IN_APP", "Payment update for {{order_id}}", "Payment for order {{order_id}} is {{payment_status}}.", "order_id,payment_status"),
            ("PROMOTION", "Promotion", "EMAIL", "A health offer from {{website_name}}", "Hello {{customer_name}}, discover our latest health offers.", "customer_name,website_name")
        };
        var existing = await dbContext.NotificationTemplates.Select(x => x.Code).ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        foreach (var definition in definitions)
            if (!existing.Contains(definition.Code)) dbContext.NotificationTemplates.Add(new NotificationTemplate { Code = definition.Code, Name = definition.Name, Channel = definition.Channel, Subject = definition.Subject, Body = definition.Body, Variables = definition.Variables, IsEnabled = true });
    }

    private static async Task EnsureAccessControl(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var definitions = new (string Key, string Description, string Group)[]
        {
            (AppPermissions.CatalogView, "View products, medicines, categories, brands and manufacturers", "Catalog"),
            (AppPermissions.CatalogManage, "Create and update catalog records", "Catalog"),
            (AppPermissions.InventoryView, "View stock, batches and expiry information", "Inventory"),
            (AppPermissions.InventoryAdjust, "Adjust stock quantities and record stock movements", "Inventory"),
            (AppPermissions.InventoryValuationView, "View inventory purchase costs and stock valuation", "Inventory"),
            (AppPermissions.OrdersView, "View and search customer orders", "Orders"),
            (AppPermissions.OrdersManage, "Change order status and operational notes", "Orders"),
            (AppPermissions.CustomersView, "View customer accounts and history", "Customers"),
            (AppPermissions.CustomersManage, "Activate or deactivate customer accounts", "Customers"),
            (AppPermissions.PrescriptionsView, "View prescription queue and review context", "Prescriptions"),
            (AppPermissions.PrescriptionsOverride, "Override a pharmacist prescription decision with a recorded reason", "Prescriptions"),
            (AppPermissions.BranchesManage, "Manage branches, suppliers and delivery zones", "Branches"),
            (AppPermissions.WebsiteManage, "Manage homepage assets and public website content", "Website"),
            (AppPermissions.ReportsView, "View operational and business reports", "Reports"),
            (AppPermissions.AuditView, "View immutable audit activity", "System"),
            (AppPermissions.SettingsManage, "Manage system and website settings", "System"),
            (AppPermissions.CouponsManage, "Manage promotional coupons", "Marketing"),
            (AppPermissions.FlashSalesManage, "Manage time-limited flash sales", "Marketing"),
            (AppPermissions.PurchaseOrdersManage, "Create purchase orders and receive stock", "Inventory"),
            (AppPermissions.StaffManage, "Manage staff accounts and assignments", "Users"),
            (AppPermissions.NotificationsView, "View generated notification history", "Notifications"),
            (AppPermissions.NotificationsManage, "Manage notification templates", "Notifications"),
            (AppPermissions.ReviewsManage, "Moderate customer product reviews", "Marketing"),
            (AppPermissions.SupportManage, "Manage customer support tickets", "Support"),
            (AppPermissions.FinanceInvoicesView, "View sales invoices and payment status", "Finance"),
            (AppPermissions.FinanceInvoicesManage, "Manage sales invoices", "Finance"),
            (AppPermissions.FinancePaymentsManage, "Record customer and supplier payments", "Finance"),
            (AppPermissions.FinanceLedgerView, "View retailer ledgers and receivables", "Finance"),
            (AppPermissions.FinancePayablesManage, "Manage supplier invoices and payables", "Finance"),
            (AppPermissions.FinanceReconciliationManage, "Reconcile bank statement transactions", "Finance"),
            (AppPermissions.FinanceTaxManage, "Manage VAT settings and filings", "Finance"),
            (AppPermissions.SalesAssignmentsManage, "Assign products and categories to sales executives", "Sales"),
            (AppPermissions.HrmsView, "View HRMS dashboards and records", "HRMS"),
            (AppPermissions.HrmsManage, "Manage HRMS configuration and employee workflows", "HRMS"),
            (AppPermissions.AttendanceSelf, "View and manage your own attendance", "HRMS"),
            (AppPermissions.LeaveApply, "Submit your own leave requests", "HRMS"),
            (AppPermissions.LeaveView, "View your own leave requests", "HRMS"),
            (AppPermissions.AttendanceCorrect, "Request or manage attendance corrections", "HRMS"),
            (AppPermissions.AttendanceApprove, "Approve attendance corrections", "HRMS"),
            (AppPermissions.HrSettingsManage, "Manage shifts, grace periods and HRMS settings", "HRMS")
        };
        foreach (var definition in definitions.Concat(SalesPurchasePermissions.Definitions))
        {
            if (!await dbContext.AccessPermissions.AnyAsync(x => x.Key == definition.Key, cancellationToken))
                dbContext.AccessPermissions.Add(new AccessPermission { Key = definition.Key, Description = definition.Description, Group = definition.Group, IsSystem = true });
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        var roleDefinitions = new Dictionary<string, (string DisplayName, string Description, IReadOnlySet<string> Permissions)>(StringComparer.OrdinalIgnoreCase)
        {
            [StaffRoles.SuperAdmin] = ("SuperAdmin", "Full application control with system-level access.", new HashSet<string>(AppPermissions.All, StringComparer.OrdinalIgnoreCase)),
            [StaffRoles.Admin] = ("Admin", "Daily operational administration.", AppPermissions.DefaultsFor(StaffRoles.Admin)),
            [StaffRoles.Supervisor] = ("Supervisor", "Supervisory access to operational queues and reports.", AppPermissions.DefaultsFor(StaffRoles.Supervisor)),
            [StaffRoles.Pharmacist] = ("Pharmacist", "Clinical review and branch inventory access.", AppPermissions.DefaultsFor(StaffRoles.Pharmacist)),
            [StaffRoles.Delivery] = ("Delivery staff", "Delivery workflow access.", AppPermissions.DefaultsFor(StaffRoles.Delivery)),
            [StaffRoles.Accountant] = ("Accountant", "Accounts, payroll and attendance access.", AppPermissions.DefaultsFor(StaffRoles.Accountant)),
            [StaffRoles.SalesExecutive] = ("Sales Executive", "Product-assigned order and sales workflow access.", AppPermissions.DefaultsFor(StaffRoles.SalesExecutive)),
            [StaffRoles.SalesManager] = ("Sales Manager", "Sales, customer, product, reporting and executive assignment access.", AppPermissions.DefaultsFor(StaffRoles.SalesManager)),
            [StaffRoles.PurchaseInventoryManager] = ("Purchase / Inventory Manager", "Purchasing, supplier, stock and inventory operations.", AppPermissions.DefaultsFor(StaffRoles.PurchaseInventoryManager)),
            [StaffRoles.HrManager] = ("HR Manager", "Employee, attendance, leave and HR reporting access.", AppPermissions.DefaultsFor(StaffRoles.HrManager)),
            [StaffRoles.ViewerAuditor] = ("Viewer / Auditor", "Read-only operational and audit access.", AppPermissions.DefaultsFor(StaffRoles.ViewerAuditor)),
            [StaffRoles.Employee] = ("Employee", "Own attendance and leave access only.", AppPermissions.DefaultsFor(StaffRoles.Employee))
        };
        foreach (var definition in roleDefinitions)
        {
            if (!await dbContext.AccessRoles.AnyAsync(x => x.Name == definition.Key, cancellationToken))
                dbContext.AccessRoles.Add(new AccessRole { Name = definition.Key, DisplayName = definition.Value.DisplayName, Description = definition.Value.Description, IsSystem = true });
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        var permissions = await dbContext.AccessPermissions.ToDictionaryAsync(x => x.Key, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var roles = await dbContext.AccessRoles.ToDictionaryAsync(x => x.Name, StringComparer.OrdinalIgnoreCase, cancellationToken);
        foreach (var definition in roleDefinitions)
        {
            foreach (var permissionKey in definition.Value.Permissions)
            {
                if (!permissions.TryGetValue(permissionKey, out var permission) || !roles.TryGetValue(definition.Key, out var role)) continue;
                if (!await dbContext.AccessRolePermissions.AnyAsync(x => x.RoleId == role.Id && x.PermissionId == permission.Id, cancellationToken))
                    dbContext.AccessRolePermissions.Add(new AccessRolePermission { RoleId = role.Id, PermissionId = permission.Id });
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureStaff(ApplicationDbContext dbContext, PasswordService passwords, string name, string email, string phone, string role, Guid branchId, string password, string? license, CancellationToken cancellationToken)
    {
        var staff = await dbContext.StaffUsers.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (staff is not null)
        {
            staff.PasswordHash = passwords.Hash(password);
            staff.Role = role;
            staff.BranchId = branchId;
            staff.IsActive = true;
            staff.UpdatedAt = DateTime.UtcNow;
            return;
        }
        dbContext.StaffUsers.Add(new StaffUser { FullName = name, Email = email, Phone = phone, PasswordHash = passwords.Hash(password), Role = role, BranchId = branchId, LicenseReference = license });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureCustomer(ApplicationDbContext dbContext, PasswordService passwords, string name, string email, string phone, string password, CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (customer is not null)
        {
            customer.PasswordHash = passwords.Hash(password);
            customer.IsActive = true;
            customer.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }
        dbContext.Customers.Add(new Customer { FullName = name, Email = email, Phone = phone, PasswordHash = passwords.Hash(password) });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsurePharmacyCustomer(ApplicationDbContext dbContext, PasswordService passwords, string name, string email, string phone, string password, CancellationToken cancellationToken)
    {
        await EnsureCustomer(dbContext, passwords, name, email, phone, password, cancellationToken);
        var customer = await dbContext.Customers.SingleAsync(x => x.Email == email, cancellationToken);
        customer.AccountType = "PHARMACY";
        if (!await dbContext.PharmacyDetails.AnyAsync(x => x.CustomerId == customer.Id, cancellationToken))
            dbContext.PharmacyDetails.Add(new PharmacyDetails { CustomerId = customer.Id, PanNumber = "999999999", PanRegisteredName = name, PharmacyName = name, Province = "Bagmati", District = "Kathmandu", Municipality = "Kathmandu Metropolitan City", Ward = "10", Address = "New Baneshwor, Kathmandu", DrugLicenseNumber = "DEMO-DL-001", OwnerPhone = phone, OwnerEmail = email, Category = "WHOLESALE", PanVerificationStatus = "MANUAL_FALLBACK", PanVerificationSource = "seed-demo" });
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureSystemSetting(ApplicationDbContext dbContext, string key, string value, string group, bool isPublic, string description, CancellationToken cancellationToken)
    {
        if (await dbContext.SystemSettings.AnyAsync(x => x.Key == key, cancellationToken)) return;
        dbContext.SystemSettings.Add(new SystemSetting { Key = key, Value = value, Group = group, IsPublic = isPublic, Description = description });
    }

    private static async Task EnsureViberContactWidget(ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var setting = await dbContext.SystemSettings.SingleOrDefaultAsync(x => x.Key == "website.contactWidget", cancellationToken);
        if (setting is null)
        {
            setting = new SystemSetting
            {
                Key = "website.contactWidget",
                Value = JsonSerializer.Serialize(new
                {
                    enabled = true,
                    side = "LEFT",
                    verticalPosition = "CENTER",
                    items = new object[]
                    {
                        new { id = "call", type = "CALL", label = "Call us", value = "01-5313958", color = "#003893", enabled = true, displayOrder = 1 },
                        new { id = "email", type = "EMAIL", label = "Email us", value = "hello@allnepalhealthyhome.com", subject = "All Nepal Healthy Home enquiry", color = "#003893", enabled = true, displayOrder = 3 },
                        new { id = "viber", type = "VIBER", label = "Viber", value = "9851310286", color = "#003893", enabled = true, displayOrder = 4 },
                    },
                }),
                Group = "website-design",
                IsPublic = true,
                Description = "Customer-facing floating contact buttons.",
            };
            dbContext.SystemSettings.Add(setting);
            return;
        }

        try
        {
            var root = JsonNode.Parse(setting.Value)?.AsObject();
            var items = root?["items"]?.AsArray();
            if (root is null || items is null || items.OfType<JsonObject>().Any(item => string.Equals(item["type"]?.GetValue<string>(), "VIBER", StringComparison.OrdinalIgnoreCase))) return;
            items.Add(new JsonObject
            {
                ["id"] = "viber",
                ["type"] = "VIBER",
                ["label"] = "Viber",
                ["value"] = "9851310286",
                ["color"] = "#003893",
                ["enabled"] = true,
                ["displayOrder"] = 4,
            });
            setting.Value = root.ToJsonString();
        }
        catch (JsonException)
        {
            // Preserve malformed admin configuration for manual correction.
        }
    }

    private static Product Product(string name, string slug, string sku, decimal mrp, decimal price, Brand brand, Medicine medicine, bool featured) => new() { Name = name, Slug = slug, Sku = sku, Mrp = mrp, SellingPrice = price, Brand = brand, Medicine = medicine, IsFeatured = featured };
}
