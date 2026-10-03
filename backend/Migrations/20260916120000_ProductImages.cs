using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using backend.Data;

#nullable disable

namespace backend.Migrations;

[Migration("20260916120000_ProductImages")]
[DbContext(typeof(ApplicationDbContext))]
public partial class ProductImages : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "product_images",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", collation: "ascii_general_ci", nullable: false),
                ProductId = table.Column<Guid>(type: "char(36)", collation: "ascii_general_ci", nullable: false),
                Url = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                DisplayOrder = table.Column<int>(type: "int", nullable: false),
                AltText = table.Column<string>(type: "varchar(240)", maxLength: 240, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_product_images", x => x.Id);
                table.ForeignKey("FK_product_images_products_ProductId", x => x.ProductId, "products", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex("IX_product_images_ProductId_DisplayOrder", "product_images", new[] { "ProductId", "DisplayOrder" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "product_images");
}
