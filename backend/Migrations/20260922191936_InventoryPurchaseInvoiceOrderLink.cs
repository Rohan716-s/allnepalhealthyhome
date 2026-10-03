using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InventoryPurchaseInvoiceOrderLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseOrderId",
                table: "supplier_invoices",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_invoices_PurchaseOrderId",
                table: "supplier_invoices",
                column: "PurchaseOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_supplier_invoices_purchase_orders_PurchaseOrderId",
                table: "supplier_invoices",
                column: "PurchaseOrderId",
                principalTable: "purchase_orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_supplier_invoices_purchase_orders_PurchaseOrderId",
                table: "supplier_invoices");

            migrationBuilder.DropIndex(
                name: "IX_supplier_invoices_PurchaseOrderId",
                table: "supplier_invoices");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderId",
                table: "supplier_invoices");
        }
    }
}
