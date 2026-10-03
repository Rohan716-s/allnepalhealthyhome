using System.Text.Json;
using backend.Models;

namespace backend.Contracts;

public sealed class OrderingConfiguration
{
    public string Mode { get; set; } = "BULK_AND_SINGLE";
    public int MinimumBulkQuantity { get; set; } = 10;
    public Dictionary<string, OrderingProductRule> Products { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, OrderingLocaleCopy> Localized { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = OrderingLocaleCopy.English(),
        ["ne"] = OrderingLocaleCopy.Nepali(),
    };

    public static OrderingConfiguration Default => new();

    public static string DefaultJson => JsonSerializer.Serialize(Default, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    public static OrderingConfiguration Parse(string? json)
    {
        OrderingConfiguration settings;
        try
        {
            settings = string.IsNullOrWhiteSpace(json)
                ? Default
                : JsonSerializer.Deserialize<OrderingConfiguration>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? Default;
        }
        catch (JsonException)
        {
            settings = Default;
        }

        if (settings.Mode is not ("BULK_ONLY" or "SINGLE_ONLY" or "BULK_AND_SINGLE")) settings.Mode = "BULK_AND_SINGLE";
        settings.MinimumBulkQuantity = Math.Clamp(settings.MinimumBulkQuantity, 1, 999);
        settings.Products ??= new Dictionary<string, OrderingProductRule>(StringComparer.OrdinalIgnoreCase);
        settings.Localized ??= new Dictionary<string, OrderingLocaleCopy>(StringComparer.OrdinalIgnoreCase);
        settings.Localized.TryAdd("en", OrderingLocaleCopy.English());
        settings.Localized.TryAdd("ne", OrderingLocaleCopy.Nepali());
        return settings;
    }

    public OrderingProductRule RuleFor(Product product)
    {
        var match = Products.FirstOrDefault(entry =>
            entry.Key.Equals(product.Sku, StringComparison.OrdinalIgnoreCase)
            || entry.Key.Equals(product.Slug, StringComparison.OrdinalIgnoreCase));
        return match.Value ?? new OrderingProductRule();
    }

    public OrderingLocaleCopy CopyFor(string? locale)
    {
        var key = locale?.Equals("ne", StringComparison.OrdinalIgnoreCase) == true ? "ne" : "en";
        return Localized.GetValueOrDefault(key) ?? OrderingLocaleCopy.English();
    }
}

public sealed class OrderingProductRule
{
    public bool AllowBulk { get; set; } = true;
    public bool AllowSingle { get; set; } = true;
    public int MinimumQuantity { get; set; } = 1;
    public Dictionary<string, OrderingProductText> Localized { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = new(),
        ["ne"] = new(),
    };
}

public sealed class OrderingProductText
{
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Instructions { get; set; } = "";
    public string ButtonLabel { get; set; } = "";
}

public sealed class OrderingLocaleCopy
{
    public string PageTitle { get; set; } = "";
    public string PageDescription { get; set; } = "";
    public string ChooseMode { get; set; } = "";
    public string SingleMode { get; set; } = "";
    public string SingleModeDescription { get; set; } = "";
    public string BulkMode { get; set; } = "";
    public string BulkModeDescription { get; set; } = "";
    public string Product { get; set; } = "";
    public string Quantity { get; set; } = "";
    public string MinimumQuantity { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Province { get; set; } = "";
    public string District { get; set; } = "";
    public string Municipality { get; set; } = "";
    public string Ward { get; set; } = "";
    public string Address { get; set; } = "";
    public string Landmark { get; set; } = "";
    public string DeliveryInstructions { get; set; } = "";
    public string DeliverySlot { get; set; } = "";
    public string Branch { get; set; } = "";
    public string PaymentOption { get; set; } = "";
    public string Notes { get; set; } = "";
    public string PlaceOrder { get; set; } = "";
    public string OrderSummary { get; set; } = "";
    public string Subtotal { get; set; } = "";
    public string DeliveryFee { get; set; } = "";
    public string Total { get; set; } = "";
    public string AddToCart { get; set; } = "";
    public string OrderInstructions { get; set; } = "";
    public string BulkUnavailableTitle { get; set; } = "";
    public string BulkUnavailableMessage { get; set; } = "";
    public string SingleUnavailableMessage { get; set; } = "";
    public string MinimumQuantityMessage { get; set; } = "";
    public string SingleProductLimitMessage { get; set; } = "";
    public string RequiredFieldsMessage { get; set; } = "";
    public string InvalidEmailMessage { get; set; } = "";
    public string OutOfStock { get; set; } = "";
    public string SuccessTitle { get; set; } = "";
    public string SuccessMessage { get; set; } = "";
    public string EmptyCart { get; set; } = "";
    public string DialogOkay { get; set; } = "";

    public static OrderingLocaleCopy English() => new()
    {
        PageTitle = "Complete your order", PageDescription = "Choose how you would like to order, then add delivery and payment details.", ChooseMode = "Choose order type",
        SingleMode = "Single order", SingleModeDescription = "Order one product with the quantity you need.", BulkMode = "Bulk order", BulkModeDescription = "Order at least the required wholesale quantity.",
        Product = "Product", Quantity = "Quantity", MinimumQuantity = "Minimum quantity", CustomerName = "Full name", Phone = "Phone number", Email = "Email address",
        Province = "Province", District = "District", Municipality = "Municipality", Ward = "Ward", Address = "Street / tole address", Landmark = "Landmark (optional)",
        DeliveryInstructions = "Delivery details", DeliverySlot = "Delivery time", Branch = "Pharmacy branch", PaymentOption = "Payment option", Notes = "Order notes", PlaceOrder = "Place order",
        OrderSummary = "Order summary", Subtotal = "Subtotal", DeliveryFee = "Delivery fee", Total = "Total", AddToCart = "Add to cart", OrderInstructions = "Select your order type and confirm the minimum quantity before checkout.",
        BulkUnavailableTitle = "Bulk ordering unavailable", BulkUnavailableMessage = "Bulk ordering is not available for this product. Please contact the Admin.",
        SingleUnavailableMessage = "Single ordering is not available for this product. Please contact the Admin.", MinimumQuantityMessage = "The minimum order for {product} is {minimum}.",
        SingleProductLimitMessage = "A single order can contain one product. Remove other products from your cart to continue.", RequiredFieldsMessage = "Please complete all required customer and delivery details.",
        SuccessTitle = "Order received", SuccessMessage = "Your order {orderNumber} is pending confirmation. The pharmacy team will update the delivery workflow.", EmptyCart = "Add products before checking out.", DialogOkay = "Okay", InvalidEmailMessage = "Enter a valid email address.", OutOfStock = "Out of stock",
    };

    public static OrderingLocaleCopy Nepali() => new()
    {
        PageTitle = "अर्डर पूरा गर्नुहोस्", PageDescription = "अर्डरको प्रकार छान्नुहोस् र डेलिभरी तथा भुक्तानी विवरण भर्नुहोस्।", ChooseMode = "अर्डरको प्रकार छान्नुहोस्",
        SingleMode = "एकल अर्डर", SingleModeDescription = "आवश्यक परिमाणमा एउटा सामान अर्डर गर्नुहोस्।", BulkMode = "थोक अर्डर", BulkModeDescription = "तोकिएको न्यूनतम थोक परिमाण अर्डर गर्नुहोस्।",
        Product = "सामान", Quantity = "परिमाण", MinimumQuantity = "न्यूनतम परिमाण", CustomerName = "पूरा नाम", Phone = "फोन नम्बर", Email = "इमेल ठेगाना",
        Province = "प्रदेश", District = "जिल्ला", Municipality = "नगरपालिका", Ward = "वडा", Address = "सडक / टोल ठेगाना", Landmark = "चिन्ने ठाउँ (ऐच्छिक)",
        DeliveryInstructions = "डेलिभरी विवरण", DeliverySlot = "डेलिभरी समय", Branch = "फार्मेसी शाखा", PaymentOption = "भुक्तानी विकल्प", Notes = "अर्डरसम्बन्धी टिप्पणी", PlaceOrder = "अर्डर गर्नुहोस्",
        OrderSummary = "अर्डर सारांश", Subtotal = "जम्मा", DeliveryFee = "डेलिभरी शुल्क", Total = "कुल", AddToCart = "कार्टमा राख्नुहोस्", OrderInstructions = "अर्डरको प्रकार छान्नुहोस् र चेकआउटअघि न्यूनतम परिमाण जाँच गर्नुहोस्।",
        BulkUnavailableTitle = "थोक अर्डर उपलब्ध छैन", BulkUnavailableMessage = "यस सामानको थोक अर्डर उपलब्ध छैन। कृपया एडमिनसँग सम्पर्क गर्नुहोस्।",
        SingleUnavailableMessage = "यस सामानको एकल अर्डर उपलब्ध छैन। कृपया एडमिनसँग सम्पर्क गर्नुहोस्।", MinimumQuantityMessage = "{product} को न्यूनतम अर्डर परिमाण {minimum} हो।",
        SingleProductLimitMessage = "एकल अर्डरमा एउटा मात्र सामान राख्न मिल्छ। अगाडि बढ्न कार्टबाट अरू सामान हटाउनुहोस्।", RequiredFieldsMessage = "कृपया ग्राहक र डेलिभरीका सबै आवश्यक विवरण भर्नुहोस्।",
        SuccessTitle = "अर्डर प्राप्त भयो", SuccessMessage = "तपाईंको अर्डर {orderNumber} पुष्टि हुन बाँकी छ। फार्मेसी टोलीले डेलिभरीबारे जानकारी दिनेछ।", EmptyCart = "चेकआउट गर्नुअघि सामान कार्टमा राख्नुहोस्।", DialogOkay = "ठीक छ", InvalidEmailMessage = "कृपया मान्य इमेल ठेगाना राख्नुहोस्।", OutOfStock = "स्टकमा छैन",
    };
}

public static class OrderingMessages
{
    public const string BulkUnavailableCode = "BULK_ORDER_UNAVAILABLE";
    public const string SingleUnavailableCode = "SINGLE_ORDER_UNAVAILABLE";

    public static string Format(string template, params (string Key, string Value)[] replacements)
    {
        foreach (var (key, value) in replacements) template = template.Replace("{" + key + "}", value, StringComparison.OrdinalIgnoreCase);
        return template;
    }
}
