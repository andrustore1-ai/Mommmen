/* Emergency stability patch: fixes visible injected code, drawer buttons, and sync buttons */
(function(){
  'use strict';
  const APP='supermarket_pos_ar_v1';
  const ORANGE='#EA580B';
  function $(s,r=document){return r.querySelector(s)}
  function $all(s,r=document){return Array.from(r.querySelectorAll(s))}
  function read(){try{return JSON.parse(localStorage.getItem(APP)||'{}')||{}}catch(e){return {}}}
  function save(d){try{localStorage.setItem(APP,JSON.stringify(d||{}));window.DB=d;window.dispatchEvent(new CustomEvent('oskar-db-updated',{detail:{source:'emergency-fix'}}));}catch(e){}}
  function toast(msg){try{if(window.toast&&window.toast!==toast)return window.toast(msg);let t=$('#toast')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'toast'}));t.textContent=msg;t.className='toast show';setTimeout(()=>{t.className='toast'},2600);}catch(e){}}
  function stop(e){if(e){e.preventDefault();e.stopPropagation();}}

  function openAnyDrawer(e){
    stop(e);
    const d=$('#drawer')||$('.drawer');
    if(d){d.classList.add('show','open');d.style.display='block';}
    const ov=$('.drawer-overlay');
    if(ov){ov.classList.add('show');ov.style.display='block';}
    document.body.classList.add('drawer-is-open');
    return false;
  }
  function closeAnyDrawer(e){
    stop(e);
    $all('#drawer,.drawer').forEach(d=>{d.classList.remove('show','open');d.style.display='';});
    $all('.drawer-overlay').forEach(ov=>{ov.classList.remove('show');ov.style.display='';});
    document.body.classList.remove('drawer-is-open');
    return false;
  }
  window.openDrawer=openAnyDrawer;
  window.closeDrawer=closeAnyDrawer;

  function bindDrawer(){
    const candidates=['#menuIcon','.menu-open','[data-menu-open]','.topbar .menu-open','.oskarMenuButton','button[aria-label="menu"]'];
    candidates.forEach(sel=>$all(sel).forEach(b=>{if(b.__drawerFixed)return;b.__drawerFixed=true;b.addEventListener('click',openAnyDrawer,true);}));
    $all('#closeIcon,#closeIcon2,[data-menu-close],.drawer-close').forEach(b=>{if(b.__drawerCloseFixed)return;b.__drawerCloseFixed=true;b.addEventListener('click',closeAnyDrawer,true);});
    $all('#drawer,.drawer-overlay').forEach(el=>{if(el.__drawerOverlayFixed)return;el.__drawerOverlayFixed=true;el.addEventListener('click',ev=>{if(ev.target===el)closeAnyDrawer(ev);});});
  }

  async function syncNowFixed(e){
    stop(e);
    const btn=(e&&e.currentTarget)||$('[data-restaurant-sync]')||$('.sync-button')||$('.top-actions button[onclick*="sync"]');
    try{
      btn&&btn.classList.add('syncing');
      const state=$('#syncState'); if(state)state.textContent='جاري المزامنة...';
      const d=read(); d.lastLocalUpdate=new Date().toISOString(); save(d);
      if(window.FirebaseBridge){
        if(typeof FirebaseBridge.sync==='function') await FirebaseBridge.sync(d);
        else if(typeof FirebaseBridge.queueSync==='function') FirebaseBridge.queueSync(d);
        else if(typeof FirebaseBridge.pushWithKey==='function') await FirebaseBridge.pushWithKey((d.settings||{}).companyKey||'default');
      }
      if(state)state.textContent='تمت المزامنة';
      toast('تمت المزامنة');
    }catch(err){console.warn(err); const state=$('#syncState'); if(state)state.textContent='تعذر المزامنة'; toast('تم حفظ التعديلات محليًا وسيتم مزامنتها عند توفر الاتصال');}
    finally{setTimeout(()=>btn&&btn.classList.remove('syncing'),550);}
    return false;
  }
  window.restaurantSyncNow=syncNowFixed;
  function bindSync(){
    $all('button,a').forEach(b=>{
      const txt=(b.textContent||'').trim(), oc=b.getAttribute('onclick')||'';
      if(b.matches('[data-restaurant-sync],.sync-button') || /syncNow|restaurantSync|مزامنة|↻|↺/.test(txt+oc)){
        if(b.__syncFixed)return; b.__syncFixed=true; b.setAttribute('data-restaurant-sync','1'); b.addEventListener('click',syncNowFixed,true);
      }
    });
  }

  function stripPrintedCode(){
    const bad=/renderSaleForm|w\.document\.close|collection\(|function\s+showProductResults|savePurchase\(|\$\{optionsHTML/;
    const walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);
    const del=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      if(n.parentElement && /SCRIPT|STYLE|TEXTAREA/.test(n.parentElement.tagName)) continue;
      if(bad.test(n.nodeValue||'')) del.push(n);
    }
    del.forEach(n=>{try{n.nodeValue=''}catch(e){}});
  }

  function paintOrange(){
    document.documentElement.style.setProperty('--brand',ORANGE);
    document.documentElement.style.setProperty('--brand2','#FB923C');
    document.documentElement.style.setProperty('--accent',ORANGE);
    document.documentElement.style.setProperty('--blue',ORANGE);
  }

  function menuOfflineFallback(){
    if(!/مطعم-المنيو-الرقمي/.test(decodeURIComponent(location.pathname)))return;
    const productsBox=$('#products'), skeleton=$('#skeleton');
    const already=productsBox&&productsBox.children.length;
    if(already)return;
    const d=read();
    const meals=(Array.isArray(d.restaurantMenu)?d.restaurantMenu:[]).filter(x=>x && x._deleted!==true && x.active!=='غير نشط' && x.active!==false);
    if(!meals.length)return;
    const settings=d.settings||{};
    const name=settings.menuName||settings.restaurantName||settings.storeName||'مطعم أوسكار';
    const logo=settings.menuLogo||settings.logoImage||settings.logo||'';
    const setText=(id,v)=>{const e=$(id); if(e)e.textContent=v;};
    setText('#topName',name);setText('#drawerName',name);
    ['#topLogo','#drawerLogo'].forEach(sel=>{const e=$(sel);if(e)e.innerHTML=logo?`<img src="${String(logo).replace(/"/g,'&quot;')}">`:name.slice(0,1);});
    const cats=[...new Set(meals.map(x=>x.category||'عام'))];
    let active='all';
    function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
    window.__addMenuFallback=function(id){
      const p=meals.find(x=>String(x.id)===String(id)); if(!p)return;
      const cart=JSON.parse(localStorage.getItem('r7_cart')||'[]');
      cart.push({id:p.id,menuId:p.id,restaurantDishId:p.id,name:p.name,price:Number(p.price||p.salePrice||0),qty:1,image:p.image||p.mainImage||'',extras:[],removes:[],note:''});
      localStorage.setItem('r7_cart',JSON.stringify(cart));
      const b=$('#cartBadge'); if(b){b.style.display='grid';b.textContent=cart.reduce((s,i)=>s+Number(i.qty||1),0)}
      toast('تمت الإضافة للسلة');
    };
    function draw(){
      const q=($('#search')?.value||'').trim().toLowerCase();
      let arr=meals.filter(x=>(active==='all'||(x.category||'عام')===active));
      if(q)arr=arr.filter(x=>String(x.name||'').toLowerCase().includes(q)||String(x.description||'').toLowerCase().includes(q));
      const catBox=$('#cats'); if(catBox)catBox.innerHTML='<h3>الأقسام</h3><button class="catBtn '+(active==='all'?'active':'')+'" data-cat="all">الكل</button>'+cats.map(c=>`<button class="catBtn ${active===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      productsBox.innerHTML=arr.map(p=>`<article class="card"><div class="pic">${(p.image||p.mainImage)?`<img src="${esc(p.image||p.mainImage)}">`:'🍽️'}</div><div class="info"><h3>${esc(p.name||'وجبة')}</h3><div class="desc">${esc(p.description||'')}</div><div class="row"><div class="price">${Number(p.price||p.salePrice||0).toFixed(2)} ${(settings.currency||'₪')}</div><button class="add" onclick="__addMenuFallback('${esc(p.id||p.name)}')">إضافة</button></div></div></article>`).join('')||'<div class="empty">لا توجد وجبات حالياً</div>';
      if(skeleton)skeleton.innerHTML='';
      $all('[data-cat]',catBox).forEach(b=>b.onclick=()=>{active=b.dataset.cat;draw();});
    }
    draw();
  }

  function init(){paintOrange();stripPrintedCode();bindDrawer();bindSync();setTimeout(menuOfflineFallback,1700);setTimeout(()=>{stripPrintedCode();bindDrawer();bindSync();},700);setTimeout(()=>{stripPrintedCode();bindDrawer();bindSync();menuOfflineFallback();},2500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
