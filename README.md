# FaMaAPI

Backend central para el sistema de monitoreo y diagnóstico FaMa. Esta API en ASP.NET Core gestiona la recepción de datos, la persistencia en PostgreSQL/SQLite y la comunicación con los clientes monitoreados.

---

## 🛠️ Requisitos Previos

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- Servidor PostgreSQL en ejecución
- Windows PowerShell 5.1+ (para scripts de despliegue en servidor objetivo)

---

## Configuración (`appsettings.json`)

El archivo base contiene la configuración por defecto de desarrollo:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=fama_db;Username=postgres;Password=tu_clave"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

    Nota: En entornos de producción, la configuración se sobreescribe mediante appsettings.Production.json generado automáticamente por el script de instalación para preservar credenciales sin pisar los binarios base.

## Instalación como Servicio de Windows

Para desplegar la API en un servidor Windows como un servicio persistente de fondo (FaMaApi):

    Copia la carpeta del paquete publicado al servidor objetivo.

    Abre PowerShell como Administrador.

    Navega a la carpeta del paquete y ejecuta el script de instalación:

PowerShell

.\instalar.ps1 -ConnectionString "Host=servidor_pg;Port=5432;Database=fama_db;Username=postgres;Password=clave" -Puerto 5000

Parámetros opcionales del script:

    -Origen: Especifica la ruta del paquete si se ejecuta desde otra ubicación.

    -ConnectionString: Actualiza la cadena de conexión a PostgreSQL en appsettings.Production.json.

    -Puerto: Define el puerto en el que escuchará Kestrel (ej. 5000).

## Desinstalación

Para detener el servicio y eliminar su registro del sistema:
PowerShell

## Conserva logs y appsettings.Production.json
.\desinstalar.ps1 -ConservarDatos

## Elimina completamente los archivos e instalación
.\desinstalar.ps1