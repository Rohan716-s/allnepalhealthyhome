using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261006200000_ProductImageProvenance")]
public partial class ProductImageProvenance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "ImageSourceWebsite", table: "products", type: "varchar(240)", maxLength: 240, nullable: true);
        migrationBuilder.AddColumn<string>(name: "ImageSourcePageUrl", table: "products", type: "varchar(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "ImageSearchedAtUtc", table: "products", type: "datetime(6)", nullable: true);
        migrationBuilder.AddColumn<string>(name: "ImageMatchingNotes", table: "products", type: "varchar(2000)", maxLength: 2000, nullable: true);
        migrationBuilder.AddColumn<Guid>(name: "ImageMediaAssetId", table: "products", type: "char(36)", nullable: true);
        migrationBuilder.CreateIndex(name: "IX_products_ImageMediaAssetId", table: "products", column: "ImageMediaAssetId");

        migrationBuilder.AddColumn<string>(name: "SourceUrl", table: "product_images", type: "varchar(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddColumn<string>(name: "SourceWebsite", table: "product_images", type: "varchar(240)", maxLength: 240, nullable: true);
        migrationBuilder.AddColumn<string>(name: "SourcePageUrl", table: "product_images", type: "varchar(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddColumn<string>(name: "VerificationStatus", table: "product_images", type: "varchar(40)", maxLength: 40, nullable: false, defaultValue: "MISSING");
        migrationBuilder.AddColumn<DateTime>(name: "SearchedAtUtc", table: "product_images", type: "datetime(6)", nullable: true);
        migrationBuilder.AddColumn<string>(name: "MatchingNotes", table: "product_images", type: "varchar(2000)", maxLength: 2000, nullable: true);
        migrationBuilder.AddColumn<string>(name: "MissingImageStatus", table: "product_images", type: "varchar(40)", maxLength: 40, nullable: false, defaultValue: "MISSING");
        migrationBuilder.AddColumn<Guid>(name: "MediaAssetId", table: "product_images", type: "char(36)", nullable: true);
        migrationBuilder.CreateIndex(name: "IX_product_images_MediaAssetId", table: "product_images", column: "MediaAssetId");

        // Do not retain a placeholder gallery row once a product has a real primary image.
        migrationBuilder.Sql("DELETE pi FROM product_images pi INNER JOIN products p ON p.Id = pi.ProductId WHERE (pi.Url = '/catalog-placeholder.svg' OR pi.Url LIKE '%/catalog-placeholder.svg') AND p.ImageUrl IS NOT NULL AND p.ImageUrl <> '' AND p.ImageUrl <> '/catalog-placeholder.svg' AND p.ImageUrl NOT LIKE '%/catalog-placeholder.svg';");
        migrationBuilder.Sql("UPDATE products SET MissingImageStatus = 'NOT_MISSING' WHERE ImageUrl IS NOT NULL AND ImageUrl <> '' AND ImageUrl <> '/catalog-placeholder.svg' AND ImageUrl NOT LIKE '%/catalog-placeholder.svg';");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_products_ImageMediaAssetId", table: "products");
        migrationBuilder.DropColumn(name: "ImageSourceWebsite", table: "products");
        migrationBuilder.DropColumn(name: "ImageSourcePageUrl", table: "products");
        migrationBuilder.DropColumn(name: "ImageSearchedAtUtc", table: "products");
        migrationBuilder.DropColumn(name: "ImageMatchingNotes", table: "products");
        migrationBuilder.DropColumn(name: "ImageMediaAssetId", table: "products");
        migrationBuilder.DropIndex(name: "IX_product_images_MediaAssetId", table: "product_images");
        migrationBuilder.DropColumn(name: "SourceUrl", table: "product_images");
        migrationBuilder.DropColumn(name: "SourceWebsite", table: "product_images");
        migrationBuilder.DropColumn(name: "SourcePageUrl", table: "product_images");
        migrationBuilder.DropColumn(name: "VerificationStatus", table: "product_images");
        migrationBuilder.DropColumn(name: "SearchedAtUtc", table: "product_images");
        migrationBuilder.DropColumn(name: "MatchingNotes", table: "product_images");
        migrationBuilder.DropColumn(name: "MissingImageStatus", table: "product_images");
        migrationBuilder.DropColumn(name: "MediaAssetId", table: "product_images");
    }
}
