using System.Diagnostics;
using System.ComponentModel;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed record ExtractedMedicineDraft(string DetectedName, string NormalizedName, string? Strength, string? DosageForm, string? Dosage, int? Quantity, string? Frequency, string? Duration, string? Timing, string? Instructions);
public sealed record OcrResult(bool Success, string Provider, string Status, string? RawText, IReadOnlyList<ExtractedMedicineDraft> Items, string? ErrorMessage);
public sealed record MedicineMatchResult(Product? Product, decimal Confidence, string MatchType, string Availability, int StockQuantity, bool NeedsPharmacistReview);

public interface IPrescriptionFileStorage
{
    Task<StoredPrescriptionFile> SaveAsync(IFormFile file, CancellationToken cancellationToken);
    Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken);
}

public sealed record StoredPrescriptionFile(string OriginalFileName, string StoredFileName, string ContentType, long Length, string Sha256);

public sealed class PrescriptionFileStorage(IConfiguration configuration, IHostEnvironment environment) : IPrescriptionFileStorage
{
    private const long MaxFileSize = 10 * 1024 * 1024;
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp", [".pdf"] = "application/pdf",
    };
    private readonly string root = configuration["Storage:PrescriptionRoot"] is { Length: > 0 } configured
        ? Path.GetFullPath(configured)
        : Path.Combine(environment.ContentRootPath, "App_Data", "prescriptions");

    public async Task<StoredPrescriptionFile> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0) throw new InvalidDataException("Please choose a prescription file.");
        if (file.Length > MaxFileSize) throw new InvalidDataException("Prescription files must be 10 MB or smaller.");
        var extension = Path.GetExtension(file.FileName);
        if (!AllowedTypes.TryGetValue(extension, out var expectedType) || !string.Equals(file.ContentType, expectedType, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Only JPG, PNG, WEBP, and PDF prescriptions are supported.");
        await using var input = file.OpenReadStream();
        var bytes = new byte[file.Length];
        await input.ReadExactlyAsync(bytes, cancellationToken);
        if (!HasExpectedSignature(bytes, extension)) throw new InvalidDataException("The uploaded file is not a valid image or PDF.");
        if (file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) ImageContentValidation.Validate(bytes, extension);
        Directory.CreateDirectory(root);
        var storedName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        await File.WriteAllBytesAsync(Path.Combine(root, storedName), bytes, cancellationToken);
        return new StoredPrescriptionFile(Path.GetFileName(file.FileName), storedName, expectedType, bytes.LongLength, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    public Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken)
    {
        if (Path.GetFileName(storedFileName) != storedFileName) return Task.FromResult<Stream?>(null);
        var path = Path.Combine(root, storedFileName);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    private static bool HasExpectedSignature(byte[] bytes, string extension) => extension.ToLowerInvariant() switch
    {
        ".pdf" => bytes.Length >= 5 && Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-",
        ".png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        ".webp" => bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        ".jpg" or ".jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
        _ => false,
    };
}

public interface IPrescriptionOcrService
{
    Task<OcrResult> ExtractAsync(Stream content, string contentType, string fileName, CancellationToken cancellationToken);
}

public sealed class TesseractOcrService(IConfiguration configuration) : IPrescriptionOcrService
{
    private readonly string executable = configuration["Ocr:TesseractPath"] ?? "tesseract";
    private readonly string pdfToText = configuration["Ocr:PdfToTextPath"] ?? "pdftotext";
    private readonly string pdfToPpm = configuration["Ocr:PdfToPpmPath"] ?? "pdftoppm";
    private readonly string languages = configuration["Ocr:Languages"] ?? "eng+nep";

    public async Task<OcrResult> ExtractAsync(Stream content, string contentType, string fileName, CancellationToken cancellationToken)
    {
        var extension = contentType == "application/pdf" ? ".pdf" : contentType == "image/png" ? ".png" : contentType == "image/webp" ? ".webp" : ".jpg";
        var temporaryDirectory = Path.Combine(Path.GetTempPath(), $"anhh-ocr-{Guid.NewGuid():N}");
        var temporaryFile = Path.Combine(temporaryDirectory, $"prescription{extension}");
        try
        {
            Directory.CreateDirectory(temporaryDirectory);
            await using (var output = File.Create(temporaryFile)) await content.CopyToAsync(output, cancellationToken);
            string text;
            if (contentType == "application/pdf")
            {
                text = await ExtractPdfTextAsync(temporaryFile, cancellationToken);
                if (string.IsNullOrWhiteSpace(text))
                {
                    var prefix = Path.Combine(temporaryDirectory, "page");
                    var renderResult = await RunProcessAsync(pdfToPpm, ["-f", "1", "-l", "3", "-scale-to", "1800", "-png", temporaryFile, prefix], cancellationToken);
                    if (renderResult.ExitCode != 0) throw new InvalidOperationException("The PDF pages could not be rendered for scanning.");
                    var pageFiles = Directory.GetFiles(temporaryDirectory, "page-*.png").Order(StringComparer.Ordinal).Take(3).ToArray();
                    var pages = new List<string>();
                    foreach (var page in pageFiles) pages.Add(await ExtractImageTextAsync(page, cancellationToken));
                    text = string.Join(Environment.NewLine, pages);
                }
            }
            else text = await ExtractImageTextAsync(temporaryFile, cancellationToken);
            if (string.IsNullOrWhiteSpace(text)) return new(false, "tesseract", "completed_no_text", text, [], "No readable medicine details were detected. Please review the original file and add or correct the medicine details manually.");
            return new(true, "tesseract", "completed", text, PrescriptionTextParser.Parse(text), null);
        }
        catch (Win32Exception)
        {
            return new(false, "tesseract", "not_configured", null, [], "OCR is not available on this server. Please submit the file for pharmacist review or enter the medicine details manually.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new(false, "tesseract", "timeout", null, [], "Scanning took too long. Please try a clearer image or submit the prescription for pharmacist review.");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            return new(false, "tesseract", "failed", null, [], "The prescription could not be scanned. Please try another clear file or submit it for pharmacist review.");
        }
        finally { try { Directory.Delete(temporaryDirectory, recursive: true); } catch { /* best effort cleanup */ } }
    }

    private async Task<string> ExtractPdfTextAsync(string path, CancellationToken cancellationToken)
    {
        try
        {
            var result = await RunProcessAsync(pdfToText, ["-layout", "-enc", "UTF-8", path, "-"], cancellationToken);
            return result.ExitCode == 0 ? result.Output : string.Empty;
        }
        catch (Win32Exception) { return string.Empty; }
    }

    private async Task<string> ExtractImageTextAsync(string path, CancellationToken cancellationToken)
    {
        var result = await RunProcessAsync(executable, [path, "stdout", "-l", languages, "--psm", "6"], cancellationToken);
        if (result.ExitCode != 0) throw new InvalidOperationException("The OCR engine could not read the image.");
        return result.Output;
    }

    private static async Task<(int ExitCode, string Output, string Error)> RunProcessAsync(string executablePath, IReadOnlyList<string> arguments, CancellationToken cancellationToken)
    {
        using var process = new Process { StartInfo = new ProcessStartInfo { FileName = executablePath, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true } };
        foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
        process.Start();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(90));
        var outputTask = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var errorTask = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            return (process.ExitCode, await outputTask, await errorTask);
        }
        catch (OperationCanceledException)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
            if (!cancellationToken.IsCancellationRequested) throw;
            throw;
        }
    }
}

public static class PrescriptionTextParser
{
    private static readonly Regex Strength = new(@"(?<value>\d+(?:\.\d+)?)\s*(?<unit>mg|mcg|g|ml|%|iu)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Quantity = new(@"(?:qty|quantity|x)\s*[:\-]?\s*(?<value>\d+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Frequency = new(@"(?<value>\b\d\s*[-–/]\s*\d\s*[-–/]\s*\d\b|\b(?:OD|BD|BID|TDS|TID|QID|HS|SOS|PRN)\b|\d+\s*(?:times?|x)\s*(?:a|per)?\s*day|once daily|twice daily|three times daily)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Duration = new(@"(?<value>\d+\s*(?:day|days|week|weeks|month|months))", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Dosage = new(@"(?<value>\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|ml|drops?|puffs?|sachets?))", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Timing = new(@"(?<value>(?:before|after|with)\s+(?:food|meals?)|(?:in the )?(?:morning|afternoon|evening|night|bedtime))", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static IReadOnlyList<ExtractedMedicineDraft> Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        return text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line => ParseLine(line))
            .Where(item => item is not null)
            .Cast<ExtractedMedicineDraft>()
            .ToList();
    }

    private static ExtractedMedicineDraft? ParseLine(string line)
    {
        var strength = Strength.Match(line);
        var quantity = Quantity.Match(line);
        var frequency = Frequency.Match(line);
        var duration = Duration.Match(line);
        var dosage = Dosage.Match(line);
        var timing = Timing.Match(line);
        if (!strength.Success && !frequency.Success && !quantity.Success && !dosage.Success) return null;
        var parsedQuantity = quantity.Success &&
            int.TryParse(quantity.Groups["value"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var quantityValue) &&
            quantityValue is > 0 and <= 10_000
                ? quantityValue
                : (int?)null;
        var name = line;
        foreach (var match in new[] { strength, quantity, frequency, duration, dosage, timing }) if (match.Success) name = name.Replace(match.Value, "", StringComparison.OrdinalIgnoreCase);
        name = Regex.Replace(name, @"^[\d\s.)\-]+", "").Trim(' ', ':', '-', '.', ',');
        if (name.Length < 3 || !name.Any(char.IsLetter)) return null;
        return new ExtractedMedicineDraft(name, MedicineNormalizationService.Normalize(name), strength.Success ? $"{strength.Groups["value"].Value} {strength.Groups["unit"].Value.ToLowerInvariant()}" : null, null, dosage.Success ? dosage.Groups["value"].Value : null, parsedQuantity, frequency.Success ? frequency.Groups["value"].Value : null, duration.Success ? duration.Groups["value"].Value : null, timing.Success ? timing.Groups["value"].Value : null, line.Trim());
    }
}

public static class MedicineNormalizationService
{
    public static string Normalize(string? value) => Regex.Replace((value ?? string.Empty).ToLowerInvariant().Replace("-", " "), @"[^a-z0-9]+", " ").Trim();
    public static string[] Tokens(string? value) => Normalize(value).Split(' ', StringSplitOptions.RemoveEmptyEntries);
    public static string? NormalizeStrength(string? value) => Normalize(value).Replace(" ", "", StringComparison.Ordinal);
}

public interface IMedicineMatchingService
{
    Task<IReadOnlyList<MedicineMatchResult>> MatchAsync(IEnumerable<ExtractedMedicineDraft> items, CancellationToken cancellationToken);
}

public sealed class MedicineMatchingService(ApplicationDbContext dbContext) : IMedicineMatchingService
{
    public async Task<IReadOnlyList<MedicineMatchResult>> MatchAsync(IEnumerable<ExtractedMedicineDraft> items, CancellationToken cancellationToken)
    {
        var products = await dbContext.Products.AsNoTracking().Include(x => x.Medicine).Include(x => x.Brand).Include(x => x.Inventory).Where(x => x.IsActive).ToListAsync(cancellationToken);
        return items.Select(item => MatchOne(item, products)).ToList();
    }

    private static MedicineMatchResult MatchOne(ExtractedMedicineDraft item, IReadOnlyList<Product> products)
    {
        var best = products.Select(product => (Product: product, Score: Score(item, product))).OrderByDescending(x => x.Score).FirstOrDefault();
        if (best.Product is null || best.Score < 70) return new(null, Math.Round(Math.Max(0, best.Score), 2), "none", MatchAvailability.NotFound, 0, true);
        var stock = best.Product.Inventory.Where(x => x.ExpiryDate is null || x.ExpiryDate.Value.Date >= DateTime.UtcNow.Date).Sum(x => Math.Max(0, x.StockQuantity - x.ReservedQuantity));
        var availability = stock <= 0 ? MatchAvailability.OutOfStock : item.Quantity is > 0 && stock < item.Quantity ? MatchAvailability.PartiallyAvailable : MatchAvailability.Available;
        var needsReview = best.Score < 90 || best.Product.Medicine?.PrescriptionRequired == true;
        if (best.Score < 90) availability = MatchAvailability.NeedsReview;
        return new(best.Product, Math.Round(best.Score, 2), best.Score >= 90 ? "high_confidence" : "possible_match", availability, stock, needsReview);
    }

    private static decimal Score(ExtractedMedicineDraft item, Product product)
    {
        var detected = MedicineNormalizationService.Normalize(item.DetectedName);
        var name = MedicineNormalizationService.Normalize(product.Medicine?.Name);
        var generic = MedicineNormalizationService.Normalize(product.Medicine?.GenericName);
        var brand = MedicineNormalizationService.Normalize(product.Brand?.Name);
        var nameScore = Math.Max(Similarity(detected, name), Similarity(detected, generic));
        if (detected.Contains(brand, StringComparison.Ordinal) && brand.Length > 2) nameScore = Math.Min(100, nameScore + 5);
        var detectedStrength = MedicineNormalizationService.NormalizeStrength(item.Strength);
        var productStrength = MedicineNormalizationService.NormalizeStrength(product.Medicine?.Strength);
        if (!string.IsNullOrWhiteSpace(detectedStrength) && !string.IsNullOrWhiteSpace(productStrength)) nameScore += detectedStrength == productStrength ? 5 : -10;
        return Math.Clamp(nameScore, 0, 100);
    }

    private static decimal Similarity(string left, string right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return 0;
        if (left == right) return 95;
        var distance = Levenshtein(left, right);
        return Math.Round(100m * (1m - (decimal)distance / Math.Max(left.Length, right.Length)), 2);
    }

    private static int Levenshtein(string left, string right)
    {
        var row = Enumerable.Range(0, right.Length + 1).ToArray();
        for (var i = 1; i <= left.Length; i++)
        {
            var previous = row[0]; row[0] = i;
            for (var j = 1; j <= right.Length; j++)
            {
                var current = row[j];
                row[j] = Math.Min(Math.Min(row[j] + 1, row[j - 1] + 1), previous + (left[i - 1] == right[j - 1] ? 0 : 1));
                previous = current;
            }
        }
        return row[right.Length];
    }
}
