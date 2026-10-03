using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class SalesExecutiveAssignmentTargetConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "CK_sales_executive_assignment_single_target",
                table: "sales_executive_product_assignments",
                sql: "((ProductId IS NOT NULL AND CategoryId IS NULL) OR (ProductId IS NULL AND CategoryId IS NOT NULL))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_sales_executive_assignment_single_target",
                table: "sales_executive_product_assignments");
        }
    }
}
