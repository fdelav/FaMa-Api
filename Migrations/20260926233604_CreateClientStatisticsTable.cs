using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FaMaApi.Migrations
{
    /// <inheritdoc />
    public partial class CreateClientStatisticsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClientStatistics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PcId = table.Column<int>(type: "integer", nullable: false),
                    RamMean = table.Column<double>(type: "double precision", nullable: false),
                    RamMax = table.Column<double>(type: "double precision", nullable: false),
                    CpuMean = table.Column<double>(type: "double precision", nullable: false),
                    CpuMax = table.Column<double>(type: "double precision", nullable: false),
                    GpuMean = table.Column<double>(type: "double precision", nullable: false),
                    GpuMax = table.Column<double>(type: "double precision", nullable: false),
                    TempMean = table.Column<double>(type: "double precision", nullable: false),
                    TempMax = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientStatistics", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientStatistics");
        }
    }
}
