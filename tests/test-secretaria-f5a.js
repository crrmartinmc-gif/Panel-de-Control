/* Pruebas de Fase 5A con planillas simuladas: no modifican datos del municipio. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('backend/Secretaria_Fase5A.gs','utf8');
const hd={
 SOLICITUDES:['ID_SOLICITUD','ID_SOLICITANTE','ID_DEPENDENCIA','FECHA_SERVICIO','HORA_INICIO_PREVISTA','ESTADO','ORIGEN','DESTINO_FINAL','PASAJEROS','FECHA_MODIFICACION'],
 TRAMOS:['ID_SOLICITUD','MINUTOS_ESTIMADOS'],AGENDA:['ID_AGENDA','ID_SOLICITUD','INICIO_RESERVA','FIN_RESERVA','MINUTOS_MARGEN','ESTADO','FECHA_ACTUALIZACION'],
 ASIGNACIONES:['ID_ASIGNACION_LOCAL','ID_SOLICITUD','ID_AGENDA','ID_SERVICIO_MAESTRO','ID_CHOFER_MAESTRO','ID_VEHICULO_MAESTRO','ESTADO','FECHA_ASIGNACION'],
 USUARIOS:['ID_USUARIO','NOMBRE'],DEPENDENCIAS:['ID_DEPENDENCIA','NOMBRE'],EVENTOS:['ID_EVENTO','ID_SOLICITUD','TIPO','FECHA_SERVIDOR'],
 NOTIFICACIONES:['ID_NOTIFICACION','ID_USUARIO','ID_SOLICITUD','TIPO','MENSAJE','FECHA_CREACION']
};
const db=Object.fromEntries(Object.entries(hd).map(([k,v])=>[k,[v]]));
const hoy=new Date(),manana=new Date(Date.now()+86400000).toISOString().slice(0,10),id='SOL-TEST1234567890';
function add(table,obj){db[table].push(hd[table].map(x=>Object.prototype.hasOwnProperty.call(obj,x)?obj[x]:''));}
add('SOLICITUDES',{ID_SOLICITUD:id,ID_SOLICITANTE:'u',ID_DEPENDENCIA:'d',FECHA_SERVICIO:manana,HORA_INICIO_PREVISTA:'10:00',ORIGEN:'KIOSHI',DESTINO_FINAL:'PALACIO',ESTADO:'PENDIENTE',PASAJEROS:3});
add('TRAMOS',{ID_SOLICITUD:id,MINUTOS_ESTIMADOS:30});
add('USUARIOS',{ID_USUARIO:'u',NOMBRE:'Solicitante'});
add('DEPENDENCIAS',{ID_DEPENDENCIA:'d',NOMBRE:'Dependencia'});
const sheet=t=>({
 getLastRow:()=>db[t].length,getLastColumn:()=>hd[t].length,
 getRange:(r,c,n,m)=>({
  getValues:()=>db[t].slice(r-1,r-1+n).map(a=>a.slice(c-1,c-1+m)),
  getDisplayValues:()=>db[t].slice(r-1,r-1+n).map(a=>a.slice(c-1,c-1+m).map(String)),
  setValues:values=>values.forEach((a,i)=>db[t][r-1+i].splice(c-1,m,...a))
 }),
 appendRow:r=>db[t].push(r)
});
const ss={getId:()=> 'appsecretaria-id-12345678901234567890',getSheetByName:t=>hd[t]?sheet(t):null};
const ocupacionesMaestro=[],viajesMaestro=[],cuentasMaestro=[{ROL:'CHOFER_SECRETARIA',ESTADO:'ACTIVO',ID_CHOFER:'sec'},{ROL:'CHOFER_LOGISTICA',ESTADO:'ACTIVO',ID_CHOFER:'log'}];
const vehiculosMaestro=[{ID_VEHICULO:'v-sec',DOMINIO:'AG213WY',INTERNO:'1',AREA:'SECRETARIA',ESTADO_OPERATIVO:'DISPONIBLE',ACTIVO:'SI'}];
let clicks=0;const formatDate=(d,zone,fmt)=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
 return fmt==='yyyy-MM-dd'?p.year+'-'+p.month+'-'+p.day:p.hour+':'+p.minute;
};
const context={console,Date,Set,Map,Number,String,RegExp,JSON,Math,Error,Array,
 CONFIG:{ZONA_HORARIA:'America/Argentina/Buenos_Aires',HOJAS:{USUARIOS:'USUARIOS'}},
 esRolConsultaServicios_:r=>['CONSULTA_SERVICIOS','SERVICIOS_LECTURA','LECTOR_SERVICIOS'].includes(r),
 obtenerSpreadsheet_:()=>({getId:()=> 'maestro-id-12345678901234567890'}),
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>ss.getId()})},
 SpreadsheetApp:{openById:()=>ss},Utilities:{formatDate,getUuid:()=>('AAAAAAAA-AAAA-BBBB-CCCC-'+String(++clicks).padStart(12,'0'))},
 LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
 leerTabla_:t=>t==='USUARIOS'?cuentasMaestro:[], 
 obtenerChoferes:()=>[{ID_CHOFER:'sec',NOMBRE:'Secretaría',ESTADO:'ACTIVO'},{ID_CHOFER:'log',NOMBRE:'Logística',ESTADO:'ACTIVO'}],
 obtenerVehiculos:()=>vehiculosMaestro, 
 obtenerAsignaciones:()=>ocupacionesMaestro,obtenerViajes:()=>viajesMaestro
};
vm.createContext(context);vm.runInContext(source,context);
let total=0;const check=(cond,msg)=>{assert.ok(cond,msg);total++};
for(const u of [{usuario:'logistica',rol:'CONSULTA_SERVICIOS'},{usuario:'secretaria',rol:'ADMINISTRADOR'}]){
 try{context.s5Auth_(u);throw Error('allowed')}catch(e){check(e.message.includes('PERMISO_DENEGADO'),'denegar cuenta/rol')}
}
context.s5Auth_({usuario:'secretaria',rol:'CONSULTA_SERVICIOS'});total++;
let a=context.s5Agenda_({desde:manana,hasta:manana});check(a.items.length===1&&a.items[0].origen==='KIOSHI','agenda compartida');
let r=context.s5Post_('secretariaReservar',{idSolicitud:id,margen:15},{idUsuario:'secuser'});check(r.ok&&db.AGENDA.length===2,'reserva');
let recursos=context.s5Recursos_({idSolicitud:id});check(recursos.choferes.length===1&&recursos.choferes[0].id==='sec','no mostrar Logística');
check(recursos.vehiculos.length===1&&recursos.vehiculos[0].id==='v-sec','solo vehículo Secretaría');
try{context.s5Post_('secretariaAsignar',{idSolicitud:id,idChofer:'log',idVehiculo:'v-sec'},{idUsuario:'secuser'});throw Error('allowed')}
catch(e){check(e.message.includes('fuera de Secretaría'),'rechazar chofer de Logística')}
r=context.s5Post_('secretariaAsignar',{idSolicitud:id,idChofer:'sec',idVehiculo:'v-sec'},{idUsuario:'secuser'});
check(r.ok&&db.ASIGNACIONES.length===2,'preasignación guardada');
r=context.s5Post_('secretariaAsignar',{idSolicitud:id,idChofer:'sec',idVehiculo:'v-sec'},{idUsuario:'secuser'});
check(r.reintento&&db.ASIGNACIONES.length===2,'idempotencia');
r=context.s5Post_('secretariaConfirmar',{idSolicitud:id},{idUsuario:'secuser'});
check(r.ok&&r.entregadoAlChofer===false,'confirmación sin enviar a Choferes');
check(context.s5Agenda_({desde:manana,hasta:manana}).items[0].estado==='CONFIRMADA','estado actualizado');
check(db.NOTIFICACIONES.length===2,'notificación al solicitante');
try{context.s5Post_('secretariaLiberar',{idSolicitud:id,motivo:'Cambio de unidad'},{idUsuario:'secuser'});throw Error('allowed')}
catch(e){check(e.message.includes('no se puede liberar'),'no liberar confirmadas')}

for(const [entrada,esperado] of [['9:30','09:30'],['09:30','09:30'],['9:30:00','09:30'],['9:30 a. m.','09:30'],['9:30 AM','09:30'],['12:00 a. m.','00:00'],['12:15 p. m.','12:15'],['9:30 PM','21:30'],['24:00',''],['9:60',''],['sin horario','']]){
 check(context.s5Hora_(entrada)===esperado,'normalizar horario '+entrada);
}
const idCorto='SOL-TEST0930ABCDEF';
add('SOLICITUDES',{ID_SOLICITUD:idCorto,ID_SOLICITANTE:'u',ID_DEPENDENCIA:'d',
 FECHA_SERVICIO:manana,HORA_INICIO_PREVISTA:'9:30',ORIGEN:'KIOSHI',
 DESTINO_FINAL:'JARDIN',ESTADO:'PENDIENTE',PASAJEROS:1});
add('TRAMOS',{ID_SOLICITUD:idCorto,MINUTOS_ESTIMADOS:25});
const agendaCorta=context.s5Agenda_({desde:manana,hasta:manana});
check(agendaCorta.items.find(x=>x.id===idCorto).hora==='09:30','agenda normaliza hora 9:30 sin cambiar la celda');
const horaGuardada=db.SOLICITUDES.find(r=>r[0]===idCorto)[hd.SOLICITUDES.indexOf('HORA_INICIO_PREVISTA')];
check(horaGuardada==='9:30','no modifica horario original en la planilla');
const reservada=context.s5Post_('secretariaReservar',{idSolicitud:idCorto,margen:15},{idUsuario:'secuser'});
check(reservada.ok===true,'acepta Reserva de traslado de 9:30 y 25 min');
const entrada=db.AGENDA.find((r,i)=>i>0&&r[hd.AGENDA.indexOf('ID_SOLICITUD')]===idCorto);
check(!!entrada,'reserva nueva añadida sin duplicar otros servicios');
const inicio=entrada[hd.AGENDA.indexOf('INICIO_RESERVA')],fin=entrada[hd.AGENDA.indexOf('FIN_RESERVA')];
check(Date.parse(inicio)===Date.parse(manana+'T09:30:00-03:00'),'conserva 09:30 de Buenos Aires');
check((Date.parse(fin)-Date.parse(inicio))/60000===40,'25 minutos de traslado + 15 de margen');


// Diagnóstico de recursos: incluir los bloqueados, sin habilitar su selección.
ocupacionesMaestro.push({FECHA:manana,ESTADO:'ASIGNADO',ID_CHOFER:'sec',ID_VEHICULO:'v-sec'});
cuentasMaestro.push({ROL:'CHOFER_SECRETARIA',ESTADO:'INACTIVO',ID_CHOFER:'sec-inactivo',NOMBRE:'Chofer de prueba inactivo'});
vehiculosMaestro.push({ID_VEHICULO:'v-fuera',DOMINIO:'CRONOS-PRUEBA',AREA:'SECRETARIA',
  ESTADO_OPERATIVO:'FUERA DE SERVICIO',ACTIVO:'SI'});
let diag=context.s5Recursos_({idSolicitud:idCorto});
const ocupado=diag.choferes.find(x=>x.id==='sec');
check(ocupado&&!ocupado.disponible&&ocupado.motivo==='Ocupado','chofer ocupado es visible, deshabilitado');
check(ocupado.detalle.includes('día completo'),'mostrar motivo de ocupación del Maestro');
const cuentaInactiva=diag.choferes.find(x=>x.id==='sec-inactivo');
check(cuentaInactiva&&!cuentaInactiva.disponible&&cuentaInactiva.motivo==='Cuenta inactiva','mostrar cuenta inactiva sin autorizar');
const vOcupado=diag.vehiculos.find(x=>x.id==='v-sec');
check(vOcupado&&!vOcupado.disponible&&vOcupado.motivo==='Ocupado','vehículo ocupado se muestra deshabilitado');
const vFuera=diag.vehiculos.find(x=>x.id==='v-fuera');
check(vFuera&&!vFuera.disponible&&vFuera.motivo==='Fuera de servicio','mostrar unidad fuera de servicio');
try{context.s5Post_('secretariaAsignar',{idSolicitud:idCorto,idChofer:'sec',idVehiculo:'v-sec'},{idUsuario:'secuser'});throw Error('allowed')}
catch(e){check(/fuera de Secretaría u ocupado/i.test(e.message),'sigue bloqueada la preasignación de ocupados');}
console.log('OK: '+total+' verificaciones de integración F5A, sin tocar datos reales');
