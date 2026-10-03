using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ProductCatalogMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompanyCode",
                table: "products",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "products",
                type: "varchar(240)",
                maxLength: 240,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DemandBasis",
                table: "products",
                type: "varchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "NO_HISTORY")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "DemandMeasuredAt",
                table: "products",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DemandScore",
                table: "products",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DemandSourceReference",
                table: "products",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DemandSourceUrl",
                table: "products",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ImageSourceReference",
                table: "products",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ImageSourceUrl",
                table: "products",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ImageVerificationStatus",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "MISSING")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ImportStatus",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "MANUAL")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MissingImageStatus",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "MISSING")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_products_CompanyCode_CompanyName",
                table: "products",
                columns: new[] { "CompanyCode", "CompanyName" });

            migrationBuilder.CreateIndex(
                name: "IX_products_IsActive_DemandScore_DisplayOrder",
                table: "products",
                columns: new[] { "IsActive", "DemandScore", "DisplayOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_products_CompanyCode_CompanyName",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_IsActive_DemandScore_DisplayOrder",
                table: "products");

            migrationBuilder.DropColumn(
                name: "CompanyCode",
                table: "products");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DemandBasis",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DemandMeasuredAt",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DemandScore",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DemandSourceReference",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DemandSourceUrl",
                table: "products");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ImageSourceReference",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ImageSourceUrl",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ImageVerificationStatus",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ImportStatus",
                table: "products");

            migrationBuilder.DropColumn(
                name: "MissingImageStatus",
                table: "products");
        }
    }
}
