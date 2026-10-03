using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryTimeSlots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DeliverySlotId",
                table: "pharmacy_orders",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "delivery_slots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Label = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StartTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EndTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BranchId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    MaxOrders = table.Column<int>(type: "int", nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    Enabled = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_slots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_delivery_slots_branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_orders_DeliverySlotId",
                table: "pharmacy_orders",
                column: "DeliverySlotId");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_slots_BranchId_DisplayOrder_Enabled",
                table: "delivery_slots",
                columns: new[] { "BranchId", "DisplayOrder", "Enabled" });

            migrationBuilder.AddForeignKey(
                name: "FK_pharmacy_orders_delivery_slots_DeliverySlotId",
                table: "pharmacy_orders",
                column: "DeliverySlotId",
                principalTable: "delivery_slots",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pharmacy_orders_delivery_slots_DeliverySlotId",
                table: "pharmacy_orders");

            migrationBuilder.DropTable(
                name: "delivery_slots");

            migrationBuilder.DropIndex(
                name: "IX_pharmacy_orders_DeliverySlotId",
                table: "pharmacy_orders");

            migrationBuilder.DropColumn(
                name: "DeliverySlotId",
                table: "pharmacy_orders");
        }
    }
}
