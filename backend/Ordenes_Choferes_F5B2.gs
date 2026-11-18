/**
 * FASE 5B.2: vincula inicio/cierre de App Choferes con APPSECRETARIA.
 * Solo actúa cuando el payload lleva ID_SOLICITUD y hay una orden ACEPTADA.
 * Viajes independientes, fotos, KM, RECORRIDOS e IndexedDB conservan su motor.
 * No crea SERVICIOS ni ASIGNACIONES en el Maestro.
 */
const C52_HOJA = 'VIAJES_ORDENES';
const C52_HEADERS = [
  'ID_SOLICITUD','ID_ASIGNACION_LOCAL','ID_VIAJE_MAESTRO',
  'ID_CHOFER_MAESTRO','ID_VEHICULO_MAESTRO','ESTADO',
  'HORA_INICIO','HORA_FIN','KM_INICIAL','KM_FINAL','FECHA_ACTUALIZACION'
];
function c52EnlaceHoja_(ss,crear){
  let h=ss.getSheetByName(C52_HOJA);
  if(!h && crear){
    h=ss.insertSheet(C52_HOJA);
    h.getRange(1,1,1,C52_HEADERS.length).setValues([C52_HEADERS]);
    h.setFrozenRows(1);
  }
  if(!h)return null;
  const headers=h.getRange(1,1,1,h.getLastColumn()).getDisplayValues()[0];
  if(C52_HEADERS.length!==headers.length||C52_HEADERS.some((col,i)=>col!==headers[i]))
    throw Error('La hoja VIAJES_ORDENES tiene encabezados inesperados. No se escribió el enlace.');
  return h;
}
function c52Links_(ss,crear){
  if(!c52EnlaceHoja_(ss,crear))return [];
  return s5Read_(ss,C52_HOJA,C52_HEADERS);
}
function c52Find_(links,idSolicitud,idViaje){
  return links.find(x=>
    (idSolicitud && String(x.ID_SOLICITUD)===String(idSolicitud))||
    (idViaje && String(x.ID_VIAJE_MAESTRO)===String(idViaje)))||null;
}
function c52Orden_(d){
  const auth=c5Auth_(d),v=validarChoferSecretaria_(d);
  if(String(auth.idChofer)!==String(v.chofer.ID_CHOFER) ||
     String(auth.usuario).trim().toLowerCase()!==String(d.usuario||'').trim().toLowerCase())
    throw Error('La sesión de órdenes no coincide con el chofer que inicia el viaje.');
  const id=String(d.idSolicitud||'').trim();
  if(!/^SOL-[\w-]{6,40}$/.test(id))throw Error('ID de solicitud inválido.');
  const ctx=s5Ctx_(),sol=ctx.sol.find(x=>String(x.ID_SOLICITUD)===id);
  if(!sol)throw Error('El traslado fue eliminado o no existe.');
  const as=ctx.as.filter(x=>String(x.ID_SOLICITUD)===id&&s5Active_(x));
  if(as.length!==1)throw Error('Traslado sin una única asignación válida.');
  const a=as[0];
  if(String(a.ID_CHOFER_MAESTRO)!==String(auth.idChofer) ||
     String(a.ID_VEHICULO_MAESTRO)!==String(d.idVehiculo||''))
    throw Error('El chofer o vehículo no coincide con la orden de Secretaría.');
  if(String(a.ID_ASIGNACION_LOCAL)!==String(d.idAsignacionLocal||''))
    throw Error('La asignación local cambió. Actualizá las órdenes.');
  const unidad=obtenerPorID_(CONFIG.HOJAS.VEHICULOS,'ID_VEHICULO',a.ID_VEHICULO_MAESTRO);
  if(!unidad||s5Norm_(unidad.AREA)!=='SECRETARIA')throw Error('La unidad ya no corresponde al área Secretaría.');
  return {ctx,sol,a,auth,id};
}
function c52FechaInicio_(d,s){
  const fecha=String(s.FECHA_SERVICIO||'');
  const hh=String(s.HORA_INICIO_PREVISTA||'').slice(0,5);
  if(!/^\d{4}-\d\d-\d\d$/.test(fecha)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hh))
    throw Error('La solicitud no tiene fecha y hora válidas.');
  const programada=Date.parse(fecha+'T'+hh+':00-03:00');
  const inicio=Date.parse(String(d.horaInicio||''));
  if(!Number.isFinite(inicio)||inicio>Date.now()+600000)
    throw Error('La hora de inicio registrada en el celular no es válida.');
  if(inicio<programada-90*60000||inicio>programada+24*60*60000)
    throw Error('Este traslado está fuera de la ventana de inicio. Consultá a Secretaría.');
}
function c52EstadoInicio_(orden,viaje,km){
  const {ctx,sol,a,id}=orden,lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const links=c52Links_(ctx.ss,true);
    const x=c52Find_(links,id,viaje.ID_VIAJE);
    if(x && (String(x.ID_SOLICITUD)!==id || String(x.ID_VIAJE_MAESTRO)!==String(viaje.ID_VIAJE) ||
      String(x.ID_CHOFER_MAESTRO)!==String(a.ID_CHOFER_MAESTRO) ||
      String(x.ID_VEHICULO_MAESTRO)!==String(a.ID_VEHICULO_MAESTRO)))
      throw Error('Se detectó otro viaje vinculado a esta solicitud o viaje. Revisar antes de continuar.');
    if(x && s5Norm_(x.ESTADO)==='FINALIZADA')return;
    const now=s5Now_();
    if(!x)s5Append_(ctx.ss,C52_HOJA,{
      ID_SOLICITUD:id,ID_ASIGNACION_LOCAL:a.ID_ASIGNACION_LOCAL,
      ID_VIAJE_MAESTRO:viaje.ID_VIAJE,ID_CHOFER_MAESTRO:a.ID_CHOFER_MAESTRO,
      ID_VEHICULO_MAESTRO:a.ID_VEHICULO_MAESTRO,
      ESTADO:'EN_CURSO',HORA_INICIO:viaje.HORA_INICIO||now,
      KM_INICIAL:viaje.KM_INICIAL??km,FECHA_ACTUALIZACION:now
    });
    else s5Patch_(ctx.ss,C52_HOJA,x,{
      ESTADO:'EN_CURSO',HORA_INICIO:viaje.HORA_INICIO||now,
      KM_INICIAL:viaje.KM_INICIAL??km,FECHA_ACTUALIZACION:now
    });
    const fresh=s5Ctx_(),item=s5Item_(fresh,id);
    if(item.a && String(item.a.ID_ASIGNACION_LOCAL)===String(a.ID_ASIGNACION_LOCAL) &&
       !['FINALIZADA','EN_CURSO'].includes(s5Norm_(item.a.ESTADO)))
      s5Patch_(fresh.ss,'ASIGNACIONES',item.a,{ESTADO:'EN_CURSO'});
    if(s5Norm_(item.s.ESTADO)==='CONFIRMADA')
      s5Patch_(fresh.ss,'SOLICITUDES',item.s,{ESTADO:'EN_CURSO'});
  } finally {lock.releaseLock();}
}
function c52Iniciar_(d){
  // Los viajes independientes de Secretaría conservan exactamente su circuito.
  if(!d.idSolicitud && !d.idAsignacionLocal)return iniciarViajeSecretaria_(d);
  if(!d.idSolicitud||!d.idAsignacionLocal)throw Error('La orden de Secretaría está incompleta.');
  const orden=c52Orden_(d),est=s5Norm_(orden.a.ESTADO);
  if(!['ACEPTADA','EN_CURSO'].includes(est))
    throw Error('Primero el chofer debe aceptar la orden en App Choferes.');
  const idViaje=String(d.idViaje||'').trim();
  if(!/^[A-Za-z0-9_-]{8,96}$/.test(idViaje))throw Error('Identificador de viaje inválido.');
  const links=c52Links_(orden.ctx.ss,false);
  const link=c52Find_(links,orden.id,idViaje);
  if(link && String(link.ID_VIAJE_MAESTRO)!==idViaje)
    throw Error('Esta orden ya se inició con otro identificador de viaje.');
  if(!link)c52FechaInicio_(d,orden.sol);
  if(s5Norm_(orden.sol.ESTADO)!=='CONFIRMADA' &&
    !(s5Norm_(orden.sol.ESTADO)==='EN_CURSO' && link))
    throw Error('La solicitud no se encuentra confirmada para iniciar.');
  const resp=iniciarViajeSecretaria_(d);
  const v=resp?.viaje||resp;
  const fotos=resp?.FOTOS_SALIDA;
  if(v?.ID_VIAJE===idViaje && Number(fotos?.registradas)===4 &&
     !(fotos?.errores||[]).length && !(fotos?.faltantes||[]).length)
     c52EstadoInicio_(orden,v,d.kmInicial);
  return resp;
}
function c52EstadoCierre_(ss,link,viaje){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const all=c52Links_(ss,true),fresh=all.find(x=>String(x.ID_VIAJE_MAESTRO)===String(viaje.ID_VIAJE));
    if(!fresh)throw Error('No se encontró el enlace del traslado para su cierre.');
    const now=s5Now_();
    if(s5Norm_(fresh.ESTADO)!=='FINALIZADA')
      s5Patch_(ss,C52_HOJA,fresh,{ESTADO:'FINALIZADA',HORA_FIN:viaje.HORA_FIN||now,
        KM_FINAL:viaje.KM_FINAL,FECHA_ACTUALIZACION:now});
    const ctx=s5Ctx_(),item=s5Item_(ctx,String(link.ID_SOLICITUD));
    if(item.a && String(item.a.ID_ASIGNACION_LOCAL)===String(link.ID_ASIGNACION_LOCAL) &&
       s5Norm_(item.a.ESTADO)!=='FINALIZADA')
      s5Patch_(ctx.ss,'ASIGNACIONES',item.a,{ESTADO:'FINALIZADA'});
    if(s5Norm_(item.s.ESTADO)!=='FINALIZADA')
      s5Patch_(ctx.ss,'SOLICITUDES',item.s,{ESTADO:'FINALIZADA'});
  }finally{lock.releaseLock();}
}
function c52Finalizar_(d){
  // Jamás depender de APPSECRETARIA para cerrar un viaje independiente.
  if(!d.idSolicitud)return finalizarViajeSecretaria_(d);
  const idViaje=String(d.idViaje||'').trim();
  if(!idViaje)throw Error('Para cerrar el traslado falta el ID de viaje.');
  const ss=s5Open_(),link=c52Find_(c52Links_(ss,false),String(d.idSolicitud),idViaje);
  if(!link)throw Error('No se encontró el vínculo del traslado. Esperá a que se sincronice el inicio.');
  if(String(link.ID_VIAJE_MAESTRO)!==idViaje)throw Error('El vínculo no coincide con este viaje.');
  if(d.idSolicitud && String(link.ID_SOLICITUD)!==String(d.idSolicitud))
    throw Error('El traslado vinculado no coincide con el cierre.');
  const auth=c5Auth_(d),v=validarChoferSecretaria_(d);
  if(String(auth.idChofer)!==String(v.chofer.ID_CHOFER)||
     String(auth.idChofer)!==String(link.ID_CHOFER_MAESTRO)||
     String(link.ID_VEHICULO_MAESTRO)!==String(d.idVehiculo))
    throw Error('No estás autorizado para cerrar este traslado.');
  const resp=finalizarViajeSecretaria_(d),viaje=resp?.viaje||resp;
  if(String(viaje?.ID_VIAJE)!==idViaje||s5Norm_(viaje.ESTADO)!=='FINALIZADO')
    throw Error('El Maestro no confirmó el cierre del viaje. Se mantuvo pendiente.');
  c52EstadoCierre_(ss,link,viaje);
  return resp;
}
function c52Orders_(d){
  const auth=c5Auth_(d),ctx=s5Ctx_(),hoy=s5Today_();
  const hasta=new Date(Date.parse(hoy+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
  const units=new Map(obtenerVehiculos().map(v=>[String(v.ID_VEHICULO),v]));
  const links=c52Links_(ctx.ss,false);
  const items=ctx.as.filter(a=>String(a.ID_CHOFER_MAESTRO)===String(auth.idChofer) &&
    ['PREASIGNADA','ACEPTADA','EN_CURSO','FINALIZADA'].includes(s5Norm_(a.ESTADO))).map(a=>{
    const s=ctx.sol.find(x=>String(x.ID_SOLICITUD)===String(a.ID_SOLICITUD));
    if(!s||!['CONFIRMADA','EN_CURSO','FINALIZADA'].includes(s5Norm_(s.ESTADO))||
      s.FECHA_SERVICIO<hoy||s.FECHA_SERVICIO>hasta)return null;
    const unit=units.get(String(a.ID_VEHICULO_MAESTRO));
    if(!unit||s5Norm_(unit.AREA)!=='SECRETARIA')return null;
    const link=c52Find_(links,String(s.ID_SOLICITUD),'');
    const dur=ctx.tr.filter(t=>String(t.ID_SOLICITUD)===String(s.ID_SOLICITUD))
       .reduce((n,t)=>n+Number(t.MINUTOS_ESTIMADOS||0),0);
    return {id:String(s.ID_SOLICITUD),idAsignacion:String(a.ID_ASIGNACION_LOCAL),
      idVehiculo:String(a.ID_VEHICULO_MAESTRO),dominio:String(unit.DOMINIO||''),
      interno:String(unit.INTERNO||''),fecha:s.FECHA_SERVICIO,
      hora:String(s.HORA_INICIO_PREVISTA||''),origen:String(s.ORIGEN||''),
      destino:String(s.DESTINO_FINAL||''),pasajeros:Number(s.PASAJEROS||0),
      duracion:dur,estado:String(a.ESTADO||''),idViaje:String(link?.ID_VIAJE_MAESTRO||''),
      kmInicio:link?.KM_INICIAL??'',kmFinal:link?.KM_FINAL??'',
      horaInicio:link?.HORA_INICIO||'',horaFin:link?.HORA_FIN||'',
      aceptadaAt:String(a.FECHA_CONFIRMACION_CHOFER||'')};
  }).filter(Boolean).sort((a,b)=>(a.fecha+' '+a.hora).localeCompare(b.fecha+' '+b.hora));
  return {ok:true,chofer:auth.nombre,items,soloSecretaria:true,modo:'VIAJES_VINCULADOS'};
}