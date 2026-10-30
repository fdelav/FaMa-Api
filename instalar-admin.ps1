<#
.SYNOPSIS
    Instala FaMaAPI como SERVICIO DE WINDOWS. REQUIERE ADMINISTRADOR.

.DESCRIPTION
    Copia los binarios a C:\FaMa\api (carpeta protegida), configura appsettings.Production.json
    con la cadena de conexión o puerto opcional, y registra la API como un Servicio de Windows
    con inicio automático y autorreinicio ante fallos.

.PARAMETER Origen
    Carpeta con el paquete publicado de la API. Por defecto, la carpeta de este script.

.PARAMETER ConnectionString
    Cadena de conexión a PostgreSQL. Si se proporciona, se actualiza o crea 
    appsettings.Production.json sin tocar el appsettings.json base.

.PARAMETER Puerto
    Puerto opcional en el que escuchará la API.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar-admin.ps1 -ConnectionString "Host=localhost;Database=fama_db;Username=postgres;Password=tu_clave"
#>
[CmdletBinding()]
param(
    [string]$Origen,
    [string]$ConnectionString,
    [int]$Puerto
)

$ErrorActionPreference = 'Stop'

$nombre = 'FaMaApi'

# --- Administrador ---------------------------------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Este script instala un servicio de Windows y necesita Administrador. Abre PowerShell con "Ejecutar como administrador" y vuelve a ejecutarlo.'
}

# --- Rutas -----------------------------------------------------------------------------------
$aqui = $PSScriptRoot
if (-not $aqui -and $MyInvocation.MyCommand.Path) { $aqui = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $aqui) { $aqui = (Get-Location).Path }
if (-not $Origen) { $Origen = $aqui }

$nombreEjecutable = 'FaMaAPI.exe'
$exeOrigen = Join-Path $Origen $nombreEjecutable
if (-not (Test-Path $exeOrigen)) {
    throw "No se encuentra $exeOrigen. Ejecuta este script desde el paquete publicado de la API o pasa -Origen."
}

$programFiles = $env:ProgramFiles
if (-not $programFiles) { $programFiles = [Environment]::GetFolderPath('ProgramFiles') }

$destino = Join-Path $programFiles 'FaMa\api'
$exe = Join-Path $destino $nombreEjecutable

# --- 1) Detener el servicio si ya está corriendo ----------------------------------------------
$servicio = Get-Service -Name $nombre -ErrorAction SilentlyContinue
if ($servicio -and $servicio.Status -ne 'Stopped') {
    Stop-Service -Name $nombre -Force
    $servicio.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
}

$procesosViejos = Get-Process -Name 'FaMaAPI' -ErrorAction SilentlyContinue
if ($procesosViejos) {
    $procesosViejos | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# --- 2) Copia de archivos a Program Files ----------------------------------------------------
New-Item -ItemType Directory -Force -Path $destino | Out-Null
Copy-Item -Path (Join-Path $Origen '*') -Destination $destino -Recurse -Force `
    -Exclude 'appsettings.Production.json', 'logs', '*.ps1', '*.cmd', '*.vbs', '*.pdb'

# --- 3) Gestionar appsettings.Production.json ------------------------------------------------
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
}

Get-ChildItem -Path $destino -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# --- 4) Registro del Servicio de Windows -----------------------------------------------------
$rutaServicio = '"{0}"' -f $exe

if (-not (Get-Service -Name $nombre -ErrorAction SilentlyContinue)) {
    New-Service -Name $nombre -BinaryPathName $rutaServicio -DisplayName 'FaMa API Backend' `
        -Description 'Servicio central de API para el sistema FaMa (EAN).' `
        -StartupType Automatic | Out-Null
}
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\$nombre" -Name ImagePath -Value $rutaServicio

# Arranque diferido para no saturar el inicio del sistema operativo
& sc.exe config $nombre start= delayed-auto | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc.exe config start falló (código $LASTEXITCODE)." }

# Cuenta de servicio con mínimos privilegios (NT SERVICE\FaMaApi)
& sc.exe config $nombre obj= "NT SERVICE\$nombre" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc.exe config obj falló (código $LASTEXITCODE)." }

# Si falla, se reinicia: 3 intentos, separos por unos segundos
& sc.exe failure $nombre reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc.exe failure falló (código $LASTEXITCODE)." }

# --- 5) Iniciar el Servicio ------------------------------------------------------------------
Start-Service -Name $nombre
Start-Sleep -Seconds 3
$estado = (Get-Service -Name $nombre).Status

Write-Host ''
if ($estado -eq 'Running') {
    Write-Host 'FaMaAPI instalada como Servicio de Windows y en ejecución.' -ForegroundColor Green
} else {
    Write-Host "El servicio se instaló, pero su estado es: $estado. Revisa el Visor de eventos." -ForegroundColor Red
}
Write-Host "Programa : $destino"
if ($ConnectionString) { Write-Host "BD configurada correctamente en producción." }
Write-Host 'Para quitarlo: .\desinstalar-admin.ps1'