const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function frag(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));}
test('jornada Día Verde sigue los cuatro días y suma Temperley con Turdera, independiente del mapa',()=>{
 const c={DVContract:require('../dv-contract.js'),dvCgmObjeto:d=>d.cgm,dvClaveReclamo:d=>d.id,dvReclamoRealizado:d=>d.hoy===true};vm.createContext(c);vm.runInContext(frag('function panelResumenJornadaDiaVerde(','function panelActualizarKpiDiaVerde('),c);
 const data=['LLAVALLOL','BANFIELD','TEMPERLEY','TURDERA','LOMAS','SANTA CATALINA'].map((cgm,i)=>({id:i,cgm,hoy:i%2===0}));
 for(const [fecha,total,realizados] of [['2026-11-09',1,1],['2026-11-10',0,0],['2026-11-11',1,0],['2026-11-12',2,1],['2026-11-13',0,0],['2026-11-14',1,1]]){const r=c.panelResumenJornadaDiaVerde([...data,data[2]],fecha);assert.equal(r.total,total,fecha);assert.equal(r.realizados,realizados,fecha);}
});
test('inspecciones resuelven nombre, dominio y servicio, con fallback para registros no vinculados',()=>{
 const c={estadoPanel:{choferes:[{ID_CHOFER:'C1',NOMBRE:'VAZQUEZ PABLO'}],vehiculos:[{ID_VEHICULO:'V1',DOMINIO:'AE459LB'}],asignaciones:[{ID_ASIGNACION:'A1',ID_SERVICIO:'S1',ID_CHOFER:'C1',ID_VEHICULO:'V1'}],servicios:[{ID_SERVICIO:'S1',NOMBRE_SERVICIO:'SECRETARIA'}]}};vm.createContext(c);vm.runInContext(frag('function panelChoferInspeccion(','function renderizarInspecciones('),c);assert.equal(c.panelChoferInspeccion('C1'),'VAZQUEZ PABLO');assert.equal(c.panelVehiculoInspeccion('V1'),'AE459LB');assert.equal(c.panelAsignacionInspeccion('A1'),'SECRETARIA');assert.equal(c.panelVehiculoInspeccion('desconocido'),'desconocido');
});
test('KM oficial 136 no se pisa con inspección histórica 444444',()=>{
 const c={normalizar:v=>String(v||'').toUpperCase(),estadoPanel:{viajes:[],inspecciones:[{ID_VEHICULO:'V1',KM_INICIAL:444444}]}};vm.createContext(c);vm.runInContext(frag('function numeroKMVehiculo(','function obtenerUltimoServiceVehiculo('),c);assert.equal(c.obtenerKMActualVehiculo({ID_VEHICULO:'V1',AREA:'SECRETARIA',KM_ACTUAL:136}),136);
});
test('carga de asignaciones aplica el filtro y el menú ya no ofrece GPS ni configuración',()=>{
 const load=frag('async function cargarAsignaciones(){','function claseEstadoAsignacion(');assert.match(load,/filtrarAsignaciones\(\)/);assert.doesNotMatch(html,/<button[^>]*onclick="mostrarPagina\('(gps|configuracion)'/);assert.match(html,/\.if6-main\{[^}]*height:auto/);assert.match(html,/\.if6-detail\{[^}]*overflow-y:auto/);
});
