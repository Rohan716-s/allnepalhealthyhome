using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using backend.Data;

#nullable disable

namespace backend.Migrations;

[Migration("20260916122500_RoleSidebarMenuTableFix")]
[DbContext(typeof(ApplicationDbContext))]
public partial class RoleSidebarMenuTableFix : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS `role_sidebar_menu_items` (
                `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NOT NULL,
                `Role` varchar(40) NOT NULL,
                `Label` varchar(120) NOT NULL,
                `Href` varchar(300) NOT NULL,
                `Icon` varchar(50) NOT NULL,
                `DisplayOrder` int NOT NULL,
                `IsVisible` tinyint(1) NOT NULL,
                CONSTRAINT `PK_role_sidebar_menu_items` PRIMARY KEY (`Id`),
                UNIQUE KEY `IX_role_sidebar_menu_items_Role_DisplayOrder` (`Role`, `DisplayOrder`)
            ) CHARACTER SET=utf8mb4;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("DROP TABLE IF EXISTS `role_sidebar_menu_items`;");
}
