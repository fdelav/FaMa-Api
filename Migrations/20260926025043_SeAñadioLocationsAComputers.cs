using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaMaApi.Migrations
{
    /// <inheritdoc />
    public partial class SeAñadioLocationsAComputers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "ClientComputers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Location",
                table: "ClientComputers");
        }
    }
}
