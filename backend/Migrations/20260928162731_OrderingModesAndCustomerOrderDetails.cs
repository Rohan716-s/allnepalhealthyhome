using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class OrderingModesAndCustomerOrderDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerNotes",
                table: "pharmacy_orders",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OrderCustomerEmail",
                table: "pharmacy_orders",
                type: "varchar(240)",
                maxLength: 240,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OrderCustomerName",
                table: "pharmacy_orders",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OrderCustomerPhone",
                table: "pharmacy_orders",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OrderMode",
                table: "pharmacy_orders",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "SINGLE")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerNotes",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "OrderCustomerEmail",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "OrderCustomerName",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "OrderCustomerPhone",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "OrderMode",
                table: "pharmacy_orders");
        }
    }
}
