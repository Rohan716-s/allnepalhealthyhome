using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

public partial class HotDealProducts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsHotDeal",
            table: "products",
            type: "tinyint(1)",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateIndex(
            name: "IX_products_IsHotDeal",
            table: "products",
            column: "IsHotDeal");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_products_IsHotDeal", table: "products");
        migrationBuilder.DropColumn(name: "IsHotDeal", table: "products");
    }
}
