using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaMaApi.Migrations
{
    /// <inheritdoc />
    public partial class SeparateComputerHealthAndStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ComputerHealth",
                table: "ClientStatistics",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ComputerHealth",
                table: "ClientStatistics");
        }
    }
}
