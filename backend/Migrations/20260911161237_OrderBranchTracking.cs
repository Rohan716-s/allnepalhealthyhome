using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class OrderBranchTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "pharmacy_orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_orders_BranchId",
                table: "pharmacy_orders",
                column: "BranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_pharmacy_orders_branches_BranchId",
                table: "pharmacy_orders",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pharmacy_orders_branches_BranchId",
                table: "pharmacy_orders");

            migrationBuilder.DropIndex(
                name: "IX_pharmacy_orders_BranchId",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "pharmacy_orders");
        }
    }
}
