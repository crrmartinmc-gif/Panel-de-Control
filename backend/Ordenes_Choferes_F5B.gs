/**
 * Fase 5B.1 — Recepción y aceptación de traslados municipales en App Choferes.
 * Lee APPSECRETARIA con funciones de F5A; NO crea servicios, viajes ni modifica KM.
 * Solo acepta solicitudes CONFIRMADAS y asignadas al CHOFER_SECRETARIA autenticado.
 */
function c5LoginOrdenSecretaria_(d){
  const usuario=String(d.usuario||'').trim(),pw=String(d.contrasena||'');
  if(!usuario||!pw)throw Error('Credenciales requeridas.');
  const auth=autenticar_(usuario,pw,'CHOFERES');
  const u=auth&&auth.usuario;
  if(!auth?.ok||!u||normalizar_(u.ROL)!=='CHOFER_SECRETARIA'||!u.ID_CHOFER)
    throw Error('El usuario no es chofer de Secretaría.');
  // No almacenamos ni devolvemos contraseñas. Sesión temporaria, no reutilizable
  // para el Panel de Control ni para otros endpoints.
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('C5ORD_'+token,JSON.stringify({
    idChofer:String(u.ID_CHOFER),usuario:String(u.USUARIO),emitido:Date.now()
  }),21600);
  return {ok:true,token,expiraEnSegundos:21600};
}
function c5Auth_(d){
  const token=String(d.tokenOrdenes||'').trim();
  if(!/^[a-f0-9]{64}$/i.test(token))throw Error('Sesión de órdenes inválida. Volvé a ingresar a la app.');
  const raw=CacheService.getScriptCache().get('C5ORD_'+token);
  if(!raw)throw Error('Sesión de órdenes vencida. Cerrá sesión y volvé a ingresar.');
  const ses=JSON.parse(raw);
  const users=leerTabla_(CONFIG.HOJAS.USUARIOS);
  const u=users.find(x=>String(x.USUARIO||'').trim()===ses.usuario);
  if(!u||normalizar_(u.ESTADO)!=='ACTIVO'||normalizar_(u.ROL)!=='CHOFER_SECRETARIA'||
     !['CHOFERES','TODAS'].includes(normalizar_(u.APLICACION))||
     String(u.ID_CHOFER)!==ses.idChofer)throw Error('Cuenta de chofer sin autorización vigente.');
  const chofer=obtenerPorID_(CONFIG.HOJAS.CHOFERES,'ID_CHOFER',ses.idChofer);
  if(!chofer||normalizar_(chofer.ESTADO)!=='ACTIVO')throw Error('Legajo de chofer inactivo.');
  return {usuario:ses.usuario,idChofer:ses.idChofer,nombre:chofer.NOMBRE};
}
function c5Orders_(d){
  const auth=c5Auth_(d),ctx=s5Ctx_(),hoy=s5Today_(),hasta=new Date(Date.parse(hoy+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
  const vs=new Map(obtenerVehiculos().map(v=>[String(v.ID_VEHICULO),v]));
  const tramos=ctx.tr,sols=new Map(ctx.sol.map(s=>[String(s.ID_SOLICITUD),s]));
  const items=ctx.as.filter(a=>String(a.ID_CHOFER_MAESTRO)===auth.idChofer
      &&['PREASIGNADA','ACEPTADA','EN_CURSO','FINALIZADA'].includes(s5Norm_(a.ESTADO))).map(a=>{
    const s=sols.get(String(a.ID_SOLICITUD));
    if(!s||s5Norm_(s.ESTADO)!=='CONFIRMADA'||s.FECHA_SERVICIO<hoy||s.FECHA_SERVICIO>hasta)return null;
    const veh=vs.get(String(a.ID_VEHICULO_MAESTRO));
    if(!veh||s5Norm_(veh.AREA)!=='SECRETARIA')return null;
    const t=tramos.filter(t=>String(t.ID_SOLICITUD)===String(s.ID_SOLICITUD));
    const dur=t.reduce((n,x)=>n+Number(x.MINUTOS_ESTIMADOS||0),0);
    return {id:String(s.ID_SOLICITUD),idAsignacion:String(a.ID_ASIGNACION_LOCAL),idVehiculo:String(a.ID_VEHICULO_MAESTRO),
      dominio:String(veh.DOMINIO||''),interno:String(veh.INTERNO||''),fecha:s.FECHA_SERVICIO,
      hora:String(s.HORA_INICIO_PREVISTA||''),origen:String(s.ORIGEN||''),destino:String(s.DESTINO_FINAL||''),
      pasajeros:Number(s.PASAJEROS||0),duracion:dur,modalidad:String(s.MODALIDAD||''),
      estado:String(a.ESTADO||''),aceptadaAt:String(a.FECHA_CONFIRMACION_CHOFER||'')};
  }).filter(Boolean).sort((a,b)=>(a.fecha+' '+a.hora).localeCompare(b.fecha+' '+b.hora));
  return {ok:true,chofer:auth.nombre,items,soloSecretaria:true};
}
function c5Aceptar_(d){
  const auth=c5Auth_(d),id=String(d.idSolicitud||'').trim();
  if(!/^SOL-[a-zA-Z0-9_-]{6,40}$/.test(id))throw Error('Solicitud no válida.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ctx=s5Ctx_(),s=ctx.sol.find(x=>String(x.ID_SOLICITUD)===id);
    if(!s||s5Norm_(s.ESTADO)!=='CONFIRMADA')throw Error('La solicitud no está confirmada.');
    if(s.FECHA_SERVICIO<s5Today_())throw Error('No se puede aceptar un traslado de fecha pasada.');
    const arr=ctx.as.filter(x=>String(x.ID_SOLICITUD)===id&&s5Active_(x));
    if(arr.length!==1)throw Error('La solicitud no tiene una única preasignación activa.');
    const a=arr[0];
    if(String(a.ID_CHOFER_MAESTRO)!==auth.idChofer)throw Error('Este traslado pertenece a otro chofer.');
    const unidad=obtenerPorID_(CONFIG.HOJAS.VEHICULOS,'ID_VEHICULO',a.ID_VEHICULO_MAESTRO);
    if(!unidad||s5Norm_(unidad.AREA)!=='SECRETARIA')throw Error('El vehículo ya no corresponde a Secretaría.');
    if(s5Norm_(a.ESTADO)==='ACEPTADA')return {ok:true,estado:'ACEPTADA',reintento:true};
    if(s5Norm_(a.ESTADO)!=='PREASIGNADA')throw Error('El traslado no admite nueva aceptación.');
    const ts=s5Now_();
    s5Patch_(ctx.ss,'ASIGNACIONES',a,{ESTADO:'ACEPTADA',FECHA_CONFIRMACION_CHOFER:ts});
    try{s5Append_(ctx.ss,'EVENTOS',{ID_EVENTO:s5ID_('EVT'),FECHA_SERVIDOR:ts,ID_SOLICITUD:id,
      ORIGEN:'APP_CHOFERES_SECRETARIA',TIPO:'ORDEN_ACEPTADA',DESCRIPCION:'Chofer confirmó el traslado',
      DATOS_JSON:JSON.stringify({idAsignacion:a.ID_ASIGNACION_LOCAL,idChofer:auth.idChofer}),
      ID_OPERACION:s5ID_('OP')});}
    catch(err){console.warn('Orden aceptada, auditoría pendiente: '+err.message);}
    return {ok:true,estado:'ACEPTADA',idSolicitud:id};
  }finally{lock.releaseLock();}
}
