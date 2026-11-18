/**
 * SECRETARIA_F5A — Panel Maestro conectado a APPSECRETARIA.
 * Operaciones locales. No escribe SERVICIOS/VIAJES/VEHICULOS del Maestro.
 * Las funciones se invocan SOLO desde panelGet/panelPost tras validar sesión.
 */
const S5_SHEET_ID = '1she1uE-xhfXmElSfAX4zbAvR5zsKaJCrdogyzk3E9EQ';
function s5Auth_(sesion) {
  if (!sesion || String(sesion.usuario||'').trim().toLowerCase()!=='secretaria' ||
      !esRolConsultaServicios_(sesion.rol)) throw Error('PERMISO_DENEGADO: solo Secretaría.');
}
function s5Norm_(v){return String(v==null?'':v).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function s5Now_(){return new Date().toISOString();}
function s5Today_(){return Utilities.formatDate(new Date(),CONFIG.ZONA_HORARIA,'yyyy-MM-dd');}
function s5Date_(v,visible){
  if(v instanceof Date)return Utilities.formatDate(v,CONFIG.ZONA_HORARIA,'yyyy-MM-dd');
  const x=String(v||visible||'').trim();
  if(/^\d{4}-\d\d-\d\d/.test(x))return x.slice(0,10);
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(x);
  return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';
}
// Google Sheets puede mostrar 9:30, 09:30, 9:30:00 o 9:30 a. m.
// Normalizar al reloj local HH:mm evita rechazar reservas de la mañana.
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
function s5Open_(){
  const id=String(PropertiesService.getScriptProperties().getProperty('SEC_SOLICITUDES_SPREADSHEET_ID')||S5_SHEET_ID).trim();
  if(id===obtenerSpreadsheet_().getId())throw Error('APPSECRETARIA y Maestro no pueden ser la misma planilla.');
  return SpreadsheetApp.openById(id);
}
function s5Read_(ss,name,req){
  const sh=ss.getSheetByName(name);if(!sh)throw Error('Falta hoja '+name+' en APPSECRETARIA.');
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String);
  (req||[]).forEach(c=>{if(!h.includes(c))throw Error('Falta '+name+'.'+c)});
  if(sh.getLastRow()<2)return [];
  const rg=sh.getRange(2,1,sh.getLastRow()-1,h.length),vals=rg.getValues(),vis=rg.getDisplayValues();
  return vals.map((a,i)=>{const r={_row:i+2};h.forEach((k,j)=>{
    let v=a[j];
    if(k==='FECHA_SERVICIO'||k==='FECHA_PROPUESTA')v=s5Date_(v,vis[i][j]);
    else if(k==='HORA_INICIO_PREVISTA')v=s5Hora_(vis[i][j]||v);
    else if(v instanceof Date)v=v.toISOString();
    r[k]=v==null?'':v;
  });return r;}).filter(o=>Object.keys(o).some(k=>k!=='_row'&&String(o[k]).trim()));
}
function s5Append_(ss,name,data){
  const sh=ss.getSheetByName(name),h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  sh.appendRow(h.map(k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:''));
}
function s5Patch_(ss,name,row,patch){
  const sh=ss.getSheetByName(name),h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],
        a=sh.getRange(row._row,1,1,h.length).getValues()[0];
  Object.keys(patch).forEach(k=>{const i=h.indexOf(k);if(i<0)throw Error('Falta columna '+name+'.'+k);a[i]=patch[k];});
  sh.getRange(row._row,1,1,h.length).setValues([a]);
}
function s5ID_(p){return p+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();}
function s5Active_(a){return !['CANCELADA','ANULADA','REEMPLAZADA'].includes(s5Norm_(a.ESTADO));}
function s5Ctx_(){
  const ss=s5Open_();
  return {ss,
    sol:s5Read_(ss,'SOLICITUDES',['ID_SOLICITUD','FECHA_SERVICIO','HORA_INICIO_PREVISTA','ESTADO','ORIGEN','DESTINO_FINAL']),
    tr:s5Read_(ss,'TRAMOS',['ID_SOLICITUD','MINUTOS_ESTIMADOS']),
    ag:s5Read_(ss,'AGENDA',['ID_AGENDA','ID_SOLICITUD','INICIO_RESERVA','FIN_RESERVA','ESTADO','MINUTOS_MARGEN']),
    as:s5Read_(ss,'ASIGNACIONES',['ID_ASIGNACION_LOCAL','ID_SOLICITUD','ID_AGENDA','ID_CHOFER_MAESTRO','ID_VEHICULO_MAESTRO','ESTADO'])};
}
function s5Item_(c,id){
  const s=c.sol.find(t=>String(t.ID_SOLICITUD)===id);if(!s)throw Error('Solicitud no encontrada.');
  const ag=c.ag.filter(t=>t.ID_SOLICITUD===id&&s5Norm_(t.ESTADO)==='RESERVADA');
  const as=c.as.filter(t=>t.ID_SOLICITUD===id&&s5Active_(t));
  if(ag.length>1||as.length>1)throw Error('Hay reservas o asignaciones duplicadas: revisar APPSECRETARIA.');
  const dur=c.tr.filter(t=>t.ID_SOLICITUD===id).reduce((n,t)=>n+Number(t.MINUTOS_ESTIMADOS||0),0);
  return {s,r:ag[0]||null,a:as[0]||null,dur};
}
function s5Window_(s,dur,margen){
  const f=String(s.FECHA_SERVICIO),h=s5Hora_(s.HORA_INICIO_PREVISTA);
  if(!/^\d{4}-\d\d-\d\d$/.test(f)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h))
    throw Error('Fecha u hora de traslado inválida.');
  const n=Number(dur),m=Number(margen);
  if(!Number.isInteger(n)||n<1||!Number.isInteger(m)||m<0||m>240)throw Error('Duración o margen inválidos.');
  const ini=Date.parse(f+'T'+h+':00-03:00');
  if(!Number.isFinite(ini))throw Error('Fecha inválida.');
  return {inicio:new Date(ini).toISOString(),fin:new Date(ini+(n+m)*60000).toISOString()};
}
function s5CurrentWindow_(x){
  if(!x.r)throw Error('Primero reservá el horario.');
  const w=s5Window_(x.s,x.dur,x.r.MINUTOS_MARGEN);
  if(Date.parse(w.inicio)!==Date.parse(x.r.INICIO_RESERVA)||Date.parse(w.fin)!==Date.parse(x.r.FIN_RESERVA))
    throw Error('Reserva desactualizada; renovala antes de asignar.');
  return w;
}
function s5Resources_(c,id,x){
  const w=s5CurrentWindow_(x),date=x.s.FECHA_SERVICIO,C=new Set(),V=new Set();
  obtenerAsignaciones().forEach(a=>{
    if(s5Date_(a.FECHA)!==date||['CANCELADA','ANULADA','FINALIZADA','CERRADA','INACTIVA'].includes(s5Norm_(a.ESTADO)))return;
    if(a.ID_CHOFER)C.add(String(a.ID_CHOFER));if(a.ID_VEHICULO)V.add(String(a.ID_VEHICULO));
  });
  obtenerViajes().forEach(a=>{
    if(s5Date_(a.FECHA)!==date||!['EN CURSO','EN_CURSO','ACTIVO','INICIADO','EN RECORRIDO'].includes(s5Norm_(a.ESTADO)))return;
    if(a.ID_CHOFER)C.add(String(a.ID_CHOFER));if(a.ID_VEHICULO)V.add(String(a.ID_VEHICULO));
  });
  c.as.filter(a=>s5Active_(a)&&a.ID_SOLICITUD!==id).forEach(a=>{
    const otro=c.sol.find(s=>s.ID_SOLICITUD===a.ID_SOLICITUD);
    if(otro&&otro.FECHA_SERVICIO!==date)return;
    const ar=c.ag.find(t=>t.ID_AGENDA===a.ID_AGENDA);
    const choca=!ar||!Number.isFinite(Date.parse(ar.INICIO_RESERVA))||!Number.isFinite(Date.parse(ar.FIN_RESERVA))||
      (Date.parse(w.inicio)<Date.parse(ar.FIN_RESERVA)&&Date.parse(w.fin)>Date.parse(ar.INICIO_RESERVA));
    if(choca){if(a.ID_CHOFER_MAESTRO)C.add(String(a.ID_CHOFER_MAESTRO));if(a.ID_VEHICULO_MAESTRO)V.add(String(a.ID_VEHICULO_MAESTRO));}
  });
  const ids=new Set(leerTabla_(CONFIG.HOJAS.USUARIOS).filter(u=>s5Norm_(u.ROL)==='CHOFER_SECRETARIA'&&s5Norm_(u.ESTADO)==='ACTIVO'&&u.ID_CHOFER).map(u=>String(u.ID_CHOFER)));
  const choferes=obtenerChoferes().filter(a=>ids.has(String(a.ID_CHOFER))).map(a=>{
    const motivo=s5Norm_(a.ESTADO)!=='ACTIVO'?'Inactivo':C.has(String(a.ID_CHOFER))?'Ocupado':'';
    return {id:String(a.ID_CHOFER),nombre:String(a.NOMBRE),disponible:!motivo,motivo};
  }).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  const vehiculos=obtenerVehiculos().filter(a=>s5Norm_(a.AREA)==='SECRETARIA').map(a=>{
    const motivo=!['SI','SÍ','TRUE','1'].includes(s5Norm_(a.ACTIVO))?'Unidad inactiva':
      s5Norm_(a.ESTADO_OPERATIVO)!=='DISPONIBLE'?'No disponible':V.has(String(a.ID_VEHICULO))?'Ocupado':'';
    return {id:String(a.ID_VEHICULO),nombre:[a.DOMINIO,a.INTERNO,a.MARCA,a.MODELO].filter(Boolean).join(' · '),disponible:!motivo,motivo};
  }).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  return {ok:true,choferes,vehiculos,asignacion:x.a?{id:x.a.ID_ASIGNACION_LOCAL,estado:x.a.ESTADO}:null,ventana:w};
}
function s5Recursos_(p){
  const id=String(p.idSolicitud||''),c=s5Ctx_(),x=s5Item_(c,id);
  return s5Resources_(c,id,x);
}
function s5Agenda_(p){
  const hoy=s5Today_(),desde=String(p.desde||hoy),hasta=String(p.hasta||hoy);
  if(!/^\d{4}-\d\d-\d\d$/.test(desde)||!/^\d{4}-\d\d-\d\d$/.test(hasta)||hasta<desde||
     Date.parse(hasta)-Date.parse(desde)>31*86400000)throw Error('Rango de agenda inválido.');
  const c=s5Ctx_(),ch=new Map(obtenerChoferes().map(a=>[String(a.ID_CHOFER),a.NOMBRE])),
    ve=new Map(obtenerVehiculos().map(a=>[String(a.ID_VEHICULO),[a.DOMINIO,a.INTERNO].filter(Boolean).join(' · ')]));
  const de=new Map(s5Read_(c.ss,'DEPENDENCIAS',['ID_DEPENDENCIA','NOMBRE']).map(a=>[String(a.ID_DEPENDENCIA),a.NOMBRE]));
  const us=new Map(s5Read_(c.ss,'USUARIOS',['ID_USUARIO','NOMBRE']).map(a=>[String(a.ID_USUARIO),a.NOMBRE]));
  const items=c.sol.filter(s=>s.FECHA_SERVICIO>=desde&&s.FECHA_SERVICIO<=hasta).map(s=>{
    const x=s5Item_(c,String(s.ID_SOLICITUD)),r=x.r,a=x.a;
    return {id:String(s.ID_SOLICITUD),fecha:s.FECHA_SERVICIO,hora:s.HORA_INICIO_PREVISTA,origen:s.ORIGEN,destino:s.DESTINO_FINAL,
      pasajeros:Number(s.PASAJEROS||0),estado:s.ESTADO,duracion:x.dur,dependencia:de.get(String(s.ID_DEPENDENCIA))||'',
      solicitante:us.get(String(s.ID_SOLICITANTE))||'',
      reserva:r?{id:r.ID_AGENDA,inicio:r.INICIO_RESERVA,fin:r.FIN_RESERVA,margen:Number(r.MINUTOS_MARGEN)}:null,
      asignacion:a?{id:a.ID_ASIGNACION_LOCAL,estado:a.ESTADO,chofer:ch.get(String(a.ID_CHOFER_MAESTRO))||a.ID_CHOFER_MAESTRO,
        vehiculo:ve.get(String(a.ID_VEHICULO_MAESTRO))||a.ID_VEHICULO_MAESTRO}:null};
  }).sort((a,b)=>(a.fecha+' '+a.hora).localeCompare(b.fecha+' '+b.hora));
  return {ok:true,desde,hasta,items,resumen:{total:items.length,pendientes:items.filter(x=>['PENDIENTE','EN_REVISION','REPROGRAMADA'].includes(s5Norm_(x.estado))).length,
    reservadas:items.filter(x=>x.reserva).length,preasignadas:items.filter(x=>x.asignacion).length},modo:'LOCAL'};
}
function s5Audit_(c,id,sesion,tipo,detalle){
  try{s5Append_(c.ss,'EVENTOS',{ID_EVENTO:s5ID_('EVT'),FECHA_SERVIDOR:s5Now_(),ID_SOLICITUD:id,ID_USUARIO:sesion.idUsuario,
    ORIGEN:'PANEL_SECRETARIA',TIPO:tipo,DESCRIPCION:detalle,ID_OPERACION:s5ID_('OP')});}
  catch(e){console.warn('Registro principal guardado; auditoría pendiente: '+e.message);}
}
function s5Post_(action,p,sesion){
  const id=String(p.idSolicitud||'').trim();
  if(!/^SOL-[\w-]{6,40}$/.test(id))throw Error('Solicitud inválida.');
  if(!['secretariaReservar','secretariaAsignar','secretariaLiberar','secretariaConfirmar'].includes(action))
    throw Error('Acción no habilitada.');
  const lk=LockService.getScriptLock();lk.waitLock(30000);
  try{
    const c=s5Ctx_(),x=s5Item_(c,id),s=x.s,estado=s5Norm_(s.ESTADO);
    if(['CANCELADA','RECHAZADA'].includes(estado))throw Error('Solicitud cerrada.');
    if(s.FECHA_SERVICIO<s5Today_())throw Error('No se pueden modificar fechas anteriores.');
    if(action==='secretariaReservar'){
      if(x.a)throw Error('Liberá primero la preasignación.');
      const m=Number(p.margen),w=s5Window_(s,x.dur,m);
      if(Date.parse(w.fin)<=Date.now())throw Error('El horario ya terminó.');
      c.ag.filter(a=>a.ID_SOLICITUD===id&&s5Norm_(a.ESTADO)==='RESERVADA').forEach(a=>
        s5Patch_(c.ss,'AGENDA',a,{ESTADO:'REEMPLAZADA',FECHA_ACTUALIZACION:s5Now_()}));
      const idAgenda=s5ID_('AGE');s5Append_(c.ss,'AGENDA',{ID_AGENDA:idAgenda,ID_SOLICITUD:id,INICIO_RESERVA:w.inicio,
        FIN_RESERVA:w.fin,MINUTOS_MARGEN:m,ESTADO:'RESERVADA',FECHA_ACTUALIZACION:s5Now_()});
      s5Audit_(c,id,sesion,'AGENDA_RESERVADA','Reserva de horario desde Panel Secretaría');return {ok:true,estado:'RESERVADA',idAgenda};
    }
    if(action==='secretariaAsignar'){
      const w=s5CurrentWindow_(x);if(Date.parse(w.fin)<=Date.now())throw Error('La reserva finalizó.');
      const chofer=String(p.idChofer||''),vehiculo=String(p.idVehiculo||'');
      if(x.a){
        if(x.a.ID_CHOFER_MAESTRO===chofer&&x.a.ID_VEHICULO_MAESTRO===vehiculo)
          return {ok:true,id:x.a.ID_ASIGNACION_LOCAL,estado:x.a.ESTADO,reintento:true};
        throw Error('Ya hay una preasignación: liberala antes de cambiar.');
      }
      const r=s5Resources_(c,id,x);
      if(!r.choferes.some(a=>a.id===chofer&&a.disponible)||!r.vehiculos.some(a=>a.id===vehiculo&&a.disponible))
        throw Error('Chofer o vehículo fuera de Secretaría u ocupado.');
      const asignacion=s5ID_('ASL');
      s5Append_(c.ss,'ASIGNACIONES',{ID_ASIGNACION_LOCAL:asignacion,ID_SOLICITUD:id,ID_AGENDA:x.r.ID_AGENDA,
        ID_CHOFER_MAESTRO:chofer,ID_VEHICULO_MAESTRO:vehiculo,ESTADO:'PREASIGNADA',FECHA_ASIGNACION:s5Now_()});
      s5Audit_(c,id,sesion,'PREASIGNACION_LOCAL','Recursos preasignados desde Panel Secretaría');
      return {ok:true,id:asignacion,estado:'PREASIGNADA'};
    }
    if(action==='secretariaLiberar'){
      if(!x.a||s5Norm_(x.a.ESTADO)!=='PREASIGNADA'||x.a.ID_SERVICIO_MAESTRO||estado==='CONFIRMADA')
        throw Error('La preasignación no se puede liberar.');
      const motivo=String(p.motivo||'').trim().slice(0,400);
      if(motivo.length<5)throw Error('Ingresá motivo de al menos 5 caracteres.');
      s5Patch_(c.ss,'ASIGNACIONES',x.a,{ESTADO:'CANCELADA'});
      s5Audit_(c,id,sesion,'PREASIGNACION_LIBERADA',motivo);
      return {ok:true,estado:'LIBERADA'};
    }
    if(action==='secretariaConfirmar'){
      if(!x.a||s5Norm_(x.a.ESTADO)!=='PREASIGNADA'||!x.r)throw Error('Reservá y preasigná antes de confirmar.');
      if(estado==='CONFIRMADA')return {ok:true,estado:'CONFIRMADA',reintento:true};
      const w=s5CurrentWindow_(x);if(Date.parse(w.fin)<=Date.now())throw Error('La reserva venció.');
      const r=s5Resources_(c,id,x);
      if(!r.choferes.some(a=>a.id===String(x.a.ID_CHOFER_MAESTRO)&&a.disponible)||
         !r.vehiculos.some(a=>a.id===String(x.a.ID_VEHICULO_MAESTRO)&&a.disponible))
        throw Error('Los recursos dejaron de estar disponibles.');
      s5Patch_(c.ss,'SOLICITUDES',s,{ESTADO:'CONFIRMADA',FECHA_MODIFICACION:s5Now_()});
      s5Audit_(c,id,sesion,'CONFIRMACION_SECRETARIA','Solicitud confirmada localmente');
      try{s5Append_(c.ss,'NOTIFICACIONES',{ID_NOTIFICACION:s5ID_('NOT'),ID_USUARIO:s.ID_SOLICITANTE,ID_SOLICITUD:id,
        TIPO:'ESTADO',MENSAJE:'Traslado confirmado por Secretaría.',FECHA_CREACION:s5Now_()});}
      catch(e){console.warn('Confirmada; notificación pendiente: '+e.message);}
      return {ok:true,estado:'CONFIRMADA',entregadoAlChofer:false};
    }
  } finally{lk.releaseLock();}
}
