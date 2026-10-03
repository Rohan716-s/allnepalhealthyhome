using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AccountSetupAndOpeningBalances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PartySectorId",
                table: "customers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "chart_accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Name = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AccountType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ParentAccountId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    IsSubLedger = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chart_accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_chart_accounts_chart_accounts_ParentAccountId",
                        column: x => x.ParentAccountId,
                        principalTable: "chart_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "party_sectors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_party_sectors", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "account_opening_balances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AccountId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BranchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    EnteredByStaffUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    OpeningDate = table.Column<DateTime>(type: "date", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    CreditAmount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_opening_balances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_account_opening_balances_branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_account_opening_balances_chart_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "chart_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_account_opening_balances_staff_users_EnteredByStaffUserId",
                        column: x => x.EnteredByStaffUserId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_customers_PartySectorId",
                table: "customers",
                column: "PartySectorId");

            migrationBuilder.CreateIndex(
                name: "IX_account_opening_balances_AccountId_OpeningDate",
                table: "account_opening_balances",
                columns: new[] { "AccountId", "OpeningDate" });

            migrationBuilder.CreateIndex(
                name: "IX_account_opening_balances_BranchId_OpeningDate",
                table: "account_opening_balances",
                columns: new[] { "BranchId", "OpeningDate" });

            migrationBuilder.CreateIndex(
                name: "IX_account_opening_balances_EnteredByStaffUserId",
                table: "account_opening_balances",
                column: "EnteredByStaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_chart_accounts_AccountType_IsActive",
                table: "chart_accounts",
                columns: new[] { "AccountType", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_chart_accounts_Code",
                table: "chart_accounts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_chart_accounts_ParentAccountId",
                table: "chart_accounts",
                column: "ParentAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_party_sectors_Code",
                table: "party_sectors",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_party_sectors_IsActive",
                table: "party_sectors",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_party_sectors_Name",
                table: "party_sectors",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_customers_party_sectors_PartySectorId",
                table: "customers",
                column: "PartySectorId",
                principalTable: "party_sectors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_customers_party_sectors_PartySectorId",
                table: "customers");

            migrationBuilder.DropTable(
                name: "account_opening_balances");

            migrationBuilder.DropTable(
                name: "party_sectors");

            migrationBuilder.DropTable(
                name: "chart_accounts");

            migrationBuilder.DropIndex(
                name: "IX_customers_PartySectorId",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "PartySectorId",
                table: "customers");
        }
    }
}
