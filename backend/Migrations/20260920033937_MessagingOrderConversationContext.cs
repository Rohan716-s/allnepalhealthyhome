using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class MessagingOrderConversationContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OrderId",
                table: "message_conversations",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_message_conversations_OrderId",
                table: "message_conversations",
                column: "OrderId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_message_conversations_pharmacy_orders_OrderId",
                table: "message_conversations",
                column: "OrderId",
                principalTable: "pharmacy_orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_message_conversations_pharmacy_orders_OrderId",
                table: "message_conversations");

            migrationBuilder.DropIndex(
                name: "IX_message_conversations_OrderId",
                table: "message_conversations");

            migrationBuilder.DropColumn(
                name: "OrderId",
                table: "message_conversations");
        }
    }
}
