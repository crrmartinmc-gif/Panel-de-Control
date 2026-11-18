/* Fase 5A: agenda local de APPSECRETARIA visible solo para usuario secretaria. */
(function(){
'use strict';
if(window.__SEC_F5A__)return;window.__SEC_F5A__=true;
const e=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dia=()=>typeof hoyArgentinaISO==='function'?hoyArgentinaISO():new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const sumar=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n,12)).toISOString().slice(0,10)};
const ar=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(String(s||''));return m?m[3]+'/'+m[2]+'/'+m[1]:String(s||'')};
const hora=s=>{try{return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s))}catch(_){return ''}};
const esSecretaria=()=>{const u=window.panelUsuarioActual||{};return String(u.usuario||u.USUARIO||'').trim().toLowerCase()==='secretaria'&&typeof panelEsConsultaServicios==='function'&&panelEsConsultaServicios()};
let filtro='2',modelo=null,busy=false,enviando=false;
function fechas(){const h=dia();return filtro==='hoy'?[h,h]:filtro==='manana'?[sumar(h,1),sumar(h,1)]:filtro==='7'?[h,sumar(h,6)]:[h,sumar(h,1)]}
function raiz(){
  let root=document.getElementById('secF5a');if(root)return root;
  const page=document.getElementById('servicios');if(!page)return null;
  root=document.createElement('section');root.id='secF5a';root.setAttribute('aria-label','Traslados de Secretaría');
  root.innerHTML='<div class="s5head"><div><h3>🚐 Traslados de Secretaría</h3><div class="s5muted">Solicitudes Municipales · Agenda compartida con APPSECRETARIA</div></div>'
    +'<div><select id="s5filtro"><option value="2">Hoy y mañana</option><option value="hoy">Solo hoy</option><option value="manana">Solo mañana</option><option value="7">Próximos 7 días</option></select> '
    +'<button type="button" id="s5refresh">Actualizar agenda</button></div></div>'
    +'<div class="s5kpis" id="s5kpis"></div><div class="s5muted" id="s5rango"></div>'
    +'<div class="s5notice" id="s5mensaje" aria-live="polite"></div>'
    +'<div class="s5scroll"><table><thead><tr><th>Horario</th><th>Traslado</th><th>Solicitante</th><th>Estado</th><th>Recursos</th><th>Acciones</th></tr></thead><tbody id="s5rows"></tbody></table></div>'
    +'<div class="s5editor" id="s5editor"></div>'
    +'<p class="s5muted">Las reservas, asignaciones y aceptaciones se sincronizan con APPSECRETARIA y App Choferes. El inicio y cierre del viaje todavía no están vinculados a la solicitud. Los servicios generales continúan debajo.</p>';
  const top=page.querySelector('.section-head');if(top)top.insertAdjacentElement('afterend',root);else page.prepend(root);
  root.querySelector('#s5filtro').onchange=ev=>{filtro=ev.target.value;cargar()};
  root.querySelector('#s5refresh').onclick=cargar;root.addEventListener('click',accion);return root;
}
function aviso(x){const node=document.getElementById('s5mensaje');if(node)node.textContent=String(x||'')}
// Consulta directa para conservar el error del backend (leerBackend
// devuelve null cuando hay un problema y ocultaría el diagnóstico).
async function s5Leer(accion,parametros){
  const url = BACKEND_URL + '?' + new URLSearchParams({accion,...parametros}).toString();
  const res = await fetch(url,{method:'GET',cache:'no-store'});
  const r = await res.json();
  if(!res.ok || !r || r.ok !== true)
    throw new Error(r?.error || ('Error de consulta HTTP '+res.status));
  return r;
}
async function cargar(){
  if(!esSecretaria()||busy)return;const root=raiz();if(!root)return;
  busy=true;root.querySelector('#s5refresh').disabled=true;aviso('Consultando APPSECRETARIA...');
  try{
    const [desde,hasta]=fechas(),r=await s5Leer('secretariaAgenda',{desde,hasta});
    if(!r||r.ok!==true||!r.datos||r.datos.ok!==true)throw Error(r?.error||r?.datos?.error||'No se obtuvo la agenda.');
    modelo=r.datos;dibujar();aviso('');
  }catch(err){aviso('No se pudo leer la agenda: '+(err.message||err));
    root.querySelector('#s5rows').innerHTML='<tr><td colspan="6">La agenda no está disponible. Los servicios generales siguen funcionando.</td></tr>';}
  finally{busy=false;root.querySelector('#s5refresh').disabled=false}
}
function dibujar(){
  if(!modelo)return;const root=document.getElementById('secF5a'),r=modelo.resumen||{};
  root.querySelector('#s5kpis').innerHTML=[['Traslados',r.total],['Pendientes',r.pendientes],['Reservados',r.reservadas],['Preasignados',r.preasignadas]]
    .map(([k,v])=>'<div><strong>'+Number(v||0)+'</strong>'+e(k)+'</div>').join('');
  root.querySelector('#s5rango').textContent='Agenda: '+ar(modelo.desde)+' al '+ar(modelo.hasta);
  const items=modelo.items||[];
  root.querySelector('#s5rows').innerHTML=items.length?items.map(t=>{
    const cerrado=['CANCELADA','RECHAZADA','FINALIZADA'].includes(String(t.estado||'').toUpperCase());
    const pasada=t.fecha<dia(),vencida=t.reserva&&Date.parse(t.reserva.fin)<=Date.now();
    const confirmado=String(t.estado||'').toUpperCase()==='CONFIRMADA',btn=[];
    if(!cerrado&&!pasada){
      if(!t.reserva)btn.push(['reservar','Reservar']);
      else if(!t.asignacion&&!vencida)btn.push(['asignar','Asignar']);
      else if(t.asignacion&&!vencida&&!confirmado)btn.push(['confirmar','Confirmar'],['liberar','Liberar']);
    }
    const res=t.reserva?'<span class="s5sub">Reserva '+e(hora(t.reserva.inicio))+'–'+e(hora(t.reserva.fin))+'</span>':'<span class="s5sub">Sin reserva</span>';
    const confirmadoChofer=t.asignacion && confirmado ? '<span class="s5sub">'+(String(t.asignacion.estado||'').toUpperCase()==='ACEPTADA'?'✓ CHOFER ACEPTÓ EL TRASLADO':'Esperando aceptación del chofer')+'</span>' : '';
    const recursos=t.asignacion?'<strong>'+e(t.asignacion.chofer)+'</strong><span class="s5sub">'+e(t.asignacion.vehiculo)+'</span>'+confirmadoChofer:'Sin preasignación';
    return '<tr><td>'+e(ar(t.fecha))+' · '+e(t.hora)+res+'</td>'
      +'<td><strong>'+e(t.origen)+' → '+e(t.destino)+'</strong><span class="s5sub">'+Number(t.pasajeros||0)+' pasajeros · '+Number(t.duracion||0)+' min</span></td>'
      +'<td>'+e(t.dependencia)+'<span class="s5sub">'+e(t.solicitante)+'</span></td><td>'+e(t.estado)+'</td>'
      +'<td>'+recursos+'</td><td><div class="s5actions">'+btn.map(([a,l])=>'<button type="button" data-accion="'+a+'" data-id="'+e(t.id)+'">'+e(l)+'</button>').join('')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="6">Sin traslados para estas fechas.</td></tr>';
}
async function escribir(accion,d){
  const r=await llamarBackend(accion,d);
  if(!r||r.ok!==true||!r.resultado||r.resultado.ok!==true)throw Error(r?.error||r?.resultado?.error||'No se pudo guardar.');
  return r.resultado;
}
async function ejecutar(accion,d){
  enviando=true;aviso('Guardando...');
  try{await escribir(accion,d);aviso('Guardado correctamente.');await cargar()}
  catch(err){aviso('No guardado: '+(err.message||err))}
  finally{enviando=false}
}
async function asignar(id){
  const editor=document.getElementById('s5editor');editor.classList.add('open');editor.textContent='Consultando recursos...';
  try{
    const r=await s5Leer('secretariaRecursos',{idSolicitud:id});
    if(!r||r.ok!==true||!r.datos||r.datos.ok!==true)throw Error(r?.error||'No hay recursos disponibles.');
    if(r.datos.asignacion)throw Error('Esta solicitud ya tiene una preasignación.');
    const cs=r.datos.choferes.filter(x=>x.disponible),vs=r.datos.vehiculos.filter(x=>x.disponible);
    if(!cs.length||!vs.length)throw Error('No hay choferes o vehículos disponibles.');
    editor.innerHTML='<strong>Preasignación de Secretaría</strong><div class="s5grid">'
      +'<div><label for="s5chofer">Chofer</label><select id="s5chofer">'+cs.map(x=>'<option value="'+e(x.id)+'">'+e(x.nombre)+'</option>').join('')+'</select></div>'
      +'<div><label for="s5vehiculo">Vehículo</label><select id="s5vehiculo">'+vs.map(x=>'<option value="'+e(x.id)+'">'+e(x.nombre)+'</option>').join('')+'</select></div></div>'
      +'<button type="button" class="s5primary" id="s5guardar">Guardar preasignación</button> <button type="button" id="s5cerrar">Cancelar</button>';
    editor.querySelector('#s5cerrar').onclick=()=>editor.classList.remove('open');
    editor.querySelector('#s5guardar').onclick=async()=>{
      if(!confirm('¿Guardar preasignación local en APPSECRETARIA?'))return;
      const idChofer=editor.querySelector('#s5chofer').value,idVehiculo=editor.querySelector('#s5vehiculo').value;
      await ejecutar('secretariaAsignar',{idSolicitud:id,idChofer,idVehiculo});editor.classList.remove('open');
    };
  }catch(err){editor.textContent=err.message||String(err);}
}
async function accion(ev){
  const b=ev.target.closest('button[data-accion]');if(!b||enviando||!esSecretaria())return;
  const a=b.dataset.accion,id=b.dataset.id;if(!(modelo?.items||[]).some(x=>x.id===id))return;
  if(a==='asignar'){await asignar(id);return}
  if(a==='reservar'){
    const x=prompt('Margen en minutos (0 a 240):','15');if(x===null)return;
    if(!/^\d{1,3}$/.test(x)||Number(x)>240){aviso('Margen inválido.');return}
    await ejecutar('secretariaReservar',{idSolicitud:id,margen:Number(x)});
  }
  if(a==='confirmar'&&confirm('¿Confirmar en APPSECRETARIA? Todavía no se envía al chofer.'))
    await ejecutar('secretariaConfirmar',{idSolicitud:id});
  if(a==='liberar'){
    const motivo=prompt('Motivo de liberación (mínimo 5 caracteres):','');
    if(motivo!==null)await ejecutar('secretariaLiberar',{idSolicitud:id,motivo});
  }
}
function activar(){
  const v=esSecretaria();document.body.classList.toggle('panel-secretaria',v);
  if(v){raiz();cargar()}
}
const previo=window.panelAplicarPermisosInterfaz;
if(typeof previo==='function')
  window.panelAplicarPermisosInterfaz=function(...args){const r=previo.apply(this,args);activar();return r};
if(window.__PANEL_AUTH_READY__===true)activar();
})();