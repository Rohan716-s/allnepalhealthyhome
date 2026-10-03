using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InventoryUnitTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "purchase_order_items",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "base")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "UnitMultiplier",
                table: "purchase_order_items",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "order_items",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "base")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "UnitMultiplier",
                table: "order_items",
                type: "int",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Unit",
                table: "purchase_order_items");

            migrationBuilder.DropColumn(
                name: "UnitMultiplier",
                table: "purchase_order_items");

            migrationBuilder.DropColumn(
                name: "Unit",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "UnitMultiplier",
                table: "order_items");
        }
    }
}
