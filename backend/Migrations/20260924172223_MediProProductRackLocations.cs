using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class MediProProductRackLocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RackId",
                table: "products",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "product_rack_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_rack_groups", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "product_racks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RackGroupId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_racks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_racks_product_rack_groups_RackGroupId",
                        column: x => x.RackGroupId,
                        principalTable: "product_rack_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_products_RackId",
                table: "products",
                column: "RackId");

            migrationBuilder.CreateIndex(
                name: "IX_product_rack_groups_IsActive_Name",
                table: "product_rack_groups",
                columns: new[] { "IsActive", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_product_rack_groups_Name",
                table: "product_rack_groups",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_racks_IsActive_RackGroupId_Name",
                table: "product_racks",
                columns: new[] { "IsActive", "RackGroupId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_product_racks_RackGroupId_Name",
                table: "product_racks",
                columns: new[] { "RackGroupId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_products_product_racks_RackId",
                table: "products",
                column: "RackId",
                principalTable: "product_racks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_products_product_racks_RackId",
                table: "products");

            migrationBuilder.DropTable(
                name: "product_racks");

            migrationBuilder.DropTable(
                name: "product_rack_groups");

            migrationBuilder.DropIndex(
                name: "IX_products_RackId",
                table: "products");

            migrationBuilder.DropColumn(
                name: "RackId",
                table: "products");
        }
    }
}
