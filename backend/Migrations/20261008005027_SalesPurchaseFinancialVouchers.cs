using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class SalesPurchaseFinancialVouchers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "financial_vouchers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Number = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Type = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BranchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    VoucherDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Reference = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Narration = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DebitAccount = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreditAccount = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ChequeNumber = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BankName = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Payee = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    InvoiceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    SupplierInvoiceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    JournalEntryId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CustomerLedgerEntryId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CustomerPaymentId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    SupplierPaymentId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CreatedBy = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Revision = table.Column<int>(type: "int", nullable: false),
                    PostedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_financial_vouchers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_financial_vouchers_branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_financial_vouchers_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_financial_vouchers_supplier_invoices_SupplierInvoiceId",
                        column: x => x.SupplierInvoiceId,
                        principalTable: "supplier_invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_financial_vouchers_BranchId_VoucherDate",
                table: "financial_vouchers",
                columns: new[] { "BranchId", "VoucherDate" });

            migrationBuilder.CreateIndex(
                name: "IX_financial_vouchers_InvoiceId",
                table: "financial_vouchers",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_financial_vouchers_Number",
                table: "financial_vouchers",
                column: "Number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_vouchers_SupplierInvoiceId",
                table: "financial_vouchers",
                column: "SupplierInvoiceId");
            foreach (var definition in backend.Models.SalesPurchasePermissions.Definitions)
            {
                migrationBuilder.Sql($"INSERT INTO access_permissions (Id, `Key`, Description, `Group`, IsSystem, CreatedAt, UpdatedAt) SELECT UUID(), '{definition.Key}', '{definition.Description}', '{definition.Group}', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) WHERE NOT EXISTS (SELECT 1 FROM access_permissions WHERE `Key` = '{definition.Key}');");
            }
            foreach (var role in new[] { "ADMIN", "ACCOUNTANT", "SUPERVISOR", "SALES_EXECUTIVE", "SALES_MANAGER", "PURCHASE_INVENTORY_MANAGER" })
            {
                foreach (var permission in backend.Models.SalesPurchasePermissions.DefaultsFor(role))
                    migrationBuilder.Sql($"INSERT INTO access_role_permissions (Id, RoleId, PermissionId, CreatedAt, UpdatedAt) SELECT UUID(), r.Id, p.Id, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) FROM access_roles r JOIN access_permissions p ON p.`Key` = '{permission}' WHERE r.Name = '{role}' AND NOT EXISTS (SELECT 1 FROM access_role_permissions l WHERE l.RoleId = r.Id AND l.PermissionId = p.Id);");
            }

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "financial_vouchers");
        }
    }
}
