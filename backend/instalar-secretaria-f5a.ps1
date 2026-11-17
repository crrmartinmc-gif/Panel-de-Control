# Instala Fase 5A en el Apps Script BACKEND MAESTRO FLOTA, sin alterar otros módulos.
# REQUIERE: clasp logueado con la cuenta autorizada a editar el Maestro.
# Descarga código SOLO del repositorio Panel-de-Control del usuario.
# Preserva copia local completa y mantiene la URL /exec al actualizar despliegue existente.
$ErrorActionPreference = 'Stop'
$repoRaw = 'https://raw.githubusercontent.com/crrmartinmc-gif/Panel-de-Control/main'
$deployId = 'AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'FASE 5A: Panel de Control conectado a APPSECRETARIA' -ForegroundColor Cyan
Write-Host 'No se tocan SERVICIOS, VIAJES ni KILOMETRAJES del Maestro.' -ForegroundColor Yellow
$scriptId = (Read-Host 'Pegá el ID DEL SCRIPT o URL del editor de BACKEND MAESTRO FLOTA (no el ID de la planilla)').Trim()
if ($scriptId -match 'script\.google\.com/(?:home/projects|d)/([A-Za-z0-9_-]+)') { $scriptId = $Matches[1] }
if ($scriptId -notmatch '^[A-Za-z0-9_-]{20,}$') {
  throw 'Script ID inválido. No se hizo ningún cambio.'
}
if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
  throw 'Falta clasp. Instalalo con: npm install -g @google/clasp'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path $env:USERPROFILE ("Documents\Maestro-F5A-" + $stamp)
$backup = Join-Path $env:USERPROFILE ("Documents\RESPALDO-MAESTRO-" + $stamp)
New-Item -ItemType Directory -Path $dir -Force | Out-Null
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Push-Location $dir
try {
  Write-Host 'Descargando una copia del Apps Script Maestro...' -ForegroundColor Cyan
  & clasp clone $scriptId
  if ($LASTEXITCODE -ne 0) {
    if ((Get-ChildItem -Force | Measure-Object).Count -ne 0) { throw 'Clonación incompleta: no se continuará.' }
    & clasp clone-script $scriptId
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo clonar el Maestro. Revisá tu cuenta y versión de clasp.' }
  }
  Get-ChildItem -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force }
  Write-Host ('Respaldo completo: ' + $backup) -ForegroundColor Green

  $candidate = @(Get-ChildItem -Path $dir -Recurse -File |
    Where-Object { $_.Extension -in '.js','.gs' -and
      (Select-String -LiteralPath $_.FullName -SimpleMatch -Quiet 'function ejecutarPanelGetV1_(parametros)') })
  if ($candidate.Count -ne 1) { throw 'No encontré un único archivo principal Maestro compatible. No se subió nada.' }
  $main = $candidate[0].FullName
  $source = [IO.File]::ReadAllText($main)
  if (-not $source.Contains('function ejecutarPanelPostV1_(d)')) {
    throw 'El backend no tiene la entrada POST prevista. No se subió nada.'
  }
  if ($source.Contains("s5Agenda_(") -or $source.Contains("secPanelAgenda_(")) {
    throw 'Parece existir ya otra integración con Secretaría: revisar antes de volver a instalar.'
  }
  $anchorGet = '  // Este perfil puede ejecutar exclusivamente la lectura del módulo Servicios.'
  $anchorPost = '  // Perfil de consulta: ninguna escritura, ni siquiera si se llama manualmente al endpoint.'
  if (($source.Split([string[]]@($anchorGet),[StringSplitOptions]::None).Count -ne 2) -or
      ($source.Split([string[]]@($anchorPost),[StringSplitOptions]::None).Count -ne 2)) {
    throw 'Las entradas de permisos cambiaron respecto del backend revisado. No se modificó nada.'
  }

  $injectGet = @'
  // F5A: Secretaría lee únicamente sus traslados, con sesión validada.
  if (interna === 'secretariaAgenda' || interna === 'secretariaRecursos') {
    s5Auth_(sesion);
    return interna === 'secretariaAgenda' ? s5Agenda_(p) : s5Recursos_(p);
  }

'@
  $injectPost = @'
  // F5A: excepciones de escritura exclusivamente para Secretaría, sobre APPSECRETARIA.
  if (['secretariaReservar','secretariaAsignar','secretariaLiberar','secretariaConfirmar'].includes(interna)) {
    s5Auth_(sesion);
    return s5Post_(interna, entrada.datosOriginal || {}, sesion);
  }

'@
  $patched = $source.Replace($anchorGet, $injectGet + $anchorGet)
  $patched = $patched.Replace($anchorPost, $injectPost + $anchorPost)
  $moduleDest = Join-Path (Split-Path $main -Parent) 'Secretaria_Fase5A.js'
  $moduleURL = $repoRaw + '/backend/Secretaria_Fase5A.gs'
  Invoke-WebRequest -Uri $moduleURL -OutFile $moduleDest -UseBasicParsing
  $module = [IO.File]::ReadAllText($moduleDest)
  if (-not $module.Contains('function s5Post_(') -or -not $module.Contains('function s5Auth_(')) {
    throw 'Módulo descargado incorrecto: se canceló la instalación.'
  }
  $utf8 = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [IO.File]::WriteAllText($main,$patched,$utf8)
  Write-Host 'Backend parcheado localmente (sin reescribir los módulos de viajes ni choferes).' -ForegroundColor Green
  Write-Host 'Archivos que se subirán:' -ForegroundColor Cyan
  & clasp status
  if ($LASTEXITCODE -ne 0) { & clasp show-file-status }
  Write-Host ''
  $ok = Read-Host 'Para actualizar el CÓDIGO del Maestro escribí APLICAR (o Enter para cancelar)'
  if ($ok -ne 'APLICAR') {
    Write-Host ('Cancelado. Respaldo disponible en ' + $backup)
    return
  }
  & clasp push
  if ($LASTEXITCODE -ne 0) { throw 'Falló clasp push. Revisá el resultado y conservá el respaldo.' }
  Write-Host 'Código actualizado. La aplicación publicada todavía puede estar en la versión anterior.' -ForegroundColor Green
  Write-Host 'Implementaciones existentes:' -ForegroundColor Cyan
  $deployments = @(& clasp deployments)
  if ($LASTEXITCODE -ne 0) { $deployments = @(& clasp list-deployments) }
  Write-Host ($deployments | Out-String)
  Write-Host ('La implementación de este Panel debe ser: ' + $deployId)
  $publish = Read-Host 'Para actualizar la MISMA URL /exec escribí PUBLICAR (o Enter para no publicar)'
  if ($publish -eq 'PUBLICAR') {
    $list = ($deployments | Out-String)
    if (-not $list.Contains($deployId)) {
      throw 'El ID de implementación del Panel no está en este proyecto. No se publicó nada.'
    }
    & clasp deploy -i $deployId -d 'Fase 5A: Panel Secretaría y APPSECRETARIA'
    if ($LASTEXITCODE -ne 0) { & clasp create-deployment -i $deployId -d 'Fase 5A: Panel Secretaría y APPSECRETARIA' }
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar la implementación. Conservá el respaldo y revisá clasp.' }
    Write-Host 'Implementación existente actualizada, sin cambiar su URL.' -ForegroundColor Green
  } else {
    Write-Host 'Código guardado; implementación sin cambios. Se puede probar desde /dev.'
  }
  Write-Host ('Respaldo local: ' + $backup)
} finally {
  Pop-Location
}
