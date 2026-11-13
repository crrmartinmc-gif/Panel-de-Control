const {test}=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
function fragment(a,b){const i=html.indexOf(a);assert(i>=0,a);return html.slice(i,html.indexOf(b,i));}
function network(fetch){
 let token='sesion-a';
 const c={BACKEND_URL:'https://example.test/exec',fetch,sessionStorage:{getItem:()=>token},console:{error(){}},Map,Promise,URLSearchParams,AbortController,setTimeout,clearTimeout};
 vm.createContext(c);vm.runInContext(fragment('const PANEL_MAX_LECTURAS=','/*\n   Se conserva para futuras operaciones'),c);
 return {c,session:v=>token=v};
}
const ok=datos=>({ok:true,json:async()=>({ok:true,datos})});
test('comparte lecturas simultáneas equivalentes sin guardar respuestas antiguas',async()=>{
 let calls=0,release;const {c}=network(()=>{calls++;return new Promise(r=>release=()=>r(ok([calls])));});
 const a=c.leerBackend('viajes',{b:2,a:1}),b=c.leerBackend('viajes',{a:'1',b:'2'});assert.equal(a,b);await new Promise(r=>setImmediate(r));assert.equal(calls,1);release();await a;
 const fresh=c.leerBackend('viajes',{a:1,b:2});await new Promise(r=>setImmediate(r));assert.equal(calls,2);release();await fresh;
});
test('nunca supera cuatro lecturas activas; un error libera la cola',async()=>{
 let active=0,max=0,calls=0;const {c}=network(async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;if(calls===4)throw Error('fallo controlado');return ok([]);});
 await Promise.all(Array.from({length:14},(_,i)=>c.leerBackend('accion-'+i)));assert.equal(calls,14);assert.ok(max<=4);assert.equal(active,0);
});
test('una escritura evita compartir una lectura anterior y cambiar sesión descarta su resultado',async()=>{
 const releases=[];const {c,session}=network(()=>new Promise(r=>releases.push(()=>r(ok([])))));
 const old=c.leerBackend('vehiculos');c.panelInvalidarLecturas();const fresh=c.leerBackend('vehiculos');assert.notEqual(old,fresh);await new Promise(r=>setImmediate(r));assert.equal(releases.length,2);session('sesion-b');releases.forEach(f=>f());assert.equal(await old,null);assert.equal(await fresh,null);
});
test('una petición en espera de otra sesión no se envía con el nuevo usuario',async()=>{
 const releases=[];let calls=0;const {c,session}=network(()=>{calls++;return new Promise(r=>releases.push(()=>r(ok([]))));});
 const jobs=Array.from({length:5},(_,i)=>c.leerBackend('a'+i));await new Promise(r=>setImmediate(r));assert.equal(calls,4);session('sesion-b');releases.forEach(f=>f());await Promise.all(jobs);assert.equal(calls,4);
});
test('el refresco de GPS dibuja una vez y no consulta cuando el mapa está oculto',async()=>{
 let fetches=0,renders=0,visible=true;const c={dvGpsCargaEnCurso:false,dvMap:{isStyleLoaded:()=>true},dvMapReady:true,panelMapaOperativoVisible:()=>visible,leerMapaDiaVerdeCompleto:async()=>{fetches++;return {gps:[],historico:[]};},DVContract:{gpsSignature:()=> 'nueva'},dvGpsLastSuccess:0,dvGpsLastError:'',dvMapUltimaFirma:'vieja',dvGuardarCache(){},dvPoblarFiltrosMapa(){},dvClaimsLastSuccess:Date.now(),dvRefrescarReclamosCompartidos:async()=>{},dvActualizarGpsFiltradoSinDestruirCapas:()=>renders++,dvFiltrarGpsMapa:()=>[],dvActualizarEstadoFiltroMapa(){},Date,console};vm.createContext(c);vm.runInContext(fragment('async function actualizarGpsDiaVerde(','function iniciarMapaDiaVerde(){'),c);
 await c.actualizarGpsDiaVerde();assert.equal(renders,1);visible=false;await c.actualizarGpsDiaVerde();assert.equal(fetches,1);
});
test('las correcciones se vuelven a leer cuando cambia su contenido, incluso desde otra pestaña',()=>{
 let raw='{"a":{"lat":-34,"lng":-58}}';const c={DV_RECLAMO_COORD_OVERRIDES_KEY:'coords',localStorage:{getItem:()=>raw,setItem:(_,v)=>raw=v},console,Date};vm.createContext(c);vm.runInContext(fragment('let dvCorreccionesTextoCache=','async function dvCargarCorreccionesRemotas(){'),c);
 const first=c.dvCargarCorreccionesReclamos();assert.equal(c.dvCargarCorreccionesReclamos(),first);c.dvGuardarCorreccionLocal('b',-35,-59);assert.equal(c.dvCargarCorreccionesReclamos().b.lat,-35);assert.equal(first.b,undefined);raw='{}';assert.equal(Object.keys(c.dvCargarCorreccionesReclamos()).length,0);
});
test('fechas optimizadas mantienen exactamente los días argentinos del contrato anterior',()=>{
 const current=require('../dv-contract.js');
 const previous={dayKey:(value=Date.now())=>{const t=current.timestamp(value);if(t===null)return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(t));const part=k=>parts.find(p=>p.type===k)?.value;return `${part('year')}-${part('month')}-${part('day')}`;}};
 for(const value of ['2026-11-13T02:59:59Z','2026-11-13T03:00:00Z','12/11/2026','2026-01-01',null,'',0,'1899-12-30T00:00:00Z',Date.now()])assert.equal(current.dayKey(value),previous.dayKey(value));
});
test('inicio compartido conserva todos los módulos y limita a dos cargas secundarias',async()=>{
 let release,secondary=0,max=0;const calls=[];
 const names=['cargarServicios','cargarEventos','cargarAsignaciones','cargarRutas','cargarPuntosRuta','cargarViajes','cargarInspecciones','cargarReportes','cargarMantenimiento','cargarUsuarios','panelCargarEvidenciasVehiculos'];
 const c={panelSesionLectura:()=>"fixture",panelEpocaLecturas:0,console,Promise,Date,setTimeout,panelEsConsultaServicios:()=>false,estadoPanel:{vehiculos:[]},filtrarVehiculos:()=>calls.push('render'),probarConexion:()=>new Promise(r=>release=()=>r(true)),cargarResumenPanel:async()=>calls.push('resumen'),cargarVehiculos:async flag=>{calls.push('vehiculos');assert.equal(flag,false);},cargarChoferes:async()=>calls.push('choferes')};
 for(const name of names)c[name]=async()=>{calls.push(name);secondary++;max=Math.max(max,secondary);await new Promise(r=>setTimeout(r,1));secondary--;};
 vm.createContext(c);vm.runInContext(fragment('let panelInicioEnCurso=null;','/* ========================================================='),c);
 const a=c.actualizarDatosTurboInicial(),b=c.actualizarDatosTurboInicial();assert.equal(a,b);assert.deepEqual(calls,['resumen','vehiculos','choferes']);release();await a;assert.ok(max<=2);for(const name of names)assert.equal(calls.filter(x=>x===name).length,1,name);assert.equal(calls.at(-1),'render');
});
test('varios clics de Actualizar comparten el refresco completo',async()=>{
 let count=0,release;const c={panelEpocaLecturas:0,panelActualizarDatosCompleto:()=>{count++;return new Promise(r=>release=r);}};vm.createContext(c);vm.runInContext(fragment('let panelActualizacionTotal=null;','async function panelActualizarDatosCompleto(){'),c);const a=c.actualizarDatos(),b=c.actualizarDatos();assert.equal(a,b);assert.equal(count,1);release();await a;
});

test('un refresco posterior a guardar no comparte el refresco anterior',async()=>{
 const releases=[];const c={panelEpocaLecturas:0,panelActualizarDatosCompleto:()=>new Promise(r=>releases.push(r))};vm.createContext(c);vm.runInContext(fragment('let panelActualizacionTotal=null;','async function panelActualizarDatosCompleto(){'),c);const old=c.actualizarDatos();c.panelEpocaLecturas++;const fresh=c.actualizarDatos();assert.notEqual(old,fresh);releases[0]();await old;assert.equal(c.actualizarDatos(),fresh);releases[1]();await fresh;
});
