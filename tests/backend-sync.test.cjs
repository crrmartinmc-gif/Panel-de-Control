const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function context(){
 const ctx=vm.createContext({console:{warn:()=>{}},normalizarClaveDV_:s=>String(s??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),dvNormalizarClaveCorreccion_:s=>String(s??'').trim().toUpperCase(),dvClaveDireccionCorreccion_:(...x)=>x.map(v=>String(v??'').trim().toUpperCase()).join('|'),dvSepararDireccionCorreccion_:()=>({calle:'Prueba',numero:'123'}),obtenerCorreccionesReclamosDiaVerde_:()=>[{clave:'lomas|este|prueba|123',direccion:'Prueba 123',localidad:'Lomas',zona:'Este',latitud:-34.77,longitud:-58.4}]});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../backend/Sincronizacion-Dia-Verde.txt'),'utf8'),ctx);return ctx;
}
test('una corrección no ubica en otro CGM una calle con el mismo nombre y altura',()=>{
 const ctx=context(),a={clave:'lomas|este|prueba|123',localidad:'Lomas',zona:'Este',calle:'Prueba',numero:'123'},b={...a,clave:'banfield|este|prueba|123',localidad:'Banfield'};
 const [corrected,other]=ctx.aplicarCorreccionesReclamosDiaVerde_([a,b]);assert.equal(corrected.latitud,-34.77);assert.equal(other.latitud,undefined);
});
test('el histórico conserva foto, ID, usuario y GPS; los campos vacíos siguen ausentes',()=>{
 const ctx=context();const out=ctx.dvSyncHistorico_([{FECHA:'11/11/2026',HORA:'22:00',DIRECCIÓN:'Prueba 123',FOTO:'https://example.test/foto',ID_EVIDENCIA:'ev-1',USUARIO:'prueba',CLAVE_RECLAMO:'lomas|este|prueba|123',LATITUD:'-34,77',LONGITUD:'-58,4',PRECISION:''}])[0];
 assert.equal(out.foto,'https://example.test/foto');assert.equal(out.idEvidencia,'ev-1');assert.equal(out.usuario,'prueba');assert.equal(out.latitud,-34.77);assert.equal(out.precision,null);assert.equal(out.direccion,'Prueba 123');
});
