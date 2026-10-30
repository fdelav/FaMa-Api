<#
.SYNOPSIS
    Quita el Servicio de Windows de FaMaAPI. REQUIERE ADMINISTRADOR.

.PARAMETER BorrarDatos
    Borra también la carpeta C:\FaMa\api (incluyendo logs y appsettings.Production.json).
    Por defecto se conservan los datos de configuración y logs.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\desinstalar-admin.ps1
#>
[CmdletBinding()]
param(
    [switch]$BorrarDatos
)

$ErrorActionPreference = 'Stop'

$nombre = 'FaMaApi'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Este script necesita Administrador. Abre PowerShell con "Ejecutar como administrador" y vuelve a ejecutarlo.'
}

$programFiles = $env:ProgramFiles
if (-not $programFiles) { $programFiles = [Environment]::GetFolderPath('ProgramFiles') }

$destino = Join-Path $programFiles 'FaMa\api'

$servicio = Get-Service -Name $nombre -ErrorAction SilentlyContinue
if ($servicio) {
    if ($servicio.Status -ne 'Stopped') {
        Stop-Service -Name $nombre -Force
        $servicio.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
    }
    & sc.exe delete $nombre | Out-Null
}

Get-Process -Name 'FaMaAPI' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if ($BorrarDatos -and (Test-Path $destino)) {
    Remove-Item -Path $destino -Recurse -Force -ErrorAction SilentlyContinue
    $padre = Split-Path -Parent $destino
    if ((Test-Path $padre) -and -not (Get-ChildItem $padre -Force | Select-Object -First 1)) { 
        Remove-Item $padre -Force -ErrorAction SilentlyContinue 
    }
}

Write-Host 'Servicio FaMaAPI eliminado correctamente.' -ForegroundColor Green
if (-not $BorrarDatos -and (Test-Path $destino)) { 
    Write-Host "Se conservaron los archivos de configuración y logs en $destino (usa -BorrarDatos para quitarlos por completo)." 
}