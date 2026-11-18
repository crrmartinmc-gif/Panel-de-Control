/* Pruebas aisladas de F5B.2, sin escritura en Google Sheets reales. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('backend/Ordenes_Choferes_F5B2.gs','utf8');
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).formatToParts(new Date(Date.now()+60*60000)).map(p=>[p.type,p.value]));
const fecha=[parts.year,parts.month,parts.day].join('-'),hora=parts.hour+':'+parts.minute;
const ts=new Date(Date.now()+60*60000).toISOString();
const s={ID_SOLICITUD:'SOL-F5B2TEST1234',FECHA_SERVICIO:fecha,HORA_INICIO_PREVISTA:hora,
  ESTADO:'CONFIRMADA',ORIGEN:'Municipalidad',DESTINO_FINAL:'Arroyo',PASAJEROS:3};
const a={ID_SOLICITUD:s.ID_SOLICITUD,ID_ASIGNACION_LOCAL:'ASL-TEST123',ID_CHOFER_MAESTRO:'ch-sec',
  ID_VEHICULO_MAESTRO:'veh-sec',ESTADO:'ACEPTADA'};
const db={sol:[s],as:[a],tr:[{ID_SOLICITUD:s.ID_SOLICITUD,MINUTOS_ESTIMADOS:30}],links:[],headers:null};
const ss={
  getSheetByName:name=>name==='VIAJES_ORDENES'&&db.headers?{
    getLastColumn:()=>db.headers.length,
    getRange:()=>({getDisplayValues:()=>[db.headers],setValues:rows=>{db.headers=rows[0]}}),
    setFrozenRows:()=>{}
  }:null,
  insertSheet:name=>{
    assert.equal(name,'VIAJES_ORDENES');
    db.headers=[];
    return {getRange:()=>({setValues:rows=>{db.headers=rows[0]}}),setFrozenRows:()=>{}};
  }
};
let starts=0,ends=0,tests=0,readLinks=0;
const test=(condition,msg)=>{assert.ok(condition,msg);tests++};
const ctx={
  console,JSON,Date,Number,String,Set,Map,Math,Error,Array,
  CONFIG:{HOJAS:{VEHICULOS:'VEHICULOS'}},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  validarChoferSecretaria_:d=>{if(d.usuario!=='javier'||d.idChofer!=='ch-sec')throw Error('Chofer inválido');return {chofer:{ID_CHOFER:'ch-sec'}}},
  c5Auth_:d=>{if(d.tokenOrdenes!=='token-valido')throw Error('Sesión inválida');return {idChofer:'ch-sec',usuario:'javier',nombre:'Mansilla Javier'}},
  s5Ctx_:()=>({ss,sol:db.sol,as:db.as,tr:db.tr}),
  s5Open_:()=>{readLinks++;return ss;},
  s5Today_:()=>fecha,
  s5Norm_:v=>String(v||'').toUpperCase(),
  s5Active_:v=>!['CANCELADA','ANULADA','REEMPLAZADA'].includes(String(v.ESTADO||'')),
  s5Item_:(c,id)=>({s:db.sol.find(x=>x.ID_SOLICITUD===id),a:db.as.find(x=>x.ID_SOLICITUD===id)}),
  s5Read_:(ss,name)=>name==='VIAJES_ORDENES'?db.links.map((x,i)=>({...x,_row:i+2})):[],
  s5Append_:(ss,name,values)=>{if(name==='VIAJES_ORDENES')db.links.push(values);else throw Error('Unexpected table');},
  s5Patch_:(ss,name,row,patch)=>Object.assign(name==='VIAJES_ORDENES'?db.links.find(x=>x.ID_VIAJE_MAESTRO===row.ID_VIAJE_MAESTRO):name==='ASIGNACIONES'?a:s,patch),
  s5Now_:()=>new Date().toISOString(),
  obtenerPorID_:(t,k,id)=>t==='VEHICULOS'&&id==='veh-sec'?{AREA:'SECRETARIA'}:null,
  obtenerVehiculos:()=>[{ID_VEHICULO:'veh-sec',DOMINIO:'AD614FO',INTERNO:'3',AREA:'SECRETARIA'}],
  iniciarViajeSecretaria_:d=>{starts++;return {ok:true,viaje:{ID_VIAJE:d.idViaje,
    ID_CHOFER:d.idChofer,ID_VEHICULO:d.idVehiculo,KM_INICIAL:d.kmInicial,
    HORA_INICIO:d.horaInicio,ESTADO:'EN CURSO'},FOTOS_SALIDA:{registradas:4,errores:[],faltantes:[]}};},
  finalizarViajeSecretaria_:d=>{ends++;return {ok:true,viaje:{ID_VIAJE:d.idViaje,
    ID_CHOFER:d.idChofer,ID_VEHICULO:d.idVehiculo,KM_FINAL:d.kmFinal,HORA_FIN:d.horaFin,ESTADO:'FINALIZADO'}};}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
const indep={accion:'iniciarViajeSecretaria',usuario:'javier',idChofer:'ch-sec',idVehiculo:'veh-sec',
  idViaje:'VIA-IND-123',kmInicial:100};
test(ctx.c52Iniciar_(indep).ok===true&&starts===1,'inicio independiente sin órdenes');
test(readLinks===0,'inicio independiente sin consultar APPSECRETARIA');
test(ctx.c52Finalizar_({...indep,kmFinal:110}).ok===true&&ends===1,'cierre independiente sin órdenes');
test(readLinks===0,'cierre independiente sin consultar APPSECRETARIA');
const d={...indep,idViaje:'VIA-ORD-987654321',horaInicio:ts,kmInicial:110,idSolicitud:s.ID_SOLICITUD,
  idAsignacionLocal:a.ID_ASIGNACION_LOCAL,tokenOrdenes:'token-valido'};
try{ctx.c52Iniciar_({...d,tokenOrdenes:'falso'});throw Error('fail')}catch(e){test(/Sesión inválida/.test(e.message),'exigir token válido');}
try{ctx.c52Iniciar_({...d,idVehiculo:'veh-otro'});throw Error('fail')}catch(e){test(/vehículo no coincide/.test(e.message),'rechazar vehículo no asignado');}
try{ctx.c52Iniciar_({...d,idAsignacionLocal:'ASL-OTRA'});throw Error('fail')}catch(e){test(/asignación local cambió/.test(e.message),'rechazar asignación alterada');}
const inicio=ctx.c52Iniciar_(d);
test(inicio.ok===true&&db.links.length===1,'inicia y vincula solo un viaje');
test(db.links[0].ID_VIAJE_MAESTRO===d.idViaje,'vínculo conserva ID del Maestro');
test(s.ESTADO==='EN_CURSO'&&a.ESTADO==='EN_CURSO','actualiza solicitud y asignación');
test(ctx.c52Orders_(d).items[0].estado==='EN_CURSO','App Choferes ve viaje en curso');
ctx.c52Iniciar_(d);
test(db.links.length===1,'reintento inicio idempotente');
try{ctx.c52Iniciar_({...d,idViaje:'VIA-OTRO-11111'});throw Error('fail')}
catch(e){test(/otro identificador/.test(e.message),'no iniciar doble viaje para la misma orden');}
const fin=ctx.c52Finalizar_({...d,kmFinal:125,horaFin:new Date().toISOString()});
test(fin.ok===true&&db.links[0].KM_FINAL===125,'registra kilometraje final en vínculo');
test(s.ESTADO==='FINALIZADA'&&a.ESTADO==='FINALIZADA','actualiza estados finalizados');
test(ctx.c52Orders_(d).items[0].estado==='FINALIZADA','App Choferes ve finalización');
ctx.c52Finalizar_({...d,kmFinal:125,horaFin:new Date().toISOString()});
test(db.links.length===1&&ends===3,'cierre idempotente sin duplicar vínculo');
console.log('OK: '+tests+' pruebas de inicio y cierre vinculados, sin modificar hojas reales.');
