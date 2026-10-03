using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class HrmsLocationShiftsAndCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShiftId",
                table: "staff_users",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<int>(
                name: "AttendanceRadiusMeters",
                table: "branches",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "LocationRequired",
                table: "branches",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckInAccuracy",
                table: "attendance_records",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckInLatitude",
                table: "attendance_records",
                type: "decimal(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckInLocationSource",
                table: "attendance_records",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CheckInLocationStatus",
                table: "attendance_records",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckInLocationTimestampUtc",
                table: "attendance_records",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckInLongitude",
                table: "attendance_records",
                type: "decimal(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckOutAccuracy",
                table: "attendance_records",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckOutLatitude",
                table: "attendance_records",
                type: "decimal(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckOutLocationSource",
                table: "attendance_records",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CheckOutLocationStatus",
                table: "attendance_records",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckOutLocationTimestampUtc",
                table: "attendance_records",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckOutLongitude",
                table: "attendance_records",
                type: "decimal(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LateMinutes",
                table: "attendance_records",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ShiftId",
                table: "attendance_records",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "attendance_corrections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StaffUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkDate = table.Column<DateTime>(type: "date", nullable: false),
                    RequestedCheckInUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    RequestedCheckOutUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReviewedByStaffUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReviewedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewComment = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_corrections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_attendance_corrections_staff_users_ReviewedByStaffUserId",
                        column: x => x.ReviewedByStaffUserId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_attendance_corrections_staff_users_StaffUserId",
                        column: x => x.StaffUserId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "attendance_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LateCheckInGraceMinutes = table.Column<int>(type: "int", nullable: false),
                    EarlyCheckInGraceMinutes = table.Column<int>(type: "int", nullable: false),
                    EarlyCheckOutGraceMinutes = table.Column<int>(type: "int", nullable: false),
                    LateCheckOutGraceMinutes = table.Column<int>(type: "int", nullable: false),
                    DefaultRadiusMeters = table.Column<int>(type: "int", nullable: false),
                    LocationRequired = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    BusinessTimeZone = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UpdatedByStaffUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_settings", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "work_shifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ShiftType = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StartTime = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    BreakDurationMinutes = table.Column<int>(type: "int", nullable: false),
                    GracePeriodMinutes = table.Column<int>(type: "int", nullable: false),
                    MinimumWorkingMinutes = table.Column<int>(type: "int", nullable: false),
                    LateThresholdMinutes = table.Column<int>(type: "int", nullable: false),
                    HalfDayThresholdMinutes = table.Column<int>(type: "int", nullable: false),
                    OvertimeThresholdMinutes = table.Column<int>(type: "int", nullable: false),
                    WeeklyOffDays = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_shifts", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_staff_users_ShiftId",
                table: "staff_users",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_ShiftId",
                table: "attendance_records",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_corrections_ReviewedByStaffUserId",
                table: "attendance_corrections",
                column: "ReviewedByStaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_corrections_StaffUserId_WorkDate_Status",
                table: "attendance_corrections",
                columns: new[] { "StaffUserId", "WorkDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_settings_Id",
                table: "attendance_settings",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_shifts_Name",
                table: "work_shifts",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_records_work_shifts_ShiftId",
                table: "attendance_records",
                column: "ShiftId",
                principalTable: "work_shifts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_staff_users_work_shifts_ShiftId",
                table: "staff_users",
                column: "ShiftId",
                principalTable: "work_shifts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_attendance_records_work_shifts_ShiftId",
                table: "attendance_records");

            migrationBuilder.DropForeignKey(
                name: "FK_staff_users_work_shifts_ShiftId",
                table: "staff_users");

            migrationBuilder.DropTable(
                name: "attendance_corrections");

            migrationBuilder.DropTable(
                name: "attendance_settings");

            migrationBuilder.DropTable(
                name: "work_shifts");

            migrationBuilder.DropIndex(
                name: "IX_staff_users_ShiftId",
                table: "staff_users");

            migrationBuilder.DropIndex(
                name: "IX_attendance_records_ShiftId",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "ShiftId",
                table: "staff_users");

            migrationBuilder.DropColumn(
                name: "AttendanceRadiusMeters",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "LocationRequired",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "CheckInAccuracy",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckInLatitude",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckInLocationSource",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckInLocationStatus",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckInLocationTimestampUtc",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckInLongitude",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutAccuracy",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutLatitude",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutLocationSource",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutLocationStatus",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutLocationTimestampUtc",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "CheckOutLongitude",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "LateMinutes",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "ShiftId",
                table: "attendance_records");
        }
    }
}
