const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function panel(viajes,inspecciones=[]){
 const ctx=vm.createContext({normalizar:v=>String(v||'').trim().toUpperCase(),DVContract:{timestamp:v=>Date.parse(v)||0},estadoPanel:{viajes,inspecciones}});
 vm.runInContext(html.slice(html.indexOf('function numeroKMVehiculo('),html.indexOf('function obtenerUltimoServiceVehiculo(')),ctx);return ctx;
}
const unidad={ID_VEHICULO:'V1',AREA:'SECRETARIA',KM_ACTUAL:100};
test('Secretaría conserva el KM oficial aunque un viaje abierto tenga otro KM inicial',()=>{
 const ctx=panel([{ID_VEHICULO:'V1',KM_INICIAL:150,KM_FINAL:'',ESTADO:'EN CURSO'}]);assert.equal(ctx.obtenerKMActualVehiculo(unidad),100);
});
test('no baja el odómetro ni mezcla unidades o viajes cancelados',()=>{
 const ctx=panel([{ID_VEHICULO:'V1',KM_INICIAL:90,KM_FINAL:95},{ID_VEHICULO:'V2',KM_FINAL:900},{ID_VEHICULO:'V1',KM_FINAL:1000,ESTADO:'CANCELADO'}]);assert.equal(ctx.obtenerKMActualVehiculo(unidad),100);
});
test('toma el KM oficial actualizado y conserva comportamiento de otras áreas',()=>{
 const ctx=panel([{ID_VEHICULO:'V1',KM_INICIAL:150,KM_FINAL:180}]);assert.equal(ctx.obtenerKMActualVehiculo({...unidad,KM_ACTUAL:180}),180);assert.equal(ctx.obtenerKMActualVehiculo({...unidad,AREA:'LOGISTICA AMBIENTAL'}),100);
});
const backend=fs.readFileSync(path.join(__dirname,'../backend/Codigo-Completo-Backend-Maestro.txt'),'utf8');
function inicio(fotosOk=true){
 const cambios=[];
 const ctx=vm.createContext({Number,CONFIG:{HOJAS:{VIAJES:'VIAJES',VEHICULOS:'VEHICULOS'}},validarChoferSecretaria_:()=>({usuario:{ID_USUARIO:'U1'},chofer:{ID_CHOFER:'C1'}}),validarCampos_:()=>{},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},vehiculoSecretariaHabilitado_:()=>({ID_VEHICULO:'V1',KM_ACTUAL:100}),normalizarKilometraje_:Number,obtenerViajes:()=>[],generarID_:()=> 'VIA1',ahora_:()=> 'ahora',insertarObjeto_:(_,v)=>v,registrarFotosSalida_:()=>({registradas:fotosOk?4:3,errores:[],faltantes:[]}),asegurarColumnaVehiculosKM_:()=>cambios.push('columna'),actualizarPorID_:(...args)=>cambios.push(args),registrarEvento_:()=>{}});
 vm.runInContext(backend.slice(backend.indexOf('function iniciarViajeSecretaria_('),backend.indexOf('function finalizarViajeSecretaria_(')),ctx);
 return {ctx,cambios,payload:{idVehiculo:'V1',kmInicial:150,fotos:{frente:'a',trasera:'b',lateral_derecho:'c',lateral_izquierdo:'d'}}};
}
test('inicio de Secretaría persiste KM_ACTUAL después de confirmar cuatro fotos',()=>{
 const {ctx,cambios,payload}=inicio();assert.equal(ctx.iniciarViajeSecretaria_(payload).ok,true);assert.equal(cambios[0],'columna');assert.equal(cambios[1][0],'VEHICULOS');assert.equal(cambios[1][2],'V1');assert.equal(cambios[1][3].KM_ACTUAL,150);
});
test('inicio rechazado o fotos incompletas no modifican el odómetro',()=>{
 const {ctx,cambios,payload}=inicio(false);assert.throws(()=>ctx.iniciarViajeSecretaria_(payload),/cuatro fotos/);assert.equal(cambios.length,0);assert.throws(()=>ctx.iniciarViajeSecretaria_({...payload,kmInicial:50}),/menor/);assert.equal(cambios.length,0);
});

