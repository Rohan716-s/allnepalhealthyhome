using System.Security.Cryptography;
using System.Text;
using System.Buffers.Binary;
using System.Buffers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace backend.Services;

public sealed record StoredMediaFile(string OriginalFileName, string StoredFileName, string ContentType, long Length, string Sha256);

public sealed class ImageUploadOptions
{
    public long MaxFileSizeBytes { get; set; } = 8 * 1024 * 1024;
    public Dictionary<string, string> AllowedTypes { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp",
        [".gif"] = "image/gif", [".bmp"] = "image/bmp", [".avif"] = "image/avif", [".svg"] = "image/svg+xml",
    };
}

public sealed class HeroVideoUploadOptions
{
    public long MaxFileSizeBytes { get; set; } = 100 * 1024 * 1024;
}

public interface IMediaFileStorage
{
    Task<StoredMediaFile> SaveAsync(IFormFile file, CancellationToken cancellationToken, bool allowSvg = false);
    Task<StoredMediaFile> SaveHeroVideoAsync(IFormFile file, CancellationToken cancellationToken);
    Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken);
    Task DeleteAsync(string storedFileName, CancellationToken cancellationToken);
}

public sealed class MediaFileStorage(IConfiguration configuration, IHostEnvironment environment, IOptions<ImageUploadOptions> configuredOptions, IOptions<HeroVideoUploadOptions> configuredVideoOptions) : IMediaFileStorage
{
    private readonly ImageUploadOptions options = configuredOptions.Value;
    private readonly HeroVideoUploadOptions videoOptions = configuredVideoOptions.Value;

    private readonly string? configuredRoot = string.IsNullOrWhiteSpace(configuration["Storage:MediaRoot"])
        ? null
        : Path.GetFullPath(configuration["Storage:MediaRoot"]!);

    // Development is often started from the repository root while the seeded
    // files live under backend/App_Data/media. Keep the configured path as the
    // source of truth, but safely read from both supported launch locations
    // when no explicit path has been configured.
    private IEnumerable<string> Roots => configuredRoot is not null
        ? new[] { configuredRoot }
        : new[]
        {
            Path.Combine(environment.ContentRootPath, "App_Data", "media"),
            Path.Combine(environment.ContentRootPath, "backend", "App_Data", "media"),
            Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "App_Data", "media")),
            Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "media"),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", "App_Data", "media"),
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "App_Data", "media")),
        }.Distinct(StringComparer.OrdinalIgnoreCase);

    private string WriteRoot => configuredRoot
        ?? (Directory.Exists(Path.Combine(environment.ContentRootPath, "backend"))
            ? Path.Combine(environment.ContentRootPath, "backend", "App_Data", "media")
            : Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "backend"))
                ? Path.Combine(Directory.GetCurrentDirectory(), "backend", "App_Data", "media")
                : Path.Combine(environment.ContentRootPath, "App_Data", "media"));

    public async Task<StoredMediaFile> SaveAsync(IFormFile file, CancellationToken cancellationToken, bool allowSvg = false)
    {
        if (file is null || file.Length == 0) throw new InvalidDataException("Please choose an image.");
        if (file.Length > options.MaxFileSizeBytes) throw new InvalidDataException($"Image is too large. Maximum allowed size is {options.MaxFileSizeBytes / (1024 * 1024)} MB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension is ".tif" or ".tiff" or ".heic" or ".heif") throw new InvalidDataException("TIF/TIFF and HEIC/HEIF images are not supported by this server yet. Please convert the image to SVG, JPG, PNG, WebP, GIF, BMP, or AVIF.");
        if (!options.AllowedTypes.TryGetValue(extension, out var expectedType)) throw new InvalidDataException("This image format is not supported. Use SVG, JPG, PNG, WebP, GIF, BMP, or AVIF.");
        if (extension == ".svg" && !allowSvg) throw new InvalidDataException("SVG files can only be uploaded as logo assets.");
        if (!string.Equals(file.ContentType, expectedType, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("The file extension and image type do not match.");
        var bytes = new byte[checked((int)file.Length)];
        await using var input = file.OpenReadStream();
        await input.ReadExactlyAsync(bytes, cancellationToken);
        if (!HasExpectedSignature(bytes, extension) || !HasUsableDimensions(bytes, extension)) throw new InvalidDataException("The uploaded file is not a valid image or could not be processed.");
        ImageContentValidation.Validate(bytes, extension);
        var root = WriteRoot;
        Directory.CreateDirectory(root);
        var storedName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        await File.WriteAllBytesAsync(Path.Combine(root, storedName), bytes, cancellationToken);
        return new StoredMediaFile(Path.GetFileName(file.FileName), storedName, expectedType, bytes.LongLength, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    public async Task<StoredMediaFile> SaveHeroVideoAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0) throw new InvalidDataException("Please choose a video file.");
        if (file.Length > videoOptions.MaxFileSizeBytes) throw new InvalidDataException($"Video is too large. Maximum allowed size is {videoOptions.MaxFileSizeBytes / (1024 * 1024)} MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var expectedType = extension switch
        {
            ".mp4" or ".m4v" => "video/mp4",
            ".webm" => "video/webm",
            ".mov" => "video/quicktime",
            ".ogv" => "video/ogg",
            _ => throw new InvalidDataException("This video format is not supported. Use MP4, WebM, MOV, M4V, or OGV."),
        };
        var suppliedType = file.ContentType?.Trim();
        var alternateTypeAllowed = extension == ".m4v" && string.Equals(suppliedType, "video/x-m4v", StringComparison.OrdinalIgnoreCase)
            || extension == ".ogv" && string.Equals(suppliedType, "application/ogg", StringComparison.OrdinalIgnoreCase);
        if (!string.Equals(suppliedType, expectedType, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(suppliedType, "application/octet-stream", StringComparison.OrdinalIgnoreCase)
            && !alternateTypeAllowed)
            throw new InvalidDataException("The file extension and video type do not match.");
        if (file.Length < 12) throw new InvalidDataException("The uploaded file is too short to be a valid video.");

        await using var input = file.OpenReadStream();
        var signature = new byte[12];
        var signatureLength = await input.ReadAsync(signature, cancellationToken);
        if (!HasExpectedVideoSignature(signature.AsSpan(0, signatureLength), extension))
            throw new InvalidDataException("The uploaded file is not a valid supported video.");
        if (!input.CanSeek) throw new InvalidDataException("This video upload could not be processed. Please try again.");
        input.Position = 0;

        var root = WriteRoot;
        Directory.CreateDirectory(root);
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var path = Path.Combine(root, storedName);
        try
        {
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81_920, FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                var buffer = ArrayPool<byte>.Shared.Rent(81_920);
                try
                {
                    int read;
                    while ((read = await input.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
                    {
                        hash.AppendData(buffer, 0, read);
                        await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                    }
                }
                finally { ArrayPool<byte>.Shared.Return(buffer); }
            }
            return new StoredMediaFile(Path.GetFileName(file.FileName), storedName, expectedType, file.Length, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant());
        }
        catch
        {
            if (File.Exists(path)) File.Delete(path);
            throw;
        }
    }

    public Task<Stream?> OpenReadAsync(string storedFileName, CancellationToken cancellationToken)
    {
        if (Path.GetFileName(storedFileName) != storedFileName) return Task.FromResult<Stream?>(null);
        foreach (var root in Roots)
        {
            var path = Path.Combine(root, storedFileName);
            if (File.Exists(path)) return Task.FromResult<Stream?>(File.OpenRead(path));
        }
        return Task.FromResult<Stream?>(null);
    }

    public Task DeleteAsync(string storedFileName, CancellationToken cancellationToken)
    {
        if (Path.GetFileName(storedFileName) == storedFileName)
        {
            foreach (var root in Roots)
            {
                var path = Path.Combine(root, storedFileName);
                if (File.Exists(path))
                {
                    File.Delete(path);
                    break;
                }
            }
        }
        return Task.CompletedTask;
    }

    private static bool HasExpectedSignature(byte[] bytes, string extension) => extension switch
    {
        ".png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        ".jpg" or ".jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
        ".webp" => bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        ".gif" => bytes.Length >= 6 && (Encoding.ASCII.GetString(bytes, 0, 6) == "GIF87a" || Encoding.ASCII.GetString(bytes, 0, 6) == "GIF89a"),
        ".bmp" => bytes.Length >= 2 && bytes[0] == (byte)'B' && bytes[1] == (byte)'M',
        ".avif" => bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 4, 4) == "ftyp" && Encoding.ASCII.GetString(bytes, 8, 4) is "avif" or "avis",
        ".svg" => IsSafeSvg(bytes),
        _ => false,
    };

    private static bool HasExpectedVideoSignature(ReadOnlySpan<byte> bytes, string extension) => extension switch
    {
        ".mp4" or ".m4v" or ".mov" => bytes.Length >= 12 && Encoding.ASCII.GetString(bytes.Slice(4, 4)) == "ftyp",
        ".webm" => bytes.Length >= 4 && bytes[..4].SequenceEqual(new byte[] { 0x1a, 0x45, 0xdf, 0xa3 }),
        ".ogv" => bytes.Length >= 4 && Encoding.ASCII.GetString(bytes[..4]) == "OggS",
        _ => false,
    };

    private static bool IsSafeSvg(byte[] bytes)
    {
        var text = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
        if (!text.StartsWith("<svg", StringComparison.OrdinalIgnoreCase) &&
            !(text.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase) && text.IndexOf("<svg", StringComparison.OrdinalIgnoreCase) >= 0)) return false;
        var normalized = text.ToLowerInvariant();
        return !normalized.Contains("<script") &&
            !normalized.Contains("<foreignobject") &&
            !normalized.Contains("javascript:") &&
            !normalized.Contains(" onload=") &&
            !normalized.Contains(" onclick=") &&
            !normalized.Contains(" onerror=");
    }

    private static bool HasUsableDimensions(byte[] bytes, string extension)
    {
        try
        {
            var (width, height) = extension switch
            {
                ".png" when bytes.Length >= 24 => (BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16, 4)), BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20, 4))),
                ".gif" when bytes.Length >= 10 => (BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(6, 2)), BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(8, 2))),
                ".bmp" when bytes.Length >= 26 => (BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(18, 4)), Math.Abs(BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(22, 4)))),
                ".webp" => ReadWebpDimensions(bytes),
                ".jpg" or ".jpeg" => ReadJpegDimensions(bytes),
                _ => (1, 1),
            };
            return width > 0 && height > 0;
        }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (IndexOutOfRangeException) { return false; }
    }

    private static (int Width, int Height) ReadWebpDimensions(byte[] bytes)
    {
        if (bytes.Length >= 30 && Encoding.ASCII.GetString(bytes, 12, 4) == "VP8X") return (1 + ReadUInt24Little(bytes, 24), 1 + ReadUInt24Little(bytes, 27));
        return (1, 1);
    }

    private static int ReadUInt24Little(byte[] bytes, int offset) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

    private static (int Width, int Height) ReadJpegDimensions(byte[] bytes)
    {
        var offset = 2;
        while (offset + 9 < bytes.Length)
        {
            if (bytes[offset] != 0xff) { offset++; continue; }
            var marker = bytes[offset + 1]; offset += 2;
            if (marker is 0xd8 or 0xd9) continue;
            if (offset + 2 > bytes.Length) return (0, 0);
            var length = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset, 2));
            if (length < 2 || offset + length > bytes.Length) return (0, 0);
            if (marker is >= 0xc0 and <= 0xc3 or >= 0xc5 and <= 0xc7 or >= 0xc9 and <= 0xcb or >= 0xcd and <= 0xcf)
                return (BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset + 5, 2)), BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset + 3, 2)));
            offset += length;
        }
        return (0, 0);
    }
}
