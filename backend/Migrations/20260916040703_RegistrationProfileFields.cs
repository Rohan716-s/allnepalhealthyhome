using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class RegistrationProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "customers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "customers",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "customers",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactPersonName",
                table: "pharmacy_details",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Landmark",
                table: "pharmacy_details",
                type: "varchar(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PharmacistRegistrationNumber",
                table: "pharmacy_details",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PreferredBranchId",
                table: "pharmacy_details",
                type: "char(36)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Telephone",
                table: "pharmacy_details",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_customers_Username",
                table: "customers",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_customers_Username",
                table: "customers");

            migrationBuilder.DropColumn(name: "DateOfBirth", table: "customers");
            migrationBuilder.DropColumn(name: "Gender", table: "customers");
            migrationBuilder.DropColumn(name: "Username", table: "customers");
            migrationBuilder.DropColumn(name: "ContactPersonName", table: "pharmacy_details");
            migrationBuilder.DropColumn(name: "Landmark", table: "pharmacy_details");
            migrationBuilder.DropColumn(name: "PharmacistRegistrationNumber", table: "pharmacy_details");
            migrationBuilder.DropColumn(name: "PreferredBranchId", table: "pharmacy_details");
            migrationBuilder.DropColumn(name: "Telephone", table: "pharmacy_details");
        }
    }
}
