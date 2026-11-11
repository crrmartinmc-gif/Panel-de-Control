/* Navegación móvil accesible; las acciones del panel se conservan. */
(function(){
 const sidebar=document.querySelector('.sidebar'),topbar=document.querySelector('.topbar');
 if(!sidebar||!topbar)return;
 sidebar.id=sidebar.id||'panelNavigation';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='responsive-menu-toggle';
 toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menú de navegación');
 toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menú</span>';
 topbar.prepend(toggle);
 const close=document.createElement('button');close.type='button';close.className='responsive-menu-close';close.textContent='Cerrar menú ×';sidebar.prepend(close);
 const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='responsive-nav-backdrop';backdrop.setAttribute('aria-label','Cerrar menú');backdrop.tabIndex=-1;sidebar.after(backdrop);
 const mobile=matchMedia('(max-width:900px)');
 function setOpen(open,restore=true){
  const active=open&&mobile.matches;
  document.body.classList.toggle('responsive-nav-open',active);toggle.setAttribute('aria-expanded',String(active));
  sidebar.inert=mobile.matches&&!active;
  if(active)close.focus();else if(restore&&mobile.matches)toggle.focus();
 }
 toggle.addEventListener('click',()=>setOpen(!document.body.classList.contains('responsive-nav-open')));
 close.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
 sidebar.addEventListener('click',e=>{if(e.target.closest('.menu button,[data-panel-logout]'))setOpen(false);});
 document.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('responsive-nav-open'))return;
  if(e.key==='Escape'){e.preventDefault();setOpen(false);}
  if(e.key==='Tab'){
   const items=[...sidebar.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
   const first=items[0],last=items[items.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 });
 mobile.addEventListener('change',()=>setOpen(false,false));setOpen(false,false);
 document.querySelectorAll('.table-wrap,[class*="-table-wrap"]').forEach(w=>{w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label','Tabla de datos; desplazá horizontalmente para ver todas las columnas');});
})();
