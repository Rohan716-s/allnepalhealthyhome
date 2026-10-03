using System.Diagnostics;
using System.ComponentModel;
using System.Security.Cryptography;
using MySqlConnector;

namespace backend.Services;

public sealed record DatabaseBackupResult(bool Succeeded, string FileName, string Provider, long SizeBytes, string? Sha256, string? Error);

public interface IDatabaseBackupService
{
    Task<DatabaseBackupResult> CreateAsync(CancellationToken cancellationToken);
    Task<(bool Succeeded, string? Error)> RestoreAsync(string fileName, CancellationToken cancellationToken);
}

public sealed class MysqlDatabaseBackupService(IConfiguration configuration, IWebHostEnvironment environment, ILogger<MysqlDatabaseBackupService> logger) : IDatabaseBackupService
{
    private string BackupDirectory => Path.Combine(environment.ContentRootPath, "App_Data", "backups");
    private string Provider => configuration["Database:BackupProvider"]?.Trim().ToLowerInvariant() is "docker" ? "docker" : "mysql";

    public async Task<DatabaseBackupResult> CreateAsync(CancellationToken cancellationToken)
    {
        var fileName = $"anhh-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..8]}.sql";
        Directory.CreateDirectory(BackupDirectory);
        var path = SafePath(fileName);
        try
        {
            await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true);
            var result = await RunAsync(BuildDumpStartInfo(), output, null, cancellationToken);
            if (!result.Succeeded)
            {
                output.Close();
                File.Delete(path);
                return new(false, fileName, Provider, 0, null, result.Error);
            }
            await output.FlushAsync(cancellationToken);
            await output.DisposeAsync();
            var info = new FileInfo(path);
            await using var hashStream = File.OpenRead(path);
            var hash = Convert.ToHexString(await SHA256.HashDataAsync(hashStream, cancellationToken));
            return new(true, fileName, Provider, info.Length, hash, null);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or Win32Exception)
        {
            logger.LogError(exception, "Database backup failed for {FileName}", fileName);
            if (File.Exists(path)) File.Delete(path);
            return new(false, fileName, Provider, 0, null, exception.Message);
        }
    }

    public async Task<(bool Succeeded, string? Error)> RestoreAsync(string fileName, CancellationToken cancellationToken)
    {
        string path;
        try { path = SafePath(fileName); }
        catch (ArgumentException exception) { return (false, exception.Message); }
        if (!File.Exists(path)) return (false, "The selected backup file no longer exists.");
        try
        {
            await using var input = File.OpenRead(path);
            var result = await RunAsync(BuildRestoreStartInfo(), null, input, cancellationToken);
            return result;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or Win32Exception)
        {
            logger.LogError(exception, "Database restore failed for {FileName}", fileName);
            return (false, exception.Message);
        }
    }

    private ProcessStartInfo BuildDumpStartInfo() => BuildStartInfo("mysqldump", "--single-transaction", "--quick", "--routines", "--triggers", "--set-gtid-purged=OFF");
    private ProcessStartInfo BuildRestoreStartInfo() => BuildStartInfo("mysql");

    private ProcessStartInfo BuildStartInfo(string command, params string[] commandArguments)
    {
        var connection = new MySqlConnectionStringBuilder(configuration.GetConnectionString("DefaultConnection") ?? string.Empty);
        if (string.IsNullOrWhiteSpace(connection.Server)) connection.Server = "localhost";
        if (connection.Port == 0) connection.Port = 3306;
        if (string.IsNullOrWhiteSpace(connection.Database)) connection.Database = "allnepalhealthy";
        if (string.IsNullOrWhiteSpace(connection.UserID)) connection.UserID = "appuser";
        if (string.IsNullOrWhiteSpace(connection.Password)) connection.Password = "change_me";
        var startInfo = new ProcessStartInfo
        {
            FileName = Provider == "docker" ? configuration["Database:BackupExecutable"] ?? "docker" : configuration[$"Database:{(command == "mysql" ? "Restore" : "Backup")}Executable"] ?? command,
            RedirectStandardOutput = command == "mysqldump",
            RedirectStandardInput = command == "mysql",
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        if (Provider == "docker")
        {
            startInfo.ArgumentList.Add("exec");
            startInfo.ArgumentList.Add("-i");
            startInfo.ArgumentList.Add("-e");
            startInfo.ArgumentList.Add($"MYSQL_PWD={connection.Password}");
            startInfo.ArgumentList.Add(configuration["Database:BackupContainer"] ?? "allnepalhealthy-mysql");
            startInfo.ArgumentList.Add(command);
            foreach (var argument in commandArguments) startInfo.ArgumentList.Add(argument);
            startInfo.ArgumentList.Add("--host=127.0.0.1");
            startInfo.ArgumentList.Add("--port=3306");
            startInfo.ArgumentList.Add($"--user={connection.UserID}");
            startInfo.ArgumentList.Add(connection.Database);
        }
        else
        {
            foreach (var argument in commandArguments) startInfo.ArgumentList.Add(argument);
            startInfo.ArgumentList.Add($"--host={connection.Server}");
            startInfo.ArgumentList.Add($"--port={connection.Port}");
            startInfo.ArgumentList.Add($"--user={connection.UserID}");
            startInfo.ArgumentList.Add(connection.Database);
        }
        if (!string.IsNullOrEmpty(connection.Password)) startInfo.Environment["MYSQL_PWD"] = connection.Password;
        return startInfo;
    }

    private static async Task<(bool Succeeded, string? Error)> RunAsync(ProcessStartInfo startInfo, Stream? output, Stream? input, CancellationToken cancellationToken)
    {
        using var process = new Process { StartInfo = startInfo };
        if (!process.Start()) return (false, "The database command could not be started.");
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        Task? outputTask = output is null ? null : process.StandardOutput.BaseStream.CopyToAsync(output, cancellationToken);
        Task? inputTask = input is null ? null : input.CopyToAsync(process.StandardInput.BaseStream, cancellationToken).ContinueWith(_ => process.StandardInput.Close(), cancellationToken);
        if (outputTask is not null) await outputTask;
        if (inputTask is not null) await inputTask;
        await process.WaitForExitAsync(cancellationToken);
        var error = await errorTask;
        return process.ExitCode == 0 ? (true, null) : (false, string.IsNullOrWhiteSpace(error) ? $"Database command exited with code {process.ExitCode}." : error.Trim());
    }

    private string SafePath(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || !string.Equals(Path.GetFileName(fileName), fileName, StringComparison.Ordinal)) throw new ArgumentException("The backup filename is invalid.");
        var directory = Path.GetFullPath(BackupDirectory) + Path.DirectorySeparatorChar;
        var path = Path.GetFullPath(Path.Combine(BackupDirectory, fileName));
        if (!path.StartsWith(directory, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("The backup path is outside the backup directory.");
        return path;
    }
}
