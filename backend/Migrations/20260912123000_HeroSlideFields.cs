using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using backend.Data;

#nullable disable

namespace backend.Migrations;

[Migration("20260912123000_HeroSlideFields")]
[DbContext(typeof(ApplicationDbContext))]
public partial class HeroSlideFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "SecondaryButtonText", table: "website_assets", type: "varchar(100)", maxLength: 100, nullable: true).Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "SecondaryButtonUrl", table: "website_assets", type: "varchar(500)", maxLength: 500, nullable: true).Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<int>(name: "OverlayOpacity", table: "website_assets", type: "int", nullable: false, defaultValue: 35);
        migrationBuilder.AddColumn<string>(name: "TextAlignment", table: "website_assets", type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "LEFT").Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "ContentPosition", table: "website_assets", type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "CENTER").Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "BackgroundPosition", table: "website_assets", type: "varchar(40)", maxLength: 40, nullable: false, defaultValue: "CENTER").Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "CustomLabel", table: "website_assets", type: "varchar(100)", maxLength: 100, nullable: true).Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "AnimationType", table: "website_assets", type: "varchar(30)", maxLength: 30, nullable: false, defaultValue: "FADE_ZOOM").Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<int>(name: "SlideDuration", table: "website_assets", type: "int", nullable: false, defaultValue: 5000);
        migrationBuilder.AddColumn<int>(name: "TransitionDuration", table: "website_assets", type: "int", nullable: false, defaultValue: 700);
        migrationBuilder.AddColumn<bool>(name: "AutoplayEnabled", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "PauseOnHover", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "ShowNavigationArrows", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "ShowPaginationDots", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "LoopSlides", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "RandomizeSlides", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<bool>(name: "RespectSchedule", table: "website_assets", type: "tinyint(1)", nullable: false, defaultValue: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var column in new[] { "SecondaryButtonText", "SecondaryButtonUrl", "OverlayOpacity", "TextAlignment", "ContentPosition", "BackgroundPosition", "CustomLabel", "AnimationType", "SlideDuration", "TransitionDuration", "AutoplayEnabled", "PauseOnHover", "ShowNavigationArrows", "ShowPaginationDots", "LoopSlides", "RandomizeSlides", "RespectSchedule" }) migrationBuilder.DropColumn(name: column, table: "website_assets");
    }
}
