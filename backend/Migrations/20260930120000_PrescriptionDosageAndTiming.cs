using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260930120000_PrescriptionDosageAndTiming")]
public partial class PrescriptionDosageAndTiming : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "Dosage", table: "prescription_extracted_items", type: "varchar(160)", maxLength: 160, nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>(name: "Timing", table: "prescription_extracted_items", type: "varchar(160)", maxLength: 160, nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "Dosage", table: "prescription_extracted_items");
        migrationBuilder.DropColumn(name: "Timing", table: "prescription_extracted_items");
    }
}
