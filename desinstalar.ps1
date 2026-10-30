<#
.SYNOPSIS
    Detiene y elimina el Servicio de Windows de FaMaAPI. (Requiere Administrador).

.PARAMETER ConservarDatos
    No borra la carpeta C:\FaMa\api (mantiene logs y appsettings.Production.json).
#>
[CmdletBinding()]
param(
    [switch]$ConservarDatos
)

$ErrorActionPreference = 'Stop'

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    throw "Se requieren permisos de Administrador para detener y eliminar el Servicio de Windows."
}

$nombreServicio = 'FaMaApi'
$destino = 'C:\FaMa\api'

Write-Host "Deteniendo servicio..." -ForegroundColor Cyan
if (Get-Service -Name $nombreServicio -ErrorAction SilentlyContinue) {
    Stop-Service -Name $nombreServicio -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    Write-Host "Eliminando registro del servicio..." -ForegroundColor Cyan
    sc.exe delete $nombreServicio | Out-Null
}

if (-not $ConservarDatos -and (Test-Path $destino)) {
    Write-Host "Eliminando archivos en $destino..." -ForegroundColor Cyan
    Remove-Item -Path $destino -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "FaMaAPI desinstalado correctamente." -ForegroundColor Green
if ($ConservarDatos) { Write-Host "Se conservaron los archivos en $destino" }