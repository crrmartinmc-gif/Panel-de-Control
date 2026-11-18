/* Contrato de interfaz: no se ocultan bloqueados ni se habilita su asignación. */
const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('secretaria-panel.js','utf8');
const css=fs.readFileSync('secretaria-panel.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const backend=fs.readFileSync('backend/Secretaria_Fase5A.gs','utf8');
let n=0;
function check(c,msg){assert.ok(c,msg);n++}
check(ui.includes('const cs=Array.isArray(r.datos.choferes)?r.datos.choferes:[]'),'consulta choferes sin ocultar indisponibles');
check(ui.includes('const libres=items.filter(x=>x.disponible),bloqueados=items.filter(x=>!x.disponible)'),'separa libres y bloqueados');
check(ui.includes('" disabled>'),'opción no disponible explícitamente deshabilitada');
check(ui.includes('e(motivo(x))'),'escapa descripciones no confiables');
check(ui.includes('id="s5guardar"'),'conserva botón para guardar');
check(ui.includes('(!(hayChofer&&hayVehiculo)?\' disabled'),'bloquea botón sin ambos recursos disponibles');
check(ui.includes("await ejecutar('secretariaAsignar',{idSolicitud:id,idChofer,idVehiculo})"),'mantiene acción de guardar');
check(css.includes('.s5diagnostico'),'muestra motivos visibles');
check(index.includes('secretaria-panel.js?v=diagnostico1'),'actualiza JS de Github Pages');
check(index.includes('secretaria-panel.css?v=diagnostico1'),'actualiza CSS de Github Pages');
check(backend.includes('detalleC=new Map()'),'backend entrega detalles de bloqueos');
check(backend.includes('const motivo=!activo?\'Cuenta inactiva\''),'no habilita cuentas inactivas');
check(backend.includes("s5Norm_(a.ESTADO_OPERATIVO)!=='DISPONIBLE'")===false,'se actualizó expresión de estado sin omitir control');
check(backend.includes("estado!=='DISPONIBLE'"),'unidades no disponibles siguen bloqueadas');
check(backend.includes("if(!r.choferes.some(a=>a.id===chofer&&a.disponible)||!r.vehiculos.some(a=>a.id===vehiculo&&a.disponible))"),
  'el backend exige disponibilidad en asignación');
console.log('OK '+n+' verificaciones del diagnóstico, sin alterar autorización de asignaciones.');
