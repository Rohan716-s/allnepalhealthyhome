using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class RoleSidebarMenu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "role_sidebar_menu_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", collation: "ascii_general_ci", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Role = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false),
                    Href = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: false),
                    Icon = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    IsVisible = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_role_sidebar_menu_items", x => x.Id));
            migrationBuilder.CreateIndex("IX_role_sidebar_menu_items_Role_DisplayOrder", "role_sidebar_menu_items", new[] { "Role", "DisplayOrder" }, unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "role_sidebar_menu_items");
        }
    }
}
