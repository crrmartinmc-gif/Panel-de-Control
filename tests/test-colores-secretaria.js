/* Prueba de estilos por dependencia y estado, sin usar datos ni backend real. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ui=fs.readFileSync('secretaria-panel.js','utf8');
const css=fs.readFileSync('secretaria-panel.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const start=ui.indexOf('function s5NormalizarEtiqueta(valor)');
const end=ui.indexOf('const dia=()=>',start);
assert.ok(start>=0&&end>start,'funciones de etiquetas declaradas');
const ctx={};
vm.runInNewContext(ui.slice(start,end)+
  ';globalThis.colores={area:s5CodigoArea,estado:s5CodigoEstado};',ctx);
const area=ctx.colores.area,estado=ctx.colores.estado;
let n=0;
function check(cond,msg){assert.ok(cond,msg);n++}
for(const [raw,codigo] of [
  ['CUENCAS','cuencas'],['cuencas','cuencas'],
  ['Educación','educacion'],['EDUCACION','educacion'],
  ['Cambio Climático','cambio-climatico'],[' CAMBIO CLIMATICO ','cambio-climatico'],
  ['Gobernanza','gobernanza'],['Reciclado','reciclado'],
  ['Impulsoras','impulsoras'],['Microbasurales','microbasurales'],['Micro Basurales','microbasurales'],
  ['Área nueva','general'],['','general'],[null,'general']
])check(area(raw)===codigo,'área '+String(raw));
for(const [raw,codigo] of [
  ['PENDIENTE','pendiente'],['En Revisión','revision'],['EN_REVISION','revision'],
  ['Reprogramada','reprogramada'],['PREASIGNADA','preasignada'],
  ['CONFIRMADA','confirmada'],['Aceptada','aceptada'],['EN CURSO','en-curso'],
  ['FINALIZADA','finalizada'],['CANCELADA','cancelada'],['Rechazada','rechazada'],
  ['Estado no previsto','general'],[null,'general']
])check(estado(raw)===codigo,'estado '+String(raw));
for(const codigo of ['cuencas','educacion','cambio-climatico','gobernanza','reciclado','impulsoras','microbasurales','general'])
  check(css.includes('.s5-area--'+codigo+'{'),'estilo de área '+codigo);
for(const codigo of ['pendiente','revision','reprogramada','preasignada','confirmada','aceptada','en-curso','finalizada','cancelada','rechazada','general'])
  check(css.includes('.s5-state--'+codigo),'estilo de estado '+codigo);
check(ui.includes('s5CodigoArea(t.dependencia)'), 'usa color de dependencia del traslado');
check(ui.includes('s5CodigoEstado(t.estado)'), 'usa color del estado real');
check(ui.includes('e(t.dependencia||'),'no permite HTML inyectado en dependencia');
check(ui.includes('e(t.estado||'),'no permite HTML inyectado en estado');
check(index.includes('./secretaria-panel.js?v=colores2'),'versión JS actualizada');
check(index.includes('./secretaria-panel.css?v=colores2'),'versión CSS actualizada');
check(ui.includes("await ejecutar('secretariaAsignar'"),'acciones de asignación intactas');
check(ui.includes("await ejecutar('secretariaReservar'"),'acciones de reserva intactas');
console.log('OK: '+n+' verificaciones de colores, etiquetas y acciones de Secretaría.');
