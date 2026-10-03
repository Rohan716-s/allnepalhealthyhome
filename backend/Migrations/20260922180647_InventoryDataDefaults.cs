using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InventoryDataDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "SalesUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "SalesUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "piece",
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<int>(
                name: "ReorderLevel",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 5,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "PurchaseUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "PurchaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "piece",
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "BaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "piece",
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Unit",
                table: "order_items",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "base",
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "BatchStatus",
                table: "inventory",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "ACTIVE",
                oldClrType: typeof(string),
                oldType: "varchar(30)",
                oldMaxLength: 30)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            // Existing rows were created before the inventory department fields
            // existed, so normalize their values as part of the same migration.
            migrationBuilder.Sql("UPDATE products SET BaseUnit = 'piece' WHERE BaseUnit IS NULL OR BaseUnit = '';");
            migrationBuilder.Sql("UPDATE products SET PurchaseUnit = 'piece' WHERE PurchaseUnit IS NULL OR PurchaseUnit = '';");
            migrationBuilder.Sql("UPDATE products SET SalesUnit = 'piece' WHERE SalesUnit IS NULL OR SalesUnit = '';");
            migrationBuilder.Sql("UPDATE products SET PurchaseUnitToBase = 1 WHERE PurchaseUnitToBase <= 0;");
            migrationBuilder.Sql("UPDATE products SET SalesUnitToBase = 1 WHERE SalesUnitToBase <= 0;");
            migrationBuilder.Sql("UPDATE products SET ReorderLevel = 5 WHERE ReorderLevel <= 0;");
            migrationBuilder.Sql("UPDATE inventory SET BatchStatus = 'ACTIVE' WHERE BatchStatus IS NULL OR BatchStatus = '';");
            migrationBuilder.Sql("UPDATE stock_transactions SET Unit = 'base' WHERE Unit IS NULL OR Unit = '';");
            migrationBuilder.Sql("UPDATE order_items SET Unit = 'base' WHERE Unit IS NULL OR Unit = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "SalesUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 1);

            migrationBuilder.AlterColumn<string>(
                name: "SalesUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldDefaultValue: "piece")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<int>(
                name: "ReorderLevel",
                table: "products",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 5);

            migrationBuilder.AlterColumn<int>(
                name: "PurchaseUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 1);

            migrationBuilder.AlterColumn<string>(
                name: "PurchaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldDefaultValue: "piece")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "BaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldDefaultValue: "piece")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Unit",
                table: "order_items",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldDefaultValue: "base")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "BatchStatus",
                table: "inventory",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(30)",
                oldMaxLength: 30,
                oldDefaultValue: "ACTIVE")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
