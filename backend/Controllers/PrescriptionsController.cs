using backend.Contracts;
using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/prescriptions")]
public sealed class PrescriptionsController(ApplicationDbContext dbContext, IPrescriptionFileStorage fileStorage, IPrescriptionOcrService ocrService, IMedicineMatchingService matchingService, INotificationTemplateService notifications) : ControllerBase
{
    private const long MaxFileSize = 10 * 1024 * 1024;

    [HttpPost]
    [RequestSizeLimit(MaxFileSize)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PrescriptionResponse>> Create([FromForm] IFormFile file, [FromForm] string? customerNote, CancellationToken cancellationToken)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized(new { message = "Please sign in before uploading a prescription." });
        try
        {
            var stored = await fileStorage.SaveAsync(file, cancellationToken);
            var duplicate = await dbContext.Prescriptions.AsNoTracking().Where(x => x.CustomerId == customerId && x.FileSha256 == stored.Sha256).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
            if (duplicate is not null) return Ok(await LoadResponseAsync(duplicate.Id, cancellationToken));
            var prescription = new Prescription { CustomerId = customerId, OriginalFileName = stored.OriginalFileName, StoredFileName = stored.StoredFileName, ContentType = stored.ContentType, FileSizeBytes = stored.Length, FileSha256 = stored.Sha256, CustomerNote = customerNote, Status = PrescriptionStatuses.Scanning };
            dbContext.Prescriptions.Add(prescription);
            AddHistory(prescription, PrescriptionStatuses.Scanning, "Prescription uploaded and queued for scanning.");
            await dbContext.SaveChangesAsync(cancellationToken);
            await ScanInternalAsync(prescription, cancellationToken);
            return Ok(await LoadResponseAsync(prescription.Id, cancellationToken));
        }
        catch (InvalidDataException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PrescriptionResponse>>> List(CancellationToken cancellationToken)
    {
        if (!User.TryGetCustomerId(out var customerId)) return Unauthorized();
        var ids = await dbContext.Prescriptions.AsNoTracking().Where(x => x.CustomerId == customerId).OrderByDescending(x => x.CreatedAt).Select(x => x.Id).ToListAsync(cancellationToken);
        var result = new List<PrescriptionResponse>();
        foreach (var id in ids) result.Add(await LoadResponseAsync(id, cancellationToken));
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PrescriptionResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        return prescription is null ? NotFound() : Ok(ToResponse(prescription, await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken)));
    }

    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> File(Guid id, CancellationToken cancellationToken)
    {
        var prescription = await dbContext.Prescriptions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == CurrentCustomerId(), cancellationToken);
        if (prescription is null) return NotFound();
        var stream = await fileStorage.OpenReadAsync(prescription.StoredFileName, cancellationToken);
        return stream is null ? NotFound() : File(stream, prescription.ContentType, prescription.OriginalFileName, enableRangeProcessing: true);
    }

    [HttpPost("{id:guid}/scan")]
    public async Task<ActionResult<PrescriptionResponse>> Scan(Guid id, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        if (prescription is null) return NotFound();
        prescription.Status = PrescriptionStatuses.Scanning;
        AddHistory(prescription, PrescriptionStatuses.Scanning, "Prescription rescan requested.");
        await dbContext.SaveChangesAsync(cancellationToken);
        await ScanInternalAsync(prescription, cancellationToken);
        return Ok(await LoadResponseAsync(id, cancellationToken));
    }

    [HttpPost("{id:guid}/clarification-upload")]
    [RequestSizeLimit(MaxFileSize)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PrescriptionResponse>> ClarificationUpload(Guid id, [FromForm] IFormFile file, [FromForm] string? customerNote, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        if (prescription is null) return NotFound();
        if (prescription.Status != PrescriptionStatuses.NeedClarification) return Conflict(new { message = "This prescription is not waiting for clarification." });
        try
        {
            var stored = await fileStorage.SaveAsync(file, cancellationToken);
            dbContext.PrescriptionExtractedItems.RemoveRange(prescription.ExtractedItems);
            prescription.OriginalFileName = stored.OriginalFileName; prescription.StoredFileName = stored.StoredFileName; prescription.ContentType = stored.ContentType; prescription.FileSizeBytes = stored.Length; prescription.FileSha256 = stored.Sha256; prescription.CustomerNote = customerNote ?? prescription.CustomerNote; prescription.Status = PrescriptionStatuses.Scanning; prescription.SubmittedAt = null; prescription.UpdatedAt = DateTime.UtcNow;
            AddHistory(prescription, PrescriptionStatuses.Scanning, "Customer uploaded an updated prescription after clarification.");
            var staffMessage = await notifications.RenderAsync("PRESCRIPTION_CLARIFICATION", "Updated prescription uploaded", $"A customer has uploaded an updated prescription for review: {prescription.Id}.", new Dictionary<string, string?> { ["prescription_id"] = prescription.Id.ToString() }, cancellationToken);
            foreach (var staff in await dbContext.StaffUsers.Where(x => x.Role == StaffRoles.Pharmacist && x.IsActive).ToListAsync(cancellationToken)) dbContext.Notifications.Add(new Notification { StaffUserId = staff.Id, Type = "clarification_response", Title = staffMessage.Title, Body = staffMessage.Body });
            await dbContext.SaveChangesAsync(cancellationToken); await ScanInternalAsync(prescription, cancellationToken); return Ok(await LoadResponseAsync(id, cancellationToken));
        }
        catch (InvalidDataException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult<PrescriptionResponse>> UpdateItem(Guid id, Guid itemId, UpdatePrescriptionItemRequest request, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        var item = prescription?.ExtractedItems.SingleOrDefault(x => x.Id == itemId);
        if (prescription is null || item is null) return NotFound();
        var validation = ValidateItemRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });
        item.DetectedName = request.DetectedName.Trim(); item.NormalizedName = MedicineNormalizationService.Normalize(request.DetectedName); item.Strength = request.Strength; item.DosageForm = request.DosageForm; item.Dosage = request.Dosage; item.Quantity = request.Quantity; item.Frequency = request.Frequency; item.Duration = request.Duration; item.Timing = request.Timing; item.Instructions = request.Instructions; item.CustomerEdited = true; item.UpdatedAt = DateTime.UtcNow;
        dbContext.PrescriptionMedicineMatches.RemoveRange(item.Matches);
        var matches = await matchingService.MatchAsync([new ExtractedMedicineDraft(item.DetectedName, item.NormalizedName, item.Strength, item.DosageForm, item.Dosage, item.Quantity, item.Frequency, item.Duration, item.Timing, item.Instructions)], cancellationToken);
        AddMatches(item, matches);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(await LoadResponseAsync(id, cancellationToken));
    }

    [HttpPost("{id:guid}/items")]
    public async Task<ActionResult<PrescriptionResponse>> AddItem(Guid id, UpdatePrescriptionItemRequest request, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        if (prescription is null) return NotFound();
        var validation = ValidateItemRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });
        var item = new PrescriptionExtractedItem { PrescriptionId = id, DetectedName = request.DetectedName.Trim(), NormalizedName = MedicineNormalizationService.Normalize(request.DetectedName), Strength = request.Strength, DosageForm = request.DosageForm, Dosage = request.Dosage, Quantity = request.Quantity, Frequency = request.Frequency, Duration = request.Duration, Timing = request.Timing, Instructions = request.Instructions, CustomerEdited = true };
        var matches = await matchingService.MatchAsync([new ExtractedMedicineDraft(item.DetectedName, item.NormalizedName, item.Strength, item.DosageForm, item.Dosage, item.Quantity, item.Frequency, item.Duration, item.Timing, item.Instructions)], cancellationToken);
        AddMatches(item, matches);
        dbContext.PrescriptionExtractedItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(await LoadResponseAsync(id, cancellationToken));
    }

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> DeleteItem(Guid id, Guid itemId, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        var item = prescription?.ExtractedItems.SingleOrDefault(x => x.Id == itemId);
        if (prescription is null || item is null) return NotFound();
        dbContext.PrescriptionExtractedItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<PrescriptionResponse>> Submit(Guid id, SubmitPrescriptionRequest request, CancellationToken cancellationToken)
    {
        var prescription = await GetOwnedAsync(id, cancellationToken);
        if (prescription is null) return NotFound();
        prescription.CustomerNote = request.CustomerNote ?? prescription.CustomerNote;
        prescription.Status = PrescriptionStatuses.PendingPharmacistReview;
        prescription.SubmittedAt = DateTime.UtcNow;
        prescription.UpdatedAt = DateTime.UtcNow;
        dbContext.PrescriptionReviews.Add(new PrescriptionReview { PrescriptionId = prescription.Id, Status = PrescriptionStatuses.PendingPharmacistReview, Notes = "Awaiting pharmacist review." });
        AddHistory(prescription, PrescriptionStatuses.PendingPharmacistReview, "Awaiting pharmacist review.");
        var message = await notifications.RenderAsync("PRESCRIPTION_SUBMITTED", "Prescription submitted", "Your prescription is pending pharmacist review.", new Dictionary<string, string?> { ["prescription_id"] = prescription.Id.ToString() }, cancellationToken);
        dbContext.Notifications.Add(new Notification { CustomerId = prescription.CustomerId, Type = "prescription_submitted", Title = message.Title, Body = message.Body });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(await LoadResponseAsync(id, cancellationToken));
    }

    private async Task ScanInternalAsync(Prescription prescription, CancellationToken cancellationToken)
    {
        await using var file = await fileStorage.OpenReadAsync(prescription.StoredFileName, cancellationToken);
        if (file is null) { prescription.Status = PrescriptionStatuses.Uploaded; prescription.OcrStatus = "file_unavailable"; AddHistory(prescription, PrescriptionStatuses.Uploaded, "Prescription file could not be opened."); await dbContext.SaveChangesAsync(cancellationToken); return; }
        var ocr = await ocrService.ExtractAsync(file, prescription.ContentType, prescription.OriginalFileName, cancellationToken);
        prescription.OcrProvider = ocr.Provider; prescription.OcrStatus = ocr.Status; prescription.OcrText = ocr.RawText;
        if (!ocr.Success)
        {
            prescription.Status = PrescriptionStatuses.Uploaded;
            AddHistory(prescription, PrescriptionStatuses.Uploaded, ocr.ErrorMessage);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }
        dbContext.PrescriptionExtractedItems.RemoveRange(prescription.ExtractedItems);
        var matches = await matchingService.MatchAsync(ocr.Items, cancellationToken);
        for (var index = 0; index < ocr.Items.Count; index++)
        {
            var draft = ocr.Items[index];
            var item = new PrescriptionExtractedItem { PrescriptionId = prescription.Id, DetectedName = draft.DetectedName, NormalizedName = draft.NormalizedName, Strength = draft.Strength, DosageForm = draft.DosageForm, Dosage = draft.Dosage, Quantity = draft.Quantity, Frequency = draft.Frequency, Duration = draft.Duration, Timing = draft.Timing, Instructions = draft.Instructions };
            dbContext.PrescriptionExtractedItems.Add(item);
            AddMatches(item, [matches[index]]);
        }
        prescription.Status = PrescriptionStatuses.Scanned;
        AddHistory(prescription, PrescriptionStatuses.Scanned, "OCR scan completed; pharmacist review is still required.");
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void AddMatches(PrescriptionExtractedItem item, IEnumerable<MedicineMatchResult> results)
    {
        foreach (var match in results) item.Matches.Add(new PrescriptionMedicineMatch { ProductId = match.Product?.Id, Confidence = match.Confidence, MatchType = match.MatchType, Availability = match.Availability, StockQuantity = match.StockQuantity, NeedsPharmacistReview = match.NeedsPharmacistReview });
    }

    private static string? ValidateItemRequest(UpdatePrescriptionItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DetectedName) || request.DetectedName.Trim().Length > 220) return "Medicine name is required and must be no more than 220 characters.";
        if (request.Quantity is < 1 or > 10000) return "Medicine quantity must be a whole number between 1 and 10,000.";
        if (request.Strength?.Length > 80 || request.DosageForm?.Length > 80) return "Strength and dosage form must be no more than 80 characters.";
        if (request.Dosage?.Length > 160 || request.Frequency?.Length > 160 || request.Duration?.Length > 160 || request.Timing?.Length > 160) return "Dosage, frequency, duration, and timing must each be no more than 160 characters.";
        if (request.Instructions?.Length > 1000) return "Instructions must be no more than 1,000 characters.";
        return null;
    }

    private void AddHistory(Prescription prescription, string status, string? note) => dbContext.PrescriptionStatusHistory.Add(new PrescriptionStatusHistory { PrescriptionId = prescription.Id, Status = status, Note = note, ActorRole = "SYSTEM" });

    private async Task<Prescription?> GetOwnedAsync(Guid id, CancellationToken cancellationToken) => await dbContext.Prescriptions.Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Medicine).Include(x => x.ExtractedItems).ThenInclude(x => x.Matches).ThenInclude(x => x.Product).ThenInclude(x => x!.Brand).SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == CurrentCustomerId(), cancellationToken);
    private async Task<PrescriptionResponse> LoadResponseAsync(Guid id, CancellationToken cancellationToken) => ToResponse(await GetOwnedAsync(id, cancellationToken) ?? throw new InvalidOperationException("Prescription not found."), await OrderPolicyReader.PricesVisibleAsync(dbContext, User, cancellationToken));
    private Guid CurrentCustomerId() => User.TryGetCustomerId(out var customerId) ? customerId : Guid.Empty;

    private static PrescriptionResponse ToResponse(Prescription prescription, bool pricesVisible) => new(prescription.Id, prescription.OriginalFileName, prescription.ContentType, prescription.FileSizeBytes, prescription.Status, prescription.OcrProvider, prescription.OcrStatus, prescription.CustomerNote, prescription.CreatedAt, prescription.SubmittedAt, prescription.ExtractedItems.Select(item => new PrescriptionExtractedItemResponse(item.Id, item.DetectedName, item.NormalizedName, item.Strength, item.DosageForm, item.Quantity, item.Frequency, item.Duration, item.Instructions, item.CustomerEdited, item.Matches.Select(match => new PrescriptionMatchResponse(match.Id, match.ProductId, match.Product?.Name, match.Product?.Brand?.Name, pricesVisible ? match.Product?.SellingPrice : null, match.Confidence, match.MatchType, match.Availability, match.StockQuantity, match.NeedsPharmacistReview, match.Product?.Medicine?.PrescriptionRequired ?? false, match.Product?.Slug)).ToList(), item.Dosage, item.Timing)).ToList());
}
