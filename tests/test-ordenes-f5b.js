/* F5B: pruebas aisladas de seguridad y aceptación, sin Google Sheets reales. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('backend/Ordenes_Choferes_F5B.gs','utf8');
const datos={
 sol:[{ID_SOLICITUD:'SOL-ORDEN123456789',ESTADO:'CONFIRMADA',FECHA_SERVICIO:'2026-11-18',HORA_INICIO_PREVISTA:'10:00',ORIGEN:'Municipalidad',DESTINO_FINAL:'Parque',PASAJEROS:3}],
 as:[{ID_SOLICITUD:'SOL-ORDEN123456789',ID_CHOFER_MAESTRO:'cho-sec',ID_VEHICULO_MAESTRO:'veh-sec',ID_ASIGNACION_LOCAL:'ASL-01',ESTADO:'PREASIGNADA'}],
 tr:[{ID_SOLICITUD:'SOL-ORDEN123456789',MINUTOS_ESTIMADOS:30}],
 events:[],patches:[]
};
const tokens=new Map(),users=[
 {USUARIO:'javier',ID_CHOFER:'cho-sec',ROL:'CHOFER_SECRETARIA',ESTADO:'ACTIVO',APLICACION:'CHOFERES'},
 {USUARIO:'martin',ID_CHOFER:'cho-ambiental',ROL:'CHOFER',ESTADO:'ACTIVO',APLICACION:'CHOFERES'}
];
let uuidN=0,tests=0;
const test=(v,m)=>{assert.ok(v,m);tests++};
const c={
 Date,JSON,Math,Map,Set,Array,String,Number,Error,console,
 CONFIG:{HOJAS:{USUARIOS:'USUARIOS',CHOFERES:'CHOFERES',VEHICULOS:'VEHICULOS'}},
 Utilities:{getUuid:()=>('00000000-0000-4000-8000-'+String(++uuidN).padStart(12,'0'))},
 CacheService:{getScriptCache:()=>({get:k=>tokens.get(k)||null,put:(k,v)=>tokens.set(k,v)})},
 LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
 normalizar_:s=>String(s||'').trim().toUpperCase(),
 autenticar_:(u,p,app)=>{
  const f=users.find(x=>x.USUARIO===u);
  if(p!=='TEST_PASSWORD'||!f||app!=='CHOFERES')throw Error('Credenciales inválidas.');
  return {ok:true,usuario:{USUARIO:u,ID_CHOFER:f.ID_CHOFER,ROL:f.ROL}};
 },
 leerTabla_:t=>t==='USUARIOS'?users:[],
 obtenerPorID_:(t,key,id)=>{
  if(t==='CHOFERES')return id==='cho-sec'?{NOMBRE:'MANSILLA JAVIER',ESTADO:'ACTIVO'}:
    id==='cho-ambiental'?{NOMBRE:'LOGÍSTICA',ESTADO:'ACTIVO'}:null;
  return id==='veh-sec'?{AREA:'SECRETARIA'}:null;
 },
 obtenerVehiculos:()=>[{ID_VEHICULO:'veh-sec',DOMINIO:'AD614FO',INTERNO:'3',AREA:'SECRETARIA'}],
 s5Ctx_:()=>({ss:{},sol:datos.sol,as:datos.as,tr:datos.tr}),
 s5Today_:()=> '2026-11-17',
 s5Norm_:s=>String(s||'').toUpperCase(),
 s5Active_:a=>!['CANCELADA','ANULADA'].includes(a.ESTADO),
 s5Now_:()=> '2026-11-17T21:00:00.000Z',
 s5Patch_:(ss,hoja,fila,patch)=>{Object.assign(fila,patch);datos.patches.push({hoja,patch})},
 s5Append_:(ss,hoja,obj)=>{datos.events.push({hoja,...obj})},
 s5ID_:p=>p+'-TEST'
};
vm.createContext(c);vm.runInContext(source,c);
try{c.c5LoginOrdenSecretaria_({usuario:'javier',contrasena:'WRONG'});throw Error('No rechazó')}
catch(e){test(/inválida/.test(e.message),'exigir contraseña válida')}
try{c.c5LoginOrdenSecretaria_({usuario:'martin',contrasena:'TEST_PASSWORD'});throw Error('No rechazó')}
catch(e){test(/no es chofer de Secretaría/.test(e.message),'denegar chofer de otra área')}
const ses=c.c5LoginOrdenSecretaria_({usuario:'javier',contrasena:'TEST_PASSWORD'});
test(ses.ok&&ses.token.length===64,'emitir sesión corta independiente');
try{c.c5Orders_({tokenOrdenes:'invalid'});throw Error('No rechazó')}
catch(e){test(/Sesión/.test(e.message),'denegar token inválido')}
const list=c.c5Orders_({tokenOrdenes:ses.token});
test(list.items.length===1,'mostrar orden confirmada propia');
test(list.items[0].dominio==='AD614FO','mostrar vehículo propio');
test(list.items[0].origen==='Municipalidad','mostrar recorrido');
const ack=c.c5Aceptar_({tokenOrdenes:ses.token,idSolicitud:'SOL-ORDEN123456789'});
test(ack.ok&&ack.estado==='ACEPTADA','aceptar orden');
test(datos.as[0].ESTADO==='ACEPTADA'&&!!datos.as[0].FECHA_CONFIRMACION_CHOFER,'guardar estado y hora');
test(datos.events.some(x=>x.TIPO==='ORDEN_ACEPTADA'),'guardar auditoría');
const again=c.c5Aceptar_({tokenOrdenes:ses.token,idSolicitud:'SOL-ORDEN123456789'});
test(again.reintento===true&&datos.events.length===1,'idempotencia sin eventos duplicados');
const otro=c.c5LoginOrdenSecretaria_;users[1].ROL='CHOFER_SECRETARIA';
const b=otro({usuario:'martin',contrasena:'TEST_PASSWORD'});
try{c.c5Aceptar_({tokenOrdenes:b.token,idSolicitud:'SOL-ORDEN123456789'});throw Error('No rechazó')}
catch(e){test(/otro chofer/.test(e.message),'evitar aceptar órdenes ajenas')}
datos.sol[0].ESTADO='CANCELADA';
test(c.c5Orders_({tokenOrdenes:ses.token}).items.length===0,'ocultar solicitudes no confirmadas');
console.log('OK: '+tests+' pruebas F5B con datos simulados. Viajes y kilometrajes intactos.');
