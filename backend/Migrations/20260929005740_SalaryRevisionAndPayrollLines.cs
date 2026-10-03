using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class SalaryRevisionAndPayrollLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CurrentBasicSalary",
                table: "staff_users",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAtUtc",
                table: "payroll_records",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByStaffUserId",
                table: "payroll_records",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "payroll_records",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PaymentNotes",
                table: "payroll_records",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PaymentReference",
                table: "payroll_records",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "payroll_component_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PayrollRecordId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ComponentName = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ComponentKind = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_component_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payroll_component_lines_payroll_records_PayrollRecordId",
                        column: x => x.PayrollRecordId,
                        principalTable: "payroll_records",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "salary_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StaffUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Title = table.Column<string>(type: "varchar(180)", maxLength: 180, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RevisionType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EffectiveDate = table.Column<DateTime>(type: "date", nullable: false),
                    PreviousBasicSalary = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    RevisedBasicSalary = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AttachmentUrl = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DecidedByStaffUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    DecidedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DecisionComment = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salary_revisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_salary_revisions_staff_users_DecidedByStaffUserId",
                        column: x => x.DecidedByStaffUserId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_salary_revisions_staff_users_StaffUserId",
                        column: x => x.StaffUserId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_records_ApprovedByStaffUserId",
                table: "payroll_records",
                column: "ApprovedByStaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_component_lines_PayrollRecordId_DisplayOrder",
                table: "payroll_component_lines",
                columns: new[] { "PayrollRecordId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_salary_revisions_DecidedByStaffUserId",
                table: "salary_revisions",
                column: "DecidedByStaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_salary_revisions_StaffUserId_EffectiveDate_Status",
                table: "salary_revisions",
                columns: new[] { "StaffUserId", "EffectiveDate", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_records_staff_users_ApprovedByStaffUserId",
                table: "payroll_records",
                column: "ApprovedByStaffUserId",
                principalTable: "staff_users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_payroll_records_staff_users_ApprovedByStaffUserId",
                table: "payroll_records");

            migrationBuilder.DropTable(
                name: "payroll_component_lines");

            migrationBuilder.DropTable(
                name: "salary_revisions");

            migrationBuilder.DropIndex(
                name: "IX_payroll_records_ApprovedByStaffUserId",
                table: "payroll_records");

            migrationBuilder.DropColumn(
                name: "CurrentBasicSalary",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "ApprovedAtUtc",
                table: "payroll_records");

            migrationBuilder.DropColumn(
                name: "ApprovedByStaffUserId",
                table: "payroll_records");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "payroll_records");

            migrationBuilder.DropColumn(
                name: "PaymentNotes",
                table: "payroll_records");

            migrationBuilder.DropColumn(
                name: "PaymentReference",
                table: "payroll_records");
        }
    }
}
