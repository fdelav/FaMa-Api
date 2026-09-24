using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaMaApi.Migrations
{
    /// <inheritdoc />
    public partial class AñadirDatosEnrollClientComputer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReportApiKey",
                table: "ClientComputers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "usageCode",
                table: "ClientComputers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "usageCodeExpiration",
                table: "ClientComputers",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReportApiKey",
                table: "ClientComputers");

            migrationBuilder.DropColumn(
                name: "usageCode",
                table: "ClientComputers");

            migrationBuilder.DropColumn(
                name: "usageCodeExpiration",
                table: "ClientComputers");
        }
    }
}
