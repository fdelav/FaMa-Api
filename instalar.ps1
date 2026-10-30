<#
.SYNOPSIS
    Instala FaMaAPI como Servicio de Windows (Requiere permisos de Administrador).

.DESCRIPTION
    Copia los binarios a C:\FaMa\api, registra la aplicacion como un Servicio de Windows
    (FaMaApi) configurado con inicio automatico y lo inicia.
    Respeta appsettings.Production.json para no sobreescribir la conexion a la BD ni puertos.

.PARAMETER Origen
    Carpeta con el paquete publicado de la API. Por defecto, la carpeta del script.

.PARAMETER ConnectionString
    Cadena de conexion a PostgreSQL. Si se proporciona, se actualiza o crea 
    appsettings.Production.json sin tocar el appsettings.json base.

.PARAMETER Puerto
    Puerto en el que escuchara la API (ej. 5000 o 443).
#>
[CmdletBinding()]
param(
    [string]$Origen,
    [string]$ConnectionString,
    [int]$Puerto
)

$ErrorActionPreference = 'Stop'

# Verificar privilegios de Administrador
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    throw "Este script debe ejecutarse en una consola de PowerShell con privilegios de Administrador para poder registrar el Servicio de Windows."
}

# Resolver rutas
$aqui = $PSScriptRoot
if (-not $aqui -and $MyInvocation.MyCommand.Path) { $aqui = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $aqui) { $aqui = (Get-Location).Path }
if (-not $Origen) { $Origen = $aqui }

$nombreServicio = 'FaMaApi'
$nombreEjecutable = 'FaMaAPI.exe' # Ajusta si tu binario tiene otro nombre exacto
$destino = 'c:\fama\api'
$exeDestino = Join-Path $destino $nombreEjecutable

$exeOrigen = Join-Path $Origen $nombreEjecutable
if (-not (Test-Path $exeOrigen)) {
    throw "No se encuentra $exeOrigen. Asegurate de ejecutar esto desde la carpeta del paquete publicado o pasar -Origen."
}

Write-Host "1) Deteniendo el servicio existente (si esta activo)..." -ForegroundColor Cyan
if (Get-Service -Name $nombreServicio -ErrorAction SilentlyContinue) {
    Stop-Service -Name $nombreServicio -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "2) Copiando archivos a $destino..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $destino | Out-Null
Copy-Item -Path (Join-Path $Origen '*') -Destination $destino -Recurse -Force `
    -Exclude 'appsettings.Production.json', 'logs', '*.ps1', '*.cmd', '*.pdb'

# 3) Gestionar configuracion de produccion (ConnectionStrings / Puertos)
$prodConfigPath = Join-Path $destino 'appsettings.Production.json'
$configData = @{}

if (Test-Path $prodConfigPath) {
    try {
        $jsonContent = Get-Content $prodConfigPath -Raw | ConvertFrom-Json -AsHashtable
        if ($jsonContent) { $configData = $jsonContent }
    } catch { }
}

$cambiosConfig = $false

if ($ConnectionString) {
    if (-not $configData.ContainsKey('ConnectionStrings')) { $configData['ConnectionStrings'] = @{} }
    $configData['ConnectionStrings']['DefaultConnection'] = $ConnectionString
    $cambiosConfig = $true
}

if ($Puerto -gt 0) {
    $configData['Kestrel'] = @{ Endpoints = @{ Http = @{ Url = "http://*:$Puerto" } } }
    $cambiosConfig = $true
}

if ($cambiosConfig -or -not (Test-Path $prodConfigPath)) {
    $overrideJson = $configData | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($prodConfigPath, $overrideJson, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Configuracion de produccion actualizada en appsettings.Production.json" -ForegroundColor Green
}

Write-Host "3) Configurando/Registrando el Servicio de Windows..." -ForegroundColor Cyan
$servicioExistente = Get-Service -Name $nombreServicio -ErrorAction SilentlyContinue

if (-not $servicioExistente) {
    New-Service -Name $nombreServicio `
                -BinaryPathName "`"$exeDestino`"" `
                -DisplayName "FaMa API Backend" `
                -Description "Servicio central de API para el sistema FaMa (EAN)." `
                -StartupType Automatic | Out-Null
} else {
    Set-Service -Name $nombreServicio -StartupType Automatic
}

# Asegurar recuperacion ante fallos del servicio
sc.exe failure $nombreServicio reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null

Write-Host "4) Iniciando el servicio..." -ForegroundColor Cyan
Start-Service -Name $nombreServicio
Start-Sleep -Seconds 3

$estado = (Get-Service -Name $nombreServicio).Status
Write-Host ""
if ($estado -eq 'Running') {
    Write-Host "FaMaAPI instalado y corriendo exitosamente como Servicio de Windows." -ForegroundColor Green
} else {
    Write-Host "El servicio se creo pero su estado actual es: $estado. Revisa los logs de la aplicacion o el visor de eventos." -ForegroundColor Red
}

Write-Host "Ruta destino : $destino"
Write-Host "Para desinstalar: .\desinstalar.ps1"