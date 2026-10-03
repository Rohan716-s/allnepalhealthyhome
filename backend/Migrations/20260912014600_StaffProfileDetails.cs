using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class StaffProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "staff_users",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmployeeId",
                table: "staff_users",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "JoiningDate",
                table: "staff_users",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfilePhotoContentType",
                table: "staff_users",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ProfilePhotoStoredFileName",
                table: "staff_users",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_staff_users_EmployeeId",
                table: "staff_users",
                column: "EmployeeId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_staff_users_EmployeeId",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "JoiningDate",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "ProfilePhotoContentType",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "ProfilePhotoStoredFileName",
                table: "staff_users");
        }
    }
}
