using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SkiaSharp;
using System.Security.Cryptography;
using System.IO.Compression;

var root = Path.GetFullPath(args.FirstOrDefault() ?? ".tmp-transparency-fixtures");
Directory.CreateDirectory(root);
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Storage:MediaRoot"] = Path.Combine(root, "media"),
    ["Storage:PrescriptionRoot"] = Path.Combine(root, "prescriptions"),
    ["Storage:OrderDocumentsRoot"] = Path.Combine(root, "documents"),
    ["Storage:MessageRoot"] = Path.Combine(root, "messages")
}).Build();
var env = new TestEnvironment { ContentRootPath = root };
var media = new MediaFileStorage(config, env, Options.Create(new ImageUploadOptions()), Options.Create(new HeroVideoUploadOptions()));
var prescriptions = new PrescriptionFileStorage(config, env);
var documents = new OrderDocumentStorage(config, env);
var messages = new MessageAttachmentStorage(config, env);
var paths = new (string Name, Func<IFormFile, Task<(string Name, string Hash)>> Save, Func<string, Task<Stream?>> Read)[] {
    ("media", async file => { var s = await media.SaveAsync(file, default); return (s.StoredFileName, s.Sha256); }, name => media.OpenReadAsync(name, default)),
    ("prescriptions", async file => { var s = await prescriptions.SaveAsync(file, default); return (s.StoredFileName, s.Sha256); }, name => prescriptions.OpenReadAsync(name, default)),
    ("documents", async file => { var s = await documents.SaveAsync(file, default); return (s.StoredFileName, s.Sha256); }, name => documents.OpenReadAsync(name, default)),
    ("messages", async file => { var s = await messages.SaveAsync(file, default); return (s.StoredFileName, s.Sha256); }, name => messages.OpenReadAsync(name, default)),
};
using var bitmap = new SKBitmap(new SKImageInfo(48, 32, SKColorType.Rgba8888, SKAlphaType.Unpremul));
bitmap.Erase(SKColors.Transparent);
bitmap.SetPixel(20, 15, new SKColor(20, 160, 90, 128));
bitmap.SetPixel(21, 15, SKColors.Red);
using var image = SKImage.FromBitmap(bitmap);
foreach (var (extension, type, format) in new[] { ("png", "image/png", SKEncodedImageFormat.Png), ("webp", "image/webp", SKEncodedImageFormat.Webp), ("jpg", "image/jpeg", SKEncodedImageFormat.Jpeg) }) {
    using var encoded = image.Encode(format, 100);
    var bytes = encoded.ToArray();
    await File.WriteAllBytesAsync(Path.Combine(root, $"fixture.{extension}"), bytes);
    foreach (var storage in paths) {
        var file = Form(bytes, $"../fixture.{extension}", type);
        var first = await storage.Save(file);
        await using var stream = await storage.Read(first.Name) ?? throw new Exception("Missing saved file");
        using var output = new MemoryStream(); await stream.CopyToAsync(output);
        var saved = output.ToArray();
        Assert(saved.SequenceEqual(bytes), "Storage changed original bytes");
        Assert(first.Hash == Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), "Hash mismatch");
        using var decoded = SKBitmap.Decode(saved);
        Assert(decoded.Width == 48 && decoded.Height == 32, "Aspect ratio changed");
        if (extension != "jpg") {
            Assert(decoded.GetPixel(0, 0).Alpha == 0, "Transparent alpha lost");
            Assert(decoded.GetPixel(20, 15).Alpha == 128, "Partial alpha lost");
        }
        var second = await storage.Save(Form(bytes, $"fixture.{extension}", type));
        Assert(second.Name != first.Name, "Replacement overwrote shared image");
        await using var existing = await storage.Read(first.Name);
        Assert(existing is not null, "Existing image removed");
        Assert(await storage.Read("../fixture.png") is null, "Unsafe retrieval path accepted");
        await Reject(() => storage.Save(Form([1, 2, 3], "bad.png", "image/png")));
        await Reject(() => storage.Save(Form(bytes, "wrong.png", "image/jpeg")));
        await Reject(() => storage.Save(Form(new byte[10 * 1024 * 1024 + 1], "big.png", "image/png")));
        await Reject(() => storage.Save(Form(bytes, "bad.exe", "image/png")));
        Console.WriteLine($"PASS {storage.Name}: {extension} original bytes/hash, alpha, dimensions, replacement, original retained, invalid/type/size/path rejection");
    }
}
using var wideBitmap = new SKBitmap(20000, 1);
wideBitmap.Erase(SKColors.Transparent);
using var wideImage = SKImage.FromBitmap(wideBitmap);
using var wideEncoded = wideImage.Encode(SKEncodedImageFormat.Png, 100);
var huge = wideEncoded.ToArray();
await File.WriteAllBytesAsync(Path.Combine(root, "overdimension.png"), huge);
await Reject(() => media.SaveAsync(Form(huge, "huge.png", "image/png"), default));
Console.WriteLine("PASS excessive dimensions rejected");
using (var zipStream = File.Create(Path.Combine(root, "fixtures.zip")))
using (var zip = new ZipArchive(zipStream, ZipArchiveMode.Create)) {
    foreach (var extension in new[] { "png", "webp", "jpg" }) zip.CreateEntryFromFile(Path.Combine(root, $"fixture.{extension}"), $"fixture.{extension}");
}
Console.WriteLine($"Fixtures: {root}");

static FormFile Form(byte[] bytes, string name, string type) => new(new MemoryStream(bytes), 0, bytes.Length, "file", name) { Headers = new HeaderDictionary(), ContentType = type };
static void Assert(bool ok, string message) { if (!ok) throw new Exception(message); }
static async Task Reject(Func<Task> operation) { try { await operation(); } catch (InvalidDataException) { return; } throw new Exception("Invalid upload was accepted"); }
sealed class TestEnvironment : IHostEnvironment {
    public string EnvironmentName { get; set; } = "Testing";
    public string ApplicationName { get; set; } = "TransparencyCheck";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
