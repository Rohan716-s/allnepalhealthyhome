using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class BranchScopedFinance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "supplier_invoices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "journal_entries",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "business_expenses",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "bank_reconciliations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_invoices_BranchId",
                table: "supplier_invoices",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_BranchId",
                table: "journal_entries",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_business_expenses_BranchId",
                table: "business_expenses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_BranchId",
                table: "bank_reconciliations",
                column: "BranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_bank_reconciliations_branches_BranchId",
                table: "bank_reconciliations",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_business_expenses_branches_BranchId",
                table: "business_expenses",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_journal_entries_branches_BranchId",
                table: "journal_entries",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_supplier_invoices_branches_BranchId",
                table: "supplier_invoices",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bank_reconciliations_branches_BranchId",
                table: "bank_reconciliations");

            migrationBuilder.DropForeignKey(
                name: "FK_business_expenses_branches_BranchId",
                table: "business_expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_journal_entries_branches_BranchId",
                table: "journal_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_supplier_invoices_branches_BranchId",
                table: "supplier_invoices");

            migrationBuilder.DropIndex(
                name: "IX_supplier_invoices_BranchId",
                table: "supplier_invoices");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_BranchId",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_business_expenses_BranchId",
                table: "business_expenses");

            migrationBuilder.DropIndex(
                name: "IX_bank_reconciliations_BranchId",
                table: "bank_reconciliations");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "supplier_invoices");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "business_expenses");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "bank_reconciliations");
        }
    }
}
