$ErrorActionPreference='Stop'
$deployment='AKfycbz0n4ZlW2p--nP2Wx0SnytyCRt_pL6RFxliEan0j1vUdSSrBrVNCbsTI7VC0JQWl5k9'
Write-Host 'Habilitar rechazo en Panel Secretaria'
$script=(Read-Host 'Pega la URL del proyecto BACKEND MAESTRO FLOTA o su Script ID').Trim()
if($script -match 'script\.google\.com/(?:u/\d+/)?(?:home/projects|d)/([A-Za-z0-9_-]+)'){$script=$Matches[1]}
if($script -notmatch '^[A-Za-z0-9_-]{20,}$'){throw 'Script ID invalido. Nada modificado.'}
if(-not(Get-Command clasp -ErrorAction SilentlyContinue)){throw 'No se encontro clasp.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$work=Join-Path $env:USERPROFILE ('Documents\Maestro-Rechazo-'+$stamp)
$backup=Join-Path $env:USERPROFILE ('Documents\RESPALDO-MAESTRO-RECHAZO-'+$stamp)
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
  $code=@'
const fs=require('fs');
const files=fs.readdirSync('.').filter(p=>/\.(js|gs)$/i.test(p));
const edits=new Map();
let routed=false,handled=false;
for(const p of files){
  const original=fs.readFileSync(p,'utf8');
  let s=original.replace(/\[[^\[\]]{0,1300}\]/g,list=>{
    if(!/['"]secretariaReservar['"]/.test(list)||!/['"]secretariaConfirmar['"]/.test(list))return list;
    if(!/Secretaria_Fase5A\./i.test(p))routed=true;
    return list.includes('secretariaRechazar')?list:list.replace(/(['"])secretariaReservar\1/,m=>m+",'secretariaRechazar'");
  });
  if(/Secretaria_Fase5A\./i.test(p)){
    const marker=/if\s*\(action\s*===\s*['"]secretariaReservar['"]\)\s*\{/;
    if(!s.includes("if(action==='secretariaRechazar')")){
      if(!marker.test(s))throw Error('No se encontro la funcion de reservas en '+p);
      s=s.replace(marker,m=>"    if(action==='secretariaRechazar'){\n      s5Auth_(sesion);\n      if(!['PENDIENTE','EN_REVISION','REPROGRAMADA'].includes(estado)||x.a)\n        throw Error('Solo se pueden rechazar solicitudes pendientes sin asignación activa.');\n      const cola=s5Read_(c.ss,'INTEGRACION',['ID_SOLICITUD','TIPO','ESTADO']);\n      if(cola.some(f=>f.ID_SOLICITUD===id&&f.TIPO==='SOLICITUD_A_MAESTRO_F5'&&['PREPARADA','ENVIANDO','INCIERTA','ENVIADA'].includes(s5Norm_(f.ESTADO))))\n        throw Error('La solicitud tiene un envío al Maestro. Revisalo antes de rechazar.');\n      if(x.r)s5Patch_(c.ss,'AGENDA',x.r,{ESTADO:'CANCELADA',FECHA_ACTUALIZACION:s5Now_()});\n      s5Patch_(c.ss,'SOLICITUDES',s,{ESTADO:'RECHAZADA',FECHA_MODIFICACION:s5Now_()});\n      s5Audit_(c,id,sesion,'CAMBIO_ESTADO','Solicitud rechazada desde el panel.');\n      try{s5Append_(c.ss,'NOTIFICACIONES',{ID_NOTIFICACION:s5ID_('NOT'),ID_USUARIO:s.ID_SOLICITANTE,ID_SOLICITUD:id,TIPO:'ESTADO',MENSAJE:'Secretaría rechazó tu solicitud de traslado.',FECHA_CREACION:s5Now_()});}\n      catch(err){console.warn('Solicitud rechazada; aviso pendiente: '+err.message);}\n      return {ok:true,estado:'RECHAZADA'};\n    }\n"+m);
    }
    handled=true;
  }
  if(s!==original){new Function(s);edits.set(p,s);}
}
if(!handled||!routed)throw Error('No se encontro el modulo o la ruta de Secretaria. No se subieron cambios.');
for(const [p,s] of edits)fs.writeFileSync(p,s,'utf8');
'@
  $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $code | node -
  if($LASTEXITCODE -ne 0){throw 'Fallo la actualizacion local.'}
  & clasp push
  if($LASTEXITCODE -ne 0){throw 'Fallo la subida.'}
  & clasp deploy -i $deployment -d 'Rechazo desde Panel Secretaria'
  if($LASTEXITCODE -ne 0){throw 'Fallo la publicacion.'}
  Write-Host 'Rechazo publicado. Recarga el Panel con Ctrl + F5.'
}finally{Pop-Location}
