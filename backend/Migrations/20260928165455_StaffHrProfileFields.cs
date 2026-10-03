using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class StaffHrProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppointmentType",
                table: "staff_users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BloodGroup",
                table: "staff_users",
                type: "varchar(10)",
                maxLength: 10,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CitizenshipNumber",
                table: "staff_users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "staff_users",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "staff_users",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DeviceEnrollmentId",
                table: "staff_users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "staff_users",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "staff_users",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmploymentStatus",
                table: "staff_users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "staff_users",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "staff_users",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MaritalStatus",
                table: "staff_users",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "MobileAccessEnabled",
                table: "staff_users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OfficialEmail",
                table: "staff_users",
                type: "varchar(240)",
                maxLength: 240,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                table: "staff_users",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "WebAccessEnabled",
                table: "staff_users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppointmentType",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "BloodGroup",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "CitizenshipNumber",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "Department",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "DeviceEnrollmentId",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "EmploymentStatus",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "MaritalStatus",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "MobileAccessEnabled",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "OfficialEmail",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "TaxNumber",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "WebAccessEnabled",
                table: "staff_users");
        }
    }
}
