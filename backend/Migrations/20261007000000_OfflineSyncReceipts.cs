using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace backend.Migrations;

// Middleware-owned replay ledger. Deliberately independent of domain EF models.
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261007000000_OfflineSyncReceipts")]
public sealed class OfflineSyncReceipts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS offline_sync_receipts (
          Owner varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          OperationId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          RequestHash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          StatusCode int NOT NULL,
          ResponseBody longtext CHARACTER SET utf8mb4 NOT NULL,
          CreatedAt datetime(6) NOT NULL,
          PRIMARY KEY (Owner, OperationId)
        ) ENGINE=InnoDB;
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("offline_sync_receipts");
}
