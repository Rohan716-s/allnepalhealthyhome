using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InventoryDepartmentFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MySQL may be using the existing product/branch index to satisfy the
            // product foreign key. Create the replacement first so the old index
            // can then be removed without temporarily leaving that FK unindexed.
            migrationBuilder.CreateIndex(
                name: "IX_inventory_ProductId_BranchId_BatchNumber",
                table: "inventory",
                columns: new[] { "ProductId", "BranchId", "BatchNumber" },
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_inventory_ProductId_BranchId",
                table: "inventory");

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "stock_transactions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "stock_transactions",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceId",
                table: "stock_transactions",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceType",
                table: "stock_transactions",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "stock_transactions",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "MaximumStock",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "products",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PurchaseUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "PurchaseUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReorderLevel",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SalesUnit",
                table: "products",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "SalesUnitToBase",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "StorageLocation",
                table: "products",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BatchStatus",
                table: "inventory",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "BonusQuantity",
                table: "inventory",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ManufacturingDate",
                table: "inventory",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Mrp",
                table: "inventory",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseOrderId",
                table: "inventory",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "PurchaseReference",
                table: "inventory",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "SellingPrice",
                table: "inventory",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "inventory",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "inventory_transfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TransferNumber = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SourceBranchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TargetBranchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DispatchedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DispatchedByStaffId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    ReceivedByStaffId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_transfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inventory_transfers_branches_SourceBranchId",
                        column: x => x.SourceBranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transfers_branches_TargetBranchId",
                        column: x => x.TargetBranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transfers_staff_users_DispatchedByStaffId",
                        column: x => x.DispatchedByStaffId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_inventory_transfers_staff_users_ReceivedByStaffId",
                        column: x => x.ReceivedByStaffId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "product_units",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProductId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UnitName = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MultiplierToBase = table.Column<int>(type: "int", nullable: false),
                    IsPurchaseUnit = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsSalesUnit = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_units", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_units_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "stock_counts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CountNumber = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BranchId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Scope = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CategoryFilter = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LocationFilter = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FinalizedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    FinalizedByStaffId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_counts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_counts_branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_counts_staff_users_FinalizedByStaffId",
                        column: x => x.FinalizedByStaffId,
                        principalTable: "staff_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "inventory_transfer_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    InventoryTransferId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SourceInventoryId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProductId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BatchNumber = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    ReceivedQuantity = table.Column<int>(type: "int", nullable: false),
                    PurchasePrice = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_transfer_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inventory_transfer_items_inventory_SourceInventoryId",
                        column: x => x.SourceInventoryId,
                        principalTable: "inventory",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_transfer_items_inventory_transfers_InventoryTransf~",
                        column: x => x.InventoryTransferId,
                        principalTable: "inventory_transfers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_transfer_items_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "stock_count_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    StockCountId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    InventoryId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SystemQuantity = table.Column<int>(type: "int", nullable: false),
                    PhysicalQuantity = table.Column<int>(type: "int", nullable: true),
                    Variance = table.Column<int>(type: "int", nullable: false),
                    VarianceValue = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_count_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_count_lines_inventory_InventoryId",
                        column: x => x.InventoryId,
                        principalTable: "inventory",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_count_lines_stock_counts_StockCountId",
                        column: x => x.StockCountId,
                        principalTable: "stock_counts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_BranchId_Type_CreatedAt",
                table: "stock_transactions",
                columns: new[] { "BranchId", "Type", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_ReferenceType_ReferenceId",
                table: "stock_transactions",
                columns: new[] { "ReferenceType", "ReferenceId" });

            migrationBuilder.CreateIndex(
                name: "IX_products_ReorderLevel",
                table: "products",
                column: "ReorderLevel");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_BranchId_BatchStatus_ExpiryDate",
                table: "inventory",
                columns: new[] { "BranchId", "BatchStatus", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_inventory_PurchaseOrderId",
                table: "inventory",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_SupplierId",
                table: "inventory",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfer_items_InventoryTransferId_ProductId_Batch~",
                table: "inventory_transfer_items",
                columns: new[] { "InventoryTransferId", "ProductId", "BatchNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfer_items_ProductId",
                table: "inventory_transfer_items",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfer_items_SourceInventoryId",
                table: "inventory_transfer_items",
                column: "SourceInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_DispatchedByStaffId",
                table: "inventory_transfers",
                column: "DispatchedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_ReceivedByStaffId",
                table: "inventory_transfers",
                column: "ReceivedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_SourceBranchId",
                table: "inventory_transfers",
                column: "SourceBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_Status_CreatedAt",
                table: "inventory_transfers",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_TargetBranchId",
                table: "inventory_transfers",
                column: "TargetBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_transfers_TransferNumber",
                table: "inventory_transfers",
                column: "TransferNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_units_ProductId_UnitName",
                table: "product_units",
                columns: new[] { "ProductId", "UnitName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_count_lines_InventoryId",
                table: "stock_count_lines",
                column: "InventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_count_lines_StockCountId_InventoryId",
                table: "stock_count_lines",
                columns: new[] { "StockCountId", "InventoryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_counts_BranchId_Status_CreatedAt",
                table: "stock_counts",
                columns: new[] { "BranchId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_counts_CountNumber",
                table: "stock_counts",
                column: "CountNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_counts_FinalizedByStaffId",
                table: "stock_counts",
                column: "FinalizedByStaffId");

            migrationBuilder.AddForeignKey(
                name: "FK_inventory_purchase_orders_PurchaseOrderId",
                table: "inventory",
                column: "PurchaseOrderId",
                principalTable: "purchase_orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_inventory_suppliers_SupplierId",
                table: "inventory",
                column: "SupplierId",
                principalTable: "suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_inventory_purchase_orders_PurchaseOrderId",
                table: "inventory");

            migrationBuilder.DropForeignKey(
                name: "FK_inventory_suppliers_SupplierId",
                table: "inventory");

            migrationBuilder.DropTable(
                name: "inventory_transfer_items");

            migrationBuilder.DropTable(
                name: "product_units");

            migrationBuilder.DropTable(
                name: "stock_count_lines");

            migrationBuilder.DropTable(
                name: "inventory_transfers");

            migrationBuilder.DropTable(
                name: "stock_counts");

            migrationBuilder.DropIndex(
                name: "IX_stock_transactions_BranchId_Type_CreatedAt",
                table: "stock_transactions");

            migrationBuilder.DropIndex(
                name: "IX_stock_transactions_ReferenceType_ReferenceId",
                table: "stock_transactions");

            migrationBuilder.DropIndex(
                name: "IX_products_ReorderLevel",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_inventory_BranchId_BatchStatus_ExpiryDate",
                table: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_inventory_ProductId_BranchId_BatchNumber",
                table: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_inventory_PurchaseOrderId",
                table: "inventory");

            migrationBuilder.DropIndex(
                name: "IX_inventory_SupplierId",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "ReferenceId",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "ReferenceType",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "Unit",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "BaseUnit",
                table: "products");

            migrationBuilder.DropColumn(
                name: "MaximumStock",
                table: "products");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PurchaseUnit",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PurchaseUnitToBase",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ReorderLevel",
                table: "products");

            migrationBuilder.DropColumn(
                name: "SalesUnit",
                table: "products");

            migrationBuilder.DropColumn(
                name: "SalesUnitToBase",
                table: "products");

            migrationBuilder.DropColumn(
                name: "StorageLocation",
                table: "products");

            migrationBuilder.DropColumn(
                name: "BatchStatus",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "BonusQuantity",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "ManufacturingDate",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "Mrp",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderId",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "PurchaseReference",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "SellingPrice",
                table: "inventory");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "inventory");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_BranchId",
                table: "inventory",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_ProductId_BranchId",
                table: "inventory",
                columns: new[] { "ProductId", "BranchId" },
                unique: true);
        }
    }
}
