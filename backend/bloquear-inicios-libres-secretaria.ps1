# Secretaria: exigir orden aceptada y asignacion para iniciar NUEVOS viajes.
# No afecta Logistica Ambiental ni cierres de viajes de Secretaria existentes.
$ErrorActionPreference='Stop'
$deployment='AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'APP CHOFERES / SECRETARIA - Asignacion obligatoria para nuevas salidas' -ForegroundColor Cyan
Write-Host 'Sin cambios de fotos, KM, servicios generales ni cierres.' -ForegroundColor Green
Write-Host 'ATENCION: Revisar viajes independientes pendientes de sincronizar ANTES de publicar.' -ForegroundColor Yellow
$script=(Read-Host 'Pega la URL del editor de BACKEND MAESTRO FLOTA o su Script ID').Trim()
if($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)'){$script=$Matches[1]}
if($script -notmatch '^[A-Za-z0-9_-]{20,}$'){throw 'Script ID invalido. Nada modificado.'}
if(-not(Get-Command clasp -ErrorAction SilentlyContinue)){throw 'Falta clasp. Nada modificado.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ('Documents\Maestro-Salidas-Asignadas-'+$stamp)
$backup=Join-Path $env:USERPROFILE ('Documents\RESPALDO-MAESTRO-SALIDAS-'+$stamp)
New-Item -ItemType Directory -Path $work,$backup -Force|Out-Null
Push-Location $work
try{
  & clasp clone $script
  if($LASTEXITCODE -ne 0){throw 'No se pudo clonar Maestro. Nada aplicado.'}
  $config=Get-Content '.clasp.json' -Raw|ConvertFrom-Json
  if([string]$config.scriptId -ne $script){throw 'Script ID incorrecto. Cancelado.'}
  $deployments=& clasp deployments
  if($LASTEXITCODE -ne 0 -or -not(($deployments|Out-String).Contains($deployment))){
    throw 'La implementacion conocida del Panel no figura en este proyecto.'
  }
  Get-ChildItem -Force|ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force
  }
  Write-Host ('Respaldo completo: '+$backup) -ForegroundColor Green
  $principal=Join-Path $work 'Código.js'
  if(-not(Test-Path $principal)){$principal=Join-Path $work 'Codigo.js'}
  if(-not(Test-Path $principal)){throw 'No se encontro el backend principal.'}
  $despachador=[IO.File]::ReadAllText($principal)
  if(-not $despachador.Contains("case 'iniciarViajeSecretaria':return c52Iniciar_(d);")){
    throw 'El Maestro no utiliza el dispatcher F5B2; no se aplicara el parche.'
  }
  $modulo=Join-Path $work 'Ordenes_Choferes_F5B2.js'
  if(-not(Test-Path $modulo)){$modulo=Join-Path $work 'Ordenes_Choferes_F5B2.gs'}
  if(-not(Test-Path $modulo)){throw 'El backend no tiene Ordenes_Choferes_F5B2.'}
  $source=[IO.File]::ReadAllText($modulo)
  if(-not($source.Contains('function c52Iniciar_(d)') -and $source.Contains('function c52Finalizar_(d)'))){
    throw 'El modulo no contiene las funciones verificadas.'
  }
  $viejo='if(!d.idSolicitud && !d.idAsignacionLocal)return iniciarViajeSecretaria_(d);'
  $mensaje='Para iniciar un viaje de Secretaría necesitás un traslado confirmado y asignado desde el Panel.'
  $cambio=$false
  if($source.Contains($mensaje)){
    if($source.Contains($viejo)){throw 'El modulo contiene reglas contradictorias. No se publicara.'}
    Write-Host 'El bloqueo ya esta presente en el codigo actual.' -ForegroundColor Green
  }else{
    if($source.Split([string[]]@($viejo),[StringSplitOptions]::None).Count -ne 2){
      throw 'La funcion de inicio difiere del codigo esperado; cancelar.'
    }
    $nuevo='if(!d.idSolicitud && !d.idAsignacionLocal)'+[Environment]::NewLine+
      "    throw Error('"+$mensaje+"');"
    $actual=$source.Replace($viejo,$nuevo)
    $oldComment='// Los viajes independientes de Secretaría conservan exactamente su circuito.'
    $newComment='// Los nuevos inicios de Secretaría necesitan orden aceptada y asignada.'
    if($actual.Contains($oldComment)){$actual=$actual.Replace($oldComment,$newComment)}
    $utf8=New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($modulo,$actual,$utf8)
    $cambio=$true
    if(Get-Command node -ErrorAction SilentlyContinue){
      & node --check $modulo
      if($LASTEXITCODE -ne 0){throw 'Error de sintaxis del modulo. No se subio.'}
    }
  }
  if($cambio){
    Write-Host 'El cambio se limita al inicio de viajes de Secretaria.' -ForegroundColor Green
    & clasp status
    $aplicar=Read-Host 'Escribi APLICAR para subir el codigo (Enter cancela)'
    if($aplicar -ne 'APLICAR'){Write-Host 'Cancelado sin subir.';return}
    & clasp push
    if($LASTEXITCODE -ne 0){throw 'Fallo subida a Apps Script. Conserva el respaldo.'}
  }
  Write-Host 'Codigo preparado. Los cierres anteriores siguen funcionando.' -ForegroundColor Green
  Write-Host 'Antes de publicar, verificá si hay viajes independientes pendientes de sincronizacion.' -ForegroundColor Yellow
  $publicar=Read-Host 'Escribi PUBLICAR para actualizar la MISMA URL /exec del Panel (Enter cancela)'
  if($publicar -ne 'PUBLICAR'){Write-Host 'Publicacion pendiente.';return}
  & clasp deploy -i $deployment -d 'Secretaria: exigir orden asignada y aceptada para iniciar'
  if($LASTEXITCODE -ne 0){throw 'Fallo publicacion. Conserva el respaldo.'}
  Write-Host 'Backend actualizado. URL de Panel intacta.' -ForegroundColor Green
  Write-Host ('Respaldo: '+$backup)
}finally{Pop-Location}
