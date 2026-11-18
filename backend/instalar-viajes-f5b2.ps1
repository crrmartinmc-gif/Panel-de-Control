# F5B.2: vincular inicio y cierre de traslados de Secretaría.
# Solo modifica 3 rutas del dispatcher POST y agrega un módulo aislado.
# No sustituye las funciones de viajes, fotos, km ni la cola del celular.
$ErrorActionPreference='Stop'
$base='https://raw.githubusercontent.com/crrmartinmc-gif/Panel-de-Control/main/backend/'
$deployment='AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'Fase 5B.2 — Inicio y cierre de traslados vinculados' -ForegroundColor Cyan
Write-Host 'Solo afectará viajes de Secretaría que lleven una orden aceptada.' -ForegroundColor Yellow
$script=(Read-Host 'Pegá la misma URL del proyecto BACKEND MAESTRO FLOTA o su Script ID').Trim()
if($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)'){$script=$Matches[1]}
if($script -notmatch '^[A-Za-z0-9_-]{20,}$'){throw 'Script ID inválido. No se modificó nada.'}
if(-not (Get-Command clasp -ErrorAction SilentlyContinue)){throw 'Falta clasp; ejecutá npm install -g @google/clasp'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ('Documents\Maestro-F5B2-'+$stamp)
$backup=Join-Path $env:USERPROFILE ('Documents\RESPALDO-MAESTRO-F5B2-'+$stamp)
New-Item -ItemType Directory -Path $work -Force | Out-Null
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Push-Location $work
try{
  & clasp clone $script
  if($LASTEXITCODE -ne 0){throw 'Error clonando el Maestro. No se modificó el servidor.'}
  Get-ChildItem -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $backup -Force -Recurse }
  Write-Host ('Respaldo completo: '+$backup) -ForegroundColor Green
  $main=Join-Path $work 'Código.js'
  if(-not (Test-Path $main)){$main=Join-Path $work 'Codigo.js'}
  if(-not (Test-Path $main)){throw 'No se encontró el archivo principal Código.js / Codigo.js.'}
  if(-not (Test-Path 'Secretaria_Fase5A.js') -or -not (Test-Path 'Ordenes_Choferes_F5B.js')){
    throw 'No están instaladas Fase 5A y 5B.1. Se canceló sin subir.'
  }
  $source=[IO.File]::ReadAllText($main)
  if($source.Contains('c52Iniciar_(d)') -or (Test-Path 'Ordenes_Choferes_F5B2.js')){
    throw 'Parece instalada Fase 5B.2. No repetir el parche.'
  }
  $edits=@(
    @("case 'iniciarViajeSecretaria':return iniciarViajeSecretaria_(d);","case 'iniciarViajeSecretaria':return c52Iniciar_(d);"),
    @("case 'finalizarViajeSecretaria':return finalizarViajeSecretaria_(d);","case 'finalizarViajeSecretaria':return c52Finalizar_(d);"),
    @("case 'listarOrdenesSecretaria':return c5Orders_(d);","case 'listarOrdenesSecretaria':return c52Orders_(d);")
  )
  foreach($e in $edits){
    $ant=$e[0];$nuevo=$e[1]
    if($source.Split([string[]]@($ant),[StringSplitOptions]::None).Count -ne 2){
      throw ('Cambió la ruta esperada: '+$ant+'; no se subió nada.')
    }
    $source=$source.Replace($ant,$nuevo)
  }
  $newfile=Join-Path $work 'Ordenes_Choferes_F5B2.js'
  Invoke-WebRequest -UseBasicParsing -Uri ($base+'Ordenes_Choferes_F5B2.gs') -OutFile $newfile
  $module=[IO.File]::ReadAllText($newfile)
  if(-not $module.Contains('function c52Iniciar_(') -or
     -not $module.Contains('function c52Finalizar_(') -or
     -not $module.Contains('function c52Orders_(')){
    throw 'La descarga del módulo no está completa. Cancelado.'
  }
  $utf8=New-Object System.Text.UTF8Encoding -ArgumentList $false
  [IO.File]::WriteAllText($main,$source,$utf8)
  Write-Host 'Preparado: 3 rutas de órdenes + módulo F5B.2. Viajes independientes intactos.' -ForegroundColor Green
  & clasp status
  Write-Host ('Respaldo: '+$backup)
  $ok=Read-Host 'Para subir el CÓDIGO escribí APLICAR (Enter cancela)'
  if($ok -ne 'APLICAR'){Write-Host 'Cancelado sin subir.';return}
  & clasp push
  if($LASTEXITCODE -ne 0){throw 'Falló clasp push. Conservá el respaldo.'}
  Write-Host 'Código actualizado. La aplicación web publicada todavía no cambió.' -ForegroundColor Green
  $implementaciones=(& clasp deployments | Out-String)
  Write-Host $implementaciones
  $ok=Read-Host 'Para actualizar la misma URL /exec escribí PUBLICAR (Enter cancela)'
  if($ok -ne 'PUBLICAR'){Write-Host 'Publicación pendiente.';return}
  if(-not $implementaciones.Contains($deployment)){throw 'No coincide el ID de implementación del Panel. Se canceló publicación.'}
  & clasp deploy -i $deployment -d 'Fase 5B2 - Inicio y fin de traslados Secretaria'
  if($LASTEXITCODE -ne 0){throw 'No se pudo publicar. Conservá el respaldo.'}
  Write-Host 'Implementación actualizada, con la MISMA URL.' -ForegroundColor Green
  Write-Host ('Respaldo: '+$backup)
}finally{Pop-Location}
