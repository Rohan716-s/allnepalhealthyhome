using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class HeroTypewriterVariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackgroundColor",
                table: "website_assets",
                type: "varchar(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#F8F6F1")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LayoutVariant",
                table: "website_assets",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "STANDARD")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "TypingSpeedMs",
                table: "website_assets",
                type: "int",
                nullable: false,
                defaultValue: 52);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackgroundColor",
                table: "website_assets");

            migrationBuilder.DropColumn(
                name: "LayoutVariant",
                table: "website_assets");

            migrationBuilder.DropColumn(
                name: "TypingSpeedMs",
                table: "website_assets");
        }
    }
}
