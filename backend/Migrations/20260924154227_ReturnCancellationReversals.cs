using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ReturnCancellationReversals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CashRefundAmount",
                table: "sale_returns",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CreditReliefAmount",
                table: "sale_returns",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "RefundMethod",
                table: "sale_returns",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierInvoiceId",
                table: "purchase_returns",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_returns_SupplierInvoiceId",
                table: "purchase_returns",
                column: "SupplierInvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_returns_supplier_invoices_SupplierInvoiceId",
                table: "purchase_returns",
                column: "SupplierInvoiceId",
                principalTable: "supplier_invoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_purchase_returns_supplier_invoices_SupplierInvoiceId",
                table: "purchase_returns");

            migrationBuilder.DropIndex(
                name: "IX_purchase_returns_SupplierInvoiceId",
                table: "purchase_returns");

            migrationBuilder.DropColumn(
                name: "CashRefundAmount",
                table: "sale_returns");

            migrationBuilder.DropColumn(
                name: "CreditReliefAmount",
                table: "sale_returns");

            migrationBuilder.DropColumn(
                name: "RefundMethod",
                table: "sale_returns");

            migrationBuilder.DropColumn(
                name: "SupplierInvoiceId",
                table: "purchase_returns");
        }
    }
}
