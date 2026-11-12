const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../dv-contract.js');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function get(start,end){const a=html.indexOf(start);assert(a>=0,start);return html.slice(a,html.indexOf(end,a));}
function harness(){
 const sources={},layers=[];
 const map={getStyle:()=>({layers:layers.slice(),sources}),getLayer:id=>layers.find(l=>l.id===id),getPaintProperty:(id,key)=>layers.find(l=>l.id===id)?.paint?.[key],setPaintProperty:(id,key,value)=>{layers.find(l=>l.id===id).paint[key]=value;},removeLayer:id=>{const i=layers.findIndex(l=>l.id===id);if(i>=0)layers.splice(i,1)},getSource:id=>sources[id],removeSource:id=>delete sources[id],addSource:(id,s)=>{sources[id]={...s,setData(d){this.data=d;}}},addLayer:l=>layers.push(l),on:()=>{}};
 const ctx=vm.createContext({DVContract:C,Date,console:{info:()=>{}},document:{getElementById:()=>null},dvMap:map,dvMapReady:true,dvMapGpsHandlersBound:false,dvMapHistoricoData:[],dvMapReclamos:[],dvMapEvidencias:[],DV_MAP_COLORS:['green','blue','orange'],dvOrdenarCapasMapa:()=>{},dvReclamoRealizado:()=>false});
 for(const [start,end] of [['function dvEscapar','function dvCrearMapa'],['function dvColorPorNombre','function dvHoraTexto'],['function dvActualizarGpsFiltradoSinDestruirCapas','function dvCentrarReclamosFiltrados']])vm.runInContext(get(start,end),ctx);
 return {ctx,sources,layers};
}
test('usuarios con el mismo nombre conservan posiciones y recorridos separados',()=>{
 const {ctx,sources,layers}=harness(),now=Date.now();
 const pts=[{usuario:'pablo',nombre:'Pablo Vazquez',latitud:-34.7,longitud:-58.4,timestamp:new Date(now-4000).toISOString(),activo:1,idRecorrido:'r1'},
 {usuario:'javi',nombre:'Pablo Vazquez',latitud:'-34,8',longitud:'-58,5',timestamp:new Date(now-3000).toISOString(),activo:1,idRecorrido:'r2'},
 {usuario:'pablo',nombre:'Pablo Vazquez',latitud:-34.7001,longitud:-58.4001,timestamp:new Date(now-1000).toISOString(),activo:0,idRecorrido:'r1'}];
 ctx.dvActualizarGpsFiltradoSinDestruirCapas(pts);
 const features=sources['dv-gps-puntos'].data.features;assert.equal(features.length,2);
 const p=features.find(f=>f.properties.usuario==='pablo');assert.deepEqual(Array.from(p.geometry.coordinates),[-58.4001,-34.7001]);assert.equal(p.properties.estado,'Recorrido finalizado');
 const j=features.find(f=>f.properties.usuario==='javi');assert.deepEqual(Array.from(j.geometry.coordinates),[-58.5,-34.8]);
 assert.equal(layers.filter(l=>l.id.startsWith('dv-route-')).length,1);
 ctx.dvActualizarGpsFiltradoSinDestruirCapas(pts);assert.equal(layers.filter(l=>l.id==='dv-gps-puntos-circles').length,1);
});
test('no une recorridos distintos ni convierte coordenadas vacías en cero',()=>{
 const {ctx,sources,layers}=harness(),now=Date.now();
 ctx.dvActualizarGpsFiltradoSinDestruirCapas([
 {usuario:'a',nombre:'A',latitud:'',longitud:'',timestamp:new Date(now).toISOString()},
 {usuario:'b',nombre:'B',latitud:-34,longitud:-58,timestamp:new Date(now-200000).toISOString(),idRecorrido:'uno'},
 {usuario:'b',nombre:'B',latitud:-34.0001,longitud:-58,timestamp:new Date(now-190000).toISOString(),idRecorrido:'dos'}]);
 assert.equal(sources['dv-gps-puntos'].data.features.length,1);assert.equal(layers.filter(l=>l.id.startsWith('dv-route-')).length,0);
 assert.equal(sources['dv-gps-puntos'].data.features[0].properties.estado,'Sin señal reciente');
});
test('sintaxis de todos los scripts del Panel',()=>{for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});


test('un refresco reutiliza las fuentes; quitar filtros retira solo segmentos obsoletos',()=>{
 const {ctx,sources,layers}=harness(),now=Date.now();
 const points=[{usuario:'a',nombre:'A',latitud:-34,longitud:-58,timestamp:new Date(now-3000).toISOString(),idRecorrido:'uno'},{usuario:'a',nombre:'A',latitud:-34.0001,longitud:-58,timestamp:new Date(now-1000).toISOString(),idRecorrido:'uno'}];
 ctx.dvActualizarGpsFiltradoSinDestruirCapas(points);const route=sources['dv-route-0'],point=sources['dv-gps-puntos'];
 ctx.dvActualizarGpsFiltradoSinDestruirCapas(points);assert.equal(sources['dv-route-0'],route);assert.equal(sources['dv-gps-puntos'],point);assert.equal(layers.filter(l=>l.id==='dv-route-0-line').length,1);
 sources['dv-route-huerfana']={};ctx.dvActualizarGpsFiltradoSinDestruirCapas([]);assert.equal(sources['dv-route-0'],undefined);assert.equal(sources['dv-route-huerfana'],undefined);assert.equal(sources['dv-gps-puntos'],point);assert.equal(point.data.features.length,0);
});
