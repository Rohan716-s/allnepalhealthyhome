using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class PharmacyPhaseTwoInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                table: "inventory",
                type: "varchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiryDate",
                table: "inventory",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinimumStock",
                table: "inventory",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "PurchasePrice",
                table: "inventory",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Supplier",
                table: "inventory",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_BatchNumber",
                table: "inventory",
                column: "BatchNumber");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_ExpiryDate",
                table: "inventory",
                column: "ExpiryDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_inventory_BatchNumber",
                table: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_inventory_ExpiryDate",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "MinimumStock",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "PurchasePrice",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "Supplier",
                table: "inventory");
        }
    }
}
