# Diagnóstico de recursos de Secretaría; solo cambia el lector s5Resources_.
# No modifica flota, fotos, km, viajes, hojas, usuarios ni disponibilidad.
$ErrorActionPreference='Stop'
$raw='https://raw.githubusercontent.com/crrmartinmc-gif/Panel-de-Control/'
$oldRef='45a93b16fdb2c73328ad5ef4b2ba4d3c153760c7'
$deployment='AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'PANEL SECRETARIA: Diagnostico de choferes y vehiculos' -ForegroundColor Cyan
Write-Host 'Solo motivos de bloqueo. Sin cambios operativos.' -ForegroundColor Green
$script=(Read-Host 'Pega la URL del proyecto BACKEND MAESTRO FLOTA o su Script ID').Trim()
if($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)'){$script=$Matches[1]}
if($script -notmatch '^[A-Za-z0-9_-]{20,}$'){throw 'Script ID invalido. Nada modificado.'}
if(-not(Get-Command clasp -ErrorAction SilentlyContinue)){throw 'No se encontro clasp.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ('Documents\Maestro-Diagnostico-'+$stamp)
$backup=Join-Path $env:USERPROFILE ('Documents\RESPALDO-MAESTRO-DIAGNOSTICO-'+$stamp)
New-Item -ItemType Directory -Path $work,$backup -Force | Out-Null
Push-Location $work
try {
  & clasp clone $script
  if($LASTEXITCODE -ne 0){throw 'Fallo clonar Apps Script. Nada modificado.'}
  $conf=Get-Content '.clasp.json' -Raw | ConvertFrom-Json
  if([string]$conf.scriptId -ne $script){throw 'Script ID incorrecto.'}
  $deployments=& clasp deployments
  if($LASTEXITCODE -ne 0 -or -not(($deployments|Out-String).Contains($deployment))){
    throw 'La implementacion esperada no figura en este proyecto. No se publica.'
  }
  Get-ChildItem -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force }
  Write-Host ('Respaldo: '+$backup) -ForegroundColor Green
  $file=Join-Path $work 'Secretaria_Fase5A.js'
  if(-not(Test-Path $file)){$file=Join-Path $work 'Secretaria_Fase5A.gs'}
  if(-not(Test-Path $file)){throw 'No existe Secretaria_Fase5A en Apps Script.'}
  $oldFile=Join-Path $work 'original-verificado.txt'
  $newFile=Join-Path $work 'modulo-diagnostico.txt'
  Invoke-WebRequest -UseBasicParsing -Uri ($raw+$oldRef+'/backend/Secretaria_Fase5A.gs') -OutFile $oldFile
  Invoke-WebRequest -UseBasicParsing -Uri ($raw+'main/backend/Secretaria_Fase5A.gs') -OutFile $newFile
  function Sector([string]$s){
    $a=$s.IndexOf('function s5Resources_(')
    if($a -lt 0){throw 'Falta s5Resources_.'}
    $b=$s.IndexOf('function s5Recursos_(',$a)
    if($b -le $a){throw 'No se encuentra el cierre de s5Resources_.'}
    return @{a=$a;b=$b;code=$s.Substring($a,$b-$a)}
  }
  $currentText=[IO.File]::ReadAllText($file)
  $actual=Sector $currentText
  if($actual.code.Contains('const detalleC=new Map()')){
    Write-Host 'El diagnostico ya existe en Apps Script. No se instala dos veces.' -ForegroundColor Green
    return
  }
  $before=Sector ([IO.File]::ReadAllText($oldFile))
  $after=Sector ([IO.File]::ReadAllText($newFile))
  $norm={param([string]$t) $t.Replace([Environment]::NewLine,[string][char]10).Trim()}
  if((& $norm $actual.code) -cne (& $norm $before.code)){
    throw 'El backend tiene modificaciones distintas en disponibilidad. No se sobreescribiran.'
  }
  if(-not($after.code.Contains('Cuenta inactiva') -and $after.code.Contains('detalleC') -and $after.code.Contains('Fuera de servicio'))){
    throw 'Descarga incompleta del modulo de diagnostico. Cancelado.'
  }
  $updated=$currentText.Substring(0,$actual.a)+$after.code+$currentText.Substring($actual.b)
  $utf8=New-Object System.Text.UTF8Encoding -ArgumentList $false
  [IO.File]::WriteAllText($file,$updated,$utf8)
  Remove-Item -LiteralPath $oldFile,$newFile -Force
  if(Get-Command node -ErrorAction SilentlyContinue){
    & node --check $file
    if($LASTEXITCODE -ne 0){throw 'Error de sintaxis. No se subio nada.'}
  }
  Write-Host 'Preparado. El unico cambio es de informacion sobre disponibilidad.' -ForegroundColor Green
  & clasp status
  $ok=Read-Host 'Escribi APLICAR para subir el codigo (Enter cancela)'
  if($ok -ne 'APLICAR'){Write-Host 'Cancelado sin subir.';return}
  & clasp push
  if($LASTEXITCODE -ne 0){throw 'Fallo clasp push. Conserva el respaldo.'}
  $ok=Read-Host 'Escribi PUBLICAR para actualizar la MISMA URL del Panel (Enter cancela)'
  if($ok -ne 'PUBLICAR'){Write-Host 'Codigo subido; publicacion anterior todavia activa.';return}
  & clasp deploy -i $deployment -d 'Diagnostico recursos Secretaria'
  if($LASTEXITCODE -ne 0){throw 'Fallo publicacion, codigo subido.'}
  Write-Host 'Panel actualizado. Recarga con Ctrl + F5.' -ForegroundColor Green
  Write-Host ('Respaldo: '+$backup)
}finally{Pop-Location}
