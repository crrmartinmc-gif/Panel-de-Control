# Corrige el error "Fecha u hora de traslado invalida" al reservar 9:30.
# NO reescribe el resto del Maestro, no edita APPSECRETARIA ni modifica usuarios.
# Lee la version actual, respalda, parchea solo Secretaria_Fase5A.js
# y actualiza la misma implementacion /exec (ID conocido de Panel Maestro).
$ErrorActionPreference='Stop'
$deployment='AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'PANEL DE CONTROL | Correccion reserva 9:30 sin cero inicial' -ForegroundColor Cyan
Write-Host 'Solo actualiza la normalizacion de la hora en el backend de Secretaria.' -ForegroundColor Green
Write-Host 'No toca fotos, km, servicios, viajes, usuarios ni APPSECRETARIA.' -ForegroundColor Yellow
$script=(Read-Host 'Pega la URL del editor de BACKEND MAESTRO FLOTA o su Script ID').Trim()
if($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)'){$script=$Matches[1]}
if($script -notmatch '^[A-Za-z0-9_-]{20,}$'){throw 'Script ID invalido. Ningun cambio aplicado.'}
if(-not(Get-Command clasp -ErrorAction SilentlyContinue)){throw 'Falta clasp. Ejecuta npm install -g @google/clasp.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ('Documents\Maestro-Reserva-Hora-'+$stamp)
$backup=Join-Path $env:USERPROFILE ('Documents\RESPALDO-MAESTRO-RESERVA-HORA-'+$stamp)
New-Item -ItemType Directory -Path $work,$backup -Force | Out-Null
Push-Location $work
try{
  & clasp clone $script
  if($LASTEXITCODE -ne 0){throw 'No se pudo clonar el Maestro. No se modifico el servidor.'}
  $conf=Get-Content '.clasp.json' -Raw | ConvertFrom-Json
  if([string]$conf.scriptId -ne $script){throw 'El proyecto no coincide con el Script ID solicitado.'}
  $deploys=& clasp deployments
  if($LASTEXITCODE -ne 0 -or -not(($deploys|Out-String).Contains($deployment))){
    throw 'No se encontro la implementacion activa del Panel Maestro. No se subira el cambio.'
  }
  Get-ChildItem -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force
  }
  Write-Host ('Respaldo completo: '+$backup) -ForegroundColor Green
  $module=Join-Path $work 'Secretaria_Fase5A.js'
  if(-not(Test-Path $module)){$module=Join-Path $work 'Secretaria_Fase5A.gs'}
  if(-not(Test-Path $module)){throw 'No se encontro Secretaria_Fase5A. No se aplica ningun cambio.'}
  $old=[IO.File]::ReadAllText($module)
  $mark='function s5Hora_(valor)'
  $srcRead="else if(k==='HORA_INICIO_PREVISTA')v=String(vis[i][j]||v||'').trim().slice(0,5);"
  $dstRead="else if(k==='HORA_INICIO_PREVISTA')v=s5Hora_(vis[i][j]||v);"
  $srcWindow='const f=String(s.FECHA_SERVICIO),h=String(s.HORA_INICIO_PREVISTA).slice(0,5);'
  $dstWindow='const f=String(s.FECHA_SERVICIO),h=s5Hora_(s.HORA_INICIO_PREVISTA);'
  $anchor='function s5Open_(){'
  $helper=@'
// Google Sheets puede mostrar 9:30, 09:30 o 9:30 a. m.
function s5Hora_(valor){
  const x=String(valor==null?'':valor).trim();
  const m=/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s*m\.?)?$/i.exec(x);
  if(!m)return '';
  let h=Number(m[1]);const minutos=Number(m[2]);
  if(minutos>59||h>23)return '';
  if(m[3]){
    if(h<1||h>12)return '';
    h=h%12+(/p/i.test(m[3])?12:0);
  }
  return String(h).padStart(2,'0')+':'+m[2];
}
'@
  if($old.Contains($mark)){
    if(-not $old.Contains($dstRead) -or -not $old.Contains($dstWindow)){
      throw 'Se encontro una modificacion parcial. No se aplicara otro parche.'
    }
    Write-Host 'La normalizacion de hora ya existe en el codigo.' -ForegroundColor Green
  }else{
    foreach($a in @($srcRead,$srcWindow,$anchor)){
      if($old.Split([string[]]@($a),[StringSplitOptions]::None).Count -ne 2){
        throw ('El backend actual ya no coincide en: '+$a+'. No se subio nada.')
      }
    }
    $updated=$old.Replace($anchor,$helper+[Environment]::NewLine+$anchor).
      Replace($srcRead,$dstRead).Replace($srcWindow,$dstWindow)
    $utf8=New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($module,$updated,$utf8)
    if(Get-Command node -ErrorAction SilentlyContinue){
      & node --check $module
      if($LASTEXITCODE -ne 0){throw 'El modulo tiene un error de sintaxis. No se subio.'}
    }
    Write-Host 'Correccion preparada: 9:30 se interpreta como 09:30.' -ForegroundColor Green
  }
  Write-Host 'Archivo modificado: Secretaria_Fase5A; resto del proyecto intacto.' -ForegroundColor Cyan
  & clasp status
  $ok=Read-Host 'Escribi APLICAR para actualizar el codigo de Apps Script (Enter cancela)'
  if($ok -ne 'APLICAR'){Write-Host 'Cancelado sin subir.';return}
  & clasp push
  if($LASTEXITCODE -ne 0){throw 'Fallo clasp push. Se conserva el respaldo.'}
  Write-Host 'Codigo actualizado; pendiente publicar la misma version del Panel.' -ForegroundColor Green
  $ok=Read-Host 'Escribi PUBLICAR para actualizar la misma URL /exec del Panel (Enter cancela)'
  if($ok -ne 'PUBLICAR'){Write-Host 'No se publico. El codigo anterior sigue activo en /exec.';return}
  & clasp deploy -i $deployment -d 'Corregida reserva de traslados con hora 9:30'
  if($LASTEXITCODE -ne 0){throw 'No se pudo publicar la implementacion del Panel.'}
  Write-Host 'Correcto: Panel Maestro actualizado, MISMA URL. No cambian datos ni contrasenas.' -ForegroundColor Green
  Write-Host ('Respaldo: '+$backup)
}finally{Pop-Location}
