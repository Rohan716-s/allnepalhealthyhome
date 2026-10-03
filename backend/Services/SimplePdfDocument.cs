using System.Text;

namespace backend.Services;

/// <summary>Creates a dependency-free, text-based PDF for operational exports.</summary>
public static class SimplePdfDocument
{
    public static byte[] Create(string title, string body)
    {
        var lines = new List<string> { ToPdfText(title), $"Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC", string.Empty };
        foreach (var rawLine in body.Replace("\r", string.Empty).Split('\n'))
        {
            var normalized = ToPdfText(rawLine);
            if (normalized.Length == 0) { lines.Add(string.Empty); continue; }
            lines.AddRange(Wrap(normalized, 112));
        }

        const int linesPerPage = 54;
        var pages = new List<List<string>>();
        for (var index = 0; index < lines.Count; index += linesPerPage) pages.Add(lines.Skip(index).Take(linesPerPage).ToList());
        if (pages.Count == 0) pages.Add([]);

        var pageObjectStart = 3;
        var fontObject = pageObjectStart + pages.Count;
        var contentObjectStart = fontObject + 1;
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            $"<< /Type /Pages /Kids [{string.Join(' ', Enumerable.Range(pageObjectStart, pages.Count).Select(number => number + " 0 R"))}] /Count {pages.Count} >>"
        };
        for (var page = 0; page < pages.Count; page++)
        {
            var contentNumber = contentObjectStart + page;
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {fontObject} 0 R >> >> /Contents {contentNumber} 0 R >>");
        }
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
        foreach (var pageLines in pages)
        {
            var content = new StringBuilder("BT\n/F1 8 Tf\n36 756 Td\n11 TL\n");
            foreach (var line in pageLines) content.Append('(').Append(Escape(line)).Append(") Tj T*\n");
            content.Append("ET\n");
            var contentBytes = Encoding.ASCII.GetBytes(content.ToString());
            objects.Add($"<< /Length {contentBytes.Length} >>\nstream\n{content}\nendstream");
        }

        using var output = new MemoryStream();
        Write(output, "%PDF-1.4\n");
        var offsets = new List<long> { 0 };
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(output.Position);
            Write(output, $"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }
        var xrefPosition = output.Position;
        Write(output, $"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1)) Write(output, $"{offset:0000000000} 00000 n \n");
        Write(output, $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefPosition}\n%%EOF\n");
        return output.ToArray();
    }

    private static IEnumerable<string> Wrap(string value, int width)
    {
        for (var index = 0; index < value.Length; index += width) yield return value.Substring(index, Math.Min(width, value.Length - index));
    }

    private static string ToPdfText(string value) => new(value.Select(character => character is >= ' ' and <= '~' ? character : '?').ToArray());
    private static string Escape(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("(", "\\(", StringComparison.Ordinal).Replace(")", "\\)", StringComparison.Ordinal);
    private static void Write(Stream stream, string value) => stream.Write(Encoding.ASCII.GetBytes(value));
}
