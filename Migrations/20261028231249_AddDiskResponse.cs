using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FaMaApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDiskResponse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Disk",
                table: "StatusReports",
                newName: "DiskResponseMs");

            migrationBuilder.RenameColumn(
                name: "DiskMean",
                table: "ClientStatistics",
                newName: "DiskResponseMsMean");

            migrationBuilder.RenameColumn(
                name: "DiskMax",
                table: "ClientStatistics",
                newName: "DiskResponseMsMax");

            migrationBuilder.AddColumn<float>(
                name: "DiskActivity",
                table: "StatusReports",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<double>(
                name: "DiskActivityMax",
                table: "ClientStatistics",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "DiskActivityMean",
                table: "ClientStatistics",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiskActivity",
                table: "StatusReports");

            migrationBuilder.DropColumn(
                name: "DiskActivityMax",
                table: "ClientStatistics");

            migrationBuilder.DropColumn(
                name: "DiskActivityMean",
                table: "ClientStatistics");

            migrationBuilder.RenameColumn(
                name: "DiskResponseMs",
                table: "StatusReports",
                newName: "Disk");

            migrationBuilder.RenameColumn(
                name: "DiskResponseMsMean",
                table: "ClientStatistics",
                newName: "DiskMean");

            migrationBuilder.RenameColumn(
                name: "DiskResponseMsMax",
                table: "ClientStatistics",
                newName: "DiskMax");
        }
    }
}
