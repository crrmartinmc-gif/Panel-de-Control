# Fase 5B.1: órdenes confirmadas para App Choferes Secretaría.
# NO cambia inicio/cierre de viajes, ni fotos, KM, servicios o asignaciones Maestro.
# Se ejecuta con PowerShell desde CMD. Requiere clasp y permisos sobre el Maestro.
$ErrorActionPreference = 'Stop'
$raw = 'https://raw.githubusercontent.com/crrmartinmc-gif/Panel-de-Control/main/backend/Ordenes_Choferes_F5B.gs'
$deployment = 'AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'Fase 5B.1 — Órdenes de Secretaría para App Choferes' -ForegroundColor Cyan
Write-Host 'Se modificará solo el despachador POST y se agregará un módulo.' -ForegroundColor Yellow
$script = (Read-Host 'Pegá la URL del proyecto BACKEND MAESTRO FLOTA o su Script ID').Trim()
if ($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)') { $script = $Matches[1] }
if ($script -notmatch '^[A-Za-z0-9_-]{20,}$') { throw 'Script ID inválido. Ningún cambio realizado.' }
if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) { throw 'Falta clasp: npm install -g @google/clasp' }
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ("Documents\Maestro-F5B-"+$stamp)
$backup=Join-Path $env:USERPROFILE ("Documents\RESPALDO-MAESTRO-F5B-"+$stamp)
New-Item -Path $work -ItemType Directory -Force | Out-Null
New-Item -Path $backup -ItemType Directory -Force | Out-Null
Push-Location $work
try {
  Write-Host 'Clonando proyecto Maestro...'
  & clasp clone $script
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo clonar Apps Script. No se modificó el servidor.' }
  Get-ChildItem -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force }
  Write-Host ('Respaldo completo: '+$backup) -ForegroundColor Green
  if (-not (Test-Path 'Secretaria_Fase5A.js')) { throw 'No se encontró el módulo F5A en el Maestro actual. Cancelado sin cambios.' }
  $f5a=[IO.File]::ReadAllText((Join-Path $work 'Secretaria_Fase5A.js'))
  if (-not $f5a.Contains('function s5Ctx_(')) { throw 'La Fase 5A no tiene la estructura esperada.' }
  $main=Join-Path $work 'Código.js'
  if (-not (Test-Path $main)) { $main=Join-Path $work 'Codigo.js' }
  if (-not (Test-Path $main)) { throw 'No se encontró Código.js / Codigo.js. Cancelado.' }
  $source=[IO.File]::ReadAllText($main)
  $anchor="case 'ping':return"
  if ($source.Split([string[]]@($anchor),[StringSplitOptions]::None).Count -ne 2 -or
      -not $source.Contains('function ejecutarPost_(accion,d)')) { throw 'El dispatcher del Maestro cambió. No se aplicó el parche.' }
  if ($source.Contains("case 'aceptarOrdenSecretaria'")) { throw 'Fase 5B ya presente en el Maestro; no repetir instalación.' }
  $inject="case 'loginOrdenSecretaria':return c5LoginOrdenSecretaria_(d); case 'listarOrdenesSecretaria':return c5Orders_(d); case 'aceptarOrdenSecretaria':return c5Aceptar_(d); "
  $patched=$source.Replace($anchor,$inject+$anchor)
  $dst=Join-Path $work 'Ordenes_Choferes_F5B.js'
  Invoke-WebRequest -UseBasicParsing -Uri $raw -OutFile $dst
  if (-not ([IO.File]::ReadAllText($dst)).Contains('function c5Aceptar_(')) { throw 'Descarga del módulo incompleta. Cancelado.' }
  $utf8=New-Object System.Text.UTF8Encoding -ArgumentList $false
  [IO.File]::WriteAllText($main,$patched,$utf8)
  Write-Host 'Preparado: módulo de órdenes + 3 acciones nuevas (sin tocar viajes).' -ForegroundColor Green
  & clasp status
  Write-Host ('Respaldo local en: '+$backup)
  $ok=Read-Host 'Escribí APLICAR para subir SOLO el código a Apps Script (Enter cancela)'
  if ($ok -ne 'APLICAR') { Write-Host 'Cancelado sin subir.'; return }
  & clasp push
  if ($LASTEXITCODE -ne 0) { throw 'Falló clasp push. Conservá el respaldo.' }
  Write-Host 'Código subido. La implementación publicada todavía no cambió.' -ForegroundColor Green
  $dep=(& clasp deployments | Out-String)
  Write-Host $dep
  $ok=Read-Host 'Escribí PUBLICAR para actualizar la misma URL /exec (Enter cancela)'
  if ($ok -ne 'PUBLICAR') { Write-Host 'Publicación pendiente.'; return }
  if (-not $dep.Contains($deployment)) { throw 'La implementación esperada no corresponde a este Apps Script. NO se publicó.' }
  & clasp deploy -i $deployment -d 'Fase 5B1 - Ordenes choferes Secretaria'
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo publicar. Conservá el respaldo y revisá clasp.' }
  Write-Host 'Implementación actualizada; URL conservada.' -ForegroundColor Green
  Write-Host ('Respaldo en: '+$backup)
} finally {
  Pop-Location
}
