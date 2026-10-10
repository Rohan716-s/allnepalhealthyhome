using SkiaSharp;

namespace backend.Services;

/// <summary>Validate pixels without re-encoding. Stored bytes, alpha and metadata remain original.</summary>
public static class ImageContentValidation
{
    public const int MaxDimension = 16384;
    public const long MaxPixels = 40_000_000;

    public static void Validate(byte[] bytes, string extension)
    {
        // SVG is restricted to logo assets and validated separately. AVIF keeps the
        // existing signature validation because this codec does not decode AVIF.
        if (extension.ToLowerInvariant() is ".svg" or ".avif") return;
        using var data = SKData.CreateCopy(bytes);
        using var codec = SKCodec.Create(data);
        if (codec is null) throw new InvalidDataException("The image is invalid or cannot be decoded.");
        var info = codec.Info;
        if (info.Width <= 0 || info.Height <= 0 || info.Width > MaxDimension || info.Height > MaxDimension || (long)info.Width * info.Height > MaxPixels)
            throw new InvalidDataException("Image dimensions exceed 16,384 pixels per side or 40 megapixels.");
        using var bitmap = new SKBitmap(new SKImageInfo(info.Width, info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        var result = codec.GetPixels(bitmap.Info, bitmap.GetPixels());
        if (result != SKCodecResult.Success) throw new InvalidDataException("The image is incomplete or cannot be decoded. Please choose a valid image.");
    }
}
