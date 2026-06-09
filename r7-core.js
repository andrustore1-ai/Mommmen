/* R7 Burger Core - Realtime Database only, no Auth, flat files */
(function(){
  'use strict';
  const firebaseConfig = {
  apiKey: "AIzaSyAVY0yl1HHJ-rDtjIwunHxPV9xIxXHfY5k",
  authDomain: "fddf-e31c3.firebaseapp.com",
  databaseURL: "https://fddf-e31c3-default-rtdb.firebaseio.com",
  projectId: "fddf-e31c3",
  storageBucket: "fddf-e31c3.firebasestorage.app",
  messagingSenderId: "396607250231",
  appId: "1:396607250231:web:d49938c3b5e4050d2444b2",
  measurementId: "G-63KR330MPC"
};
  const RESTAURANT_ID = 'r7_burger';
  const BASE = 'restaurants/' + RESTAURANT_ID;
  const DEFAULT_ADMIN_KEY = '0000';
  let db = null;

  const EMPTY_SETTINGS = {
    name: '', currency: '₪', whatsapp: '', publicMenuUrl: '',
    logoImage: '', logoText: '', themeColor: '#EA580B',
    bannerEnabled: false, bannerImage: '', bannerTitle: '', bannerSubtitle: '',
    outsideEnabled: false, outsideTitle: '', outsideText: '',
    taxRate: 0, serviceRate: 0, deliveryRegions: {}, socials: {}
  };
  const SOCIAL_TYPES = [
    ['whatsapp','واتساب'], ['instagram','إنستغرام'], ['facebook','فيسبوك'], ['tiktok','تيك توك'],
    ['snapchat','سناب شات'], ['telegram','تيليجرام'], ['x','X / تويتر'], ['youtube','يوتيوب'],
    ['website','موقع إلكتروني'], ['phone','اتصال'], ['maps','خرائط'], ['delivery','توصيل']
  ];
  const CAT_ICONS = [['burger','برجر'],['fries','بطاطا'],['drink','مشروبات'],['kitchen','وجبات'],['products','منتجات'],['delivery','توصيل']];

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector('script[src="'+src+'"]')) return resolve();
      const s=document.createElement('script'); s.src=src; s.async=true;
      s.onload=resolve; s.onerror=()=>reject(new Error('فشل تحميل Firebase SDK: '+src));
      document.head.appendChild(s);
    });
  }
  const sdkReady = (async function(){
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js');
    if(!window.firebase) throw new Error('لم يتم تحميل مكتبة Firebase');
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    return db;
  })();

  function cleanPart(v){ return String(v||'').replace(/^\/+|\/+$/g,'').trim(); }
  function pathOf(path){ const p=Array.isArray(path)?path.map(cleanPart).filter(Boolean).join('/'):cleanPart(path); return p?BASE+'/'+p:BASE; }
  function sanitizeId(v){ return String(v||'').trim().replace(/[.#$\[\]\/\\]/g,'_').replace(/\s+/g,'_') || ('id_'+Date.now()); }
  function list(obj){ if(!obj) return []; if(Array.isArray(obj)) return obj.filter(Boolean).map((data,i)=>({id:String(i),...(data||{})})); return Object.entries(obj).map(([id,data])=>({id,...(data||{})})); }
  function sortBySort(a,b){ return Number(a.sort||999)-Number(b.sort||999) || String(a.name||a.label||'').localeCompare(String(b.name||b.label||''),'ar',{numeric:true}); }
  function normalizeColor(c){ c=String(c||'').trim(); if(!c) return '#EA580B'; c=c.replace(/^#/,''); if(/^[0-9a-fA-F]{3}$/.test(c)) c=c.split('').map(x=>x+x).join(''); return /^[0-9a-fA-F]{6}$/.test(c)?('#'+c.toUpperCase()):'#EA580B'; }
  function settingsWithDefaults(s){ return {...EMPTY_SETTINGS,...(s||{}), themeColor:normalizeColor((s&&s.themeColor)||EMPTY_SETTINGS.themeColor), socials:(s&&s.socials)||{}, deliveryRegions:(s&&s.deliveryRegions)||{}}; }
  function money(v,currency){ const n=Number(v||0); return n.toFixed(Number.isInteger(n)?0:2)+' '+(currency||'₪'); }
  function orderNo(prefix){ const d=new Date(); return (prefix||'R7')+'-'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+Math.floor(1000+Math.random()*9000); }
  function makeKey(len){ const chars='23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; let out=''; const arr=new Uint32Array(len||10); try{crypto.getRandomValues(arr)}catch(e){for(let i=0;i<arr.length;i++)arr[i]=Date.now()+i} for(let i=0;i<arr.length;i++) out+=chars[arr[i]%chars.length]; return out; }
  function hashKey(input){ const s=String(input||''); let h1=2166136261,h2=16777619; for(let i=0;i<s.length;i++){const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619); h2=Math.imul(h2+c,2166136261);} return ((h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')); }
  function now(){ return firebase.database.ServerValue.TIMESTAMP; }
  function toMillis(v){ if(!v) return null; if(typeof v==='number') return v; const p=Date.parse(v); return Number.isNaN(p)?null:p; }
  function localDate(v){ const t=toMillis(v); return t?new Date(t).toLocaleString('ar',{hour12:false}):''; }
  function todayStart(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function errorMessage(err){
    const raw=String((err&&err.code)||(err&&err.message)||err||'').toLowerCase();
    if(raw.includes('permission_denied')||raw.includes('permission-denied')) return 'قواعد Realtime Database تمنع الحفظ أو القراءة. افتح Firebase Console > Realtime Database > Rules والصق قواعد database.rules.txt ثم Publish.';
    if(raw.includes('auth/admin-restricted-operation')) return 'أنت تفتح نسخة قديمة تستخدم Firebase Auth. هذه النسخة لا تستخدم Auth نهائياً. احذف الملفات القديمة وارفع هذه الملفات فقط.';
    if(raw.includes('network')||raw.includes('failed')||raw.includes('fetch')) return 'فشل الاتصال بـ Firebase. تأكد من الإنترنت ومن رفع الملفات على استضافة أو سيرفر محلي.';
    if(raw.includes('database_url')||raw.includes('database')) return 'تأكد أن Realtime Database مفعّلة وأن databaseURL صحيح في firebase.js.';
    return (err&&err.message)||String(err||'حدث خطأ غير معروف');
  }
  async function get(path){ await sdkReady; const snap=await db.ref(pathOf(path)).once('value'); return snap.val(); }
  async function set(path,value){ await sdkReady; await db.ref(pathOf(path)).set(value); return value; }
  async function update(path,value){ await sdkReady; await db.ref(pathOf(path)).update(value); return value; }
  async function remove(path){ await sdkReady; await db.ref(pathOf(path)).remove(); }
  async function push(path,value){ await sdkReady; const ref=db.ref(pathOf(path)).push(); await ref.set(value); return ref.key; }
  function watch(path,cb,onErr){ let ref=null; sdkReady.then(()=>{ref=db.ref(pathOf(path)); ref.on('value',s=>cb(s.val()),e=>onErr&&onErr(e));}).catch(e=>onErr&&onErr(e)); return ()=>{if(ref)ref.off()}; }

  async function ensureBaseData(){
    await sdkReady;
    const s=await get('settings');
    if(!s) await set('settings',{...EMPTY_SETTINGS,createdAt:now(),updatedAt:now()});
    const def=await get('accessKeys/default_admin');
    if(!def) await set('accessKeys/default_admin',{label:'مفتاح افتراضي 0000',hash:hashKey(DEFAULT_ADMIN_KEY),active:true,type:'permanent',expiresAt:null,createdAt:now(),useCount:0});
    return true;
  }

  async function cleanDemoData(){
    await sdkReady;
    const demoProducts=['demo_burger','demo_crispy','demo_fries','demo_cola'];
    const demoCats=['burgers','sides','drinks'];
    const updates={};
    demoProducts.forEach(id=>updates[pathOf('products/'+id).replace(BASE+'/','')]=null);
    demoCats.forEach(id=>updates[pathOf('categories/'+id).replace(BASE+'/','')]=null);
    await db.ref(BASE).update({
      settings:{...EMPTY_SETTINGS,updatedAt:now()},
      products: (await get('products')) || null,
      categories: (await get('categories')) || null
    });
    for(const id of demoProducts) await remove('products/'+id).catch(()=>{});
    for(const id of demoCats) await remove('categories/'+id).catch(()=>{});
    return true;
  }

  function sessionGet(){ try{return JSON.parse(localStorage.getItem('r7_admin_session')||'null')}catch(e){return null} }
  function sessionSave(data){ localStorage.setItem('r7_admin_session',JSON.stringify(data)); return data; }
  function sessionIsValid(){ const s=sessionGet(); if(!s) return false; if(!s.expiresAt) return true; return Date.now()<Number(s.expiresAt); }
  function requireAdmin(){ if(sessionIsValid()) return true; const next=encodeURIComponent(location.pathname.split('/').pop()+location.search); location.href='login.html?next='+next; return false; }
  function logout(){ localStorage.removeItem('r7_admin_session'); location.href='login.html'; }
  async function validateAdminKey(raw){
    const key=String(raw||'').trim(); if(!key) throw new Error('أدخل مفتاح الدخول');
    if(key===DEFAULT_ADMIN_KEY) return sessionSave({keyId:'bootstrap_0000',label:'دخول افتراضي 0000',bootstrap:true,loggedAt:Date.now(),expiresAt:Date.now()+24*60*60*1000});
    const keys=list(await get('accessKeys'));
    const found=keys.find(k=>k.active!==false&&(k.hash===hashKey(key)||k.key===key));
    if(!found) throw new Error('مفتاح الدخول غير صحيح');
    const exp=toMillis(found.expiresAt); if(exp&&Date.now()>exp) throw new Error('انتهت صلاحية هذا المفتاح');
    await update('accessKeys/'+found.id,{lastLoginAt:now(),useCount:Number(found.useCount||0)+1});
    return sessionSave({keyId:found.id,label:found.label||'Admin',bootstrap:false,loggedAt:Date.now(),expiresAt:exp});
  }
  function calcExpiry(type,count){ if(type==='permanent') return null; const n=Number(count||1), d=new Date(); if(type==='minute')d.setMinutes(d.getMinutes()+n); else if(type==='day')d.setDate(d.getDate()+n); else if(type==='week')d.setDate(d.getDate()+7*n); else if(type==='month')d.setMonth(d.getMonth()+n); else if(type==='year')d.setFullYear(d.getFullYear()+n); return d.getTime(); }
  function menuBaseUrl(settings){ if(settings&&settings.publicMenuUrl) return settings.publicMenuUrl; const file=location.pathname.split('/').pop()||'index.html'; if(location.protocol==='file:') return 'index.html'; return location.href.split('?')[0].replace(file,'index.html'); }
  function qrUrl(link){ return 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data='+encodeURIComponent(link); }
  function statusLabel(s){ return ({new:'جديد',preparing:'قيد التحضير',ready:'جاهز',delivered:'تم التسليم',cancelled:'ملغي',whatsapp_sent:'أرسل واتساب'})[s]||s||'غير محدد'; }
  function channelLabel(s){ return ({kitchen:'المطبخ',whatsapp:'واتساب',table:'طاولة',manual:'يدوي',cashier:'كاشير'})[s]||s||'منيو'; }
  function totals(items,settings,extra){ extra=extra||{}; const subtotal=(items||[]).reduce((a,i)=>a+Number(i.price||0)*Number(i.qty||1),0); const service=subtotal*Number(settings.serviceRate||0)/100; const tax=(subtotal+service)*Number(settings.taxRate||0)/100; const shipping=Number(extra.shippingFee||0); return {subtotal,service,tax,shipping,total:subtotal+service+tax+shipping}; }
  async function createInvoiceFromOrder(orderId,order,settings){
    const existing=list(await get('invoices')).find(x=>x.orderId===orderId);
    const t=totals(order.items||[],settings||{},{shippingFee:order.shippingFee||0});
    const data={invoiceNo:order.invoiceNo||order.orderNo||orderNo('INV'), orderId, source:order.source||'order', channel:order.channel||'kitchen', table:order.table||'', customer:order.customer||{}, customerDevice:order.customerDevice||'', shippingRegion:order.shippingRegion||'', shippingFee:Number(order.shippingFee||0), items:order.items||[], subtotal:t.subtotal, service:t.service, tax:t.tax, shipping:t.shipping, total:t.total, status:'delivered', deliveredAt:order.deliveredAt||Date.now(), createdAt:existing.createdAt||Date.now(), updatedAt:now()};
    if(existing.id) await set('invoices/'+existing.id,data); else await push('invoices',data);
    return data;
  }
  async function markDelivered(orderId,order,settings){ await update('orders/'+orderId,{status:'delivered',deliveredAt:now(),updatedAt:now()}); return createInvoiceFromOrder(orderId,{...order,deliveredAt:Date.now()},settings); }

  function deviceId(){
    let id=''; try{id=localStorage.getItem('r7_customer_device')||''}catch(e){}
    if(!id){ id='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10); try{localStorage.setItem('r7_customer_device',id)}catch(e){} }
    return id;
  }
  function invoiceHtml(inv,id,settings,opts){
    settings=settingsWithDefaults(settings||{}); opts=opts||{}; const currency=settings.currency||'₪';
    const t=totals(inv.items||[],settings,{shippingFee:inv.shippingFee||inv.shipping||0});
    const status=inv.status?statusLabel(inv.status):'فاتورة';
    const no=escapeHtml(inv.invoiceNo||inv.orderNo||id||'فاتورة');
    const customer=(inv.customer||{}).name||''; const phone=(inv.customer||{}).phone||'';
    const date=localDate(inv.deliveredAt||inv.createdAt||Date.now());
    const brand=normalizeColor(settings.themeColor||'#EA580B');
    const logo=settings.logoImage?`<img src="${escapeHtml(settings.logoImage)}" style="width:52px;height:52px;border-radius:16px;object-fit:cover;display:block;margin:0 auto 6px">`:`<div style="width:52px;height:52px;border-radius:16px;background:${brand};color:#fff;display:grid;place-items:center;margin:0 auto 6px;font-weight:900">${escapeHtml(settings.logoText||'R7')}</div>`;
    return `<div class="invoice proInvoice" id="print_${escapeHtml(id||'invoice')}" style="width:320px;max-width:100%;background:#fff;color:#111;padding:16px;border:1px solid #e5e7eb;border-radius:18px;font-family:Cairo,Tahoma,Arial;box-shadow:0 8px 24px rgba(15,23,42,.08)">
      <div style="text-align:center">${logo}<h2 style="margin:0;font-size:22px;font-weight:900">${escapeHtml(settings.name||'فاتورة')}</h2><div style="font-weight:900;color:${brand};margin-top:3px">${no}</div><div style="font-size:12px;color:#64748b;font-weight:800">${date}</div></div>
      <div style="display:flex;justify-content:space-between;gap:8px;background:#f8fafc;border-radius:14px;padding:9px 10px;margin:12px 0;font-size:12px;font-weight:900"><span>${status}</span><span>${escapeHtml(channelLabel(inv.channel||inv.source))}</span></div>
      ${(customer||phone||inv.table||inv.shippingRegion)?`<div style="border:1px dashed #cbd5e1;border-radius:14px;padding:9px 10px;margin-bottom:10px;font-size:12px;font-weight:800;color:#334155">${customer?`<div>الزبون: ${escapeHtml(customer)}</div>`:''}${phone?`<div>الجوال: ${escapeHtml(phone)}</div>`:''}${inv.table?`<div>الطاولة: ${escapeHtml(inv.table)}</div>`:''}${inv.shippingRegion?`<div>المنطقة: ${escapeHtml(inv.shippingRegion)}</div>`:''}</div>`:''}
      <div style="border-top:1px dashed #94a3b8;border-bottom:1px dashed #94a3b8;padding:8px 0;margin:8px 0">${(inv.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-weight:800"><span style="max-width:180px">${escapeHtml(i.name)} × ${Number(i.qty||1)}</span><b>${money(Number(i.qty||1)*Number(i.price||0),currency)}</b></div>`).join('')||'<div style="text-align:center;color:#64748b;font-weight:800">لا توجد أصناف</div>'}</div>
      <div style="font-size:13px;font-weight:800"><div style="display:flex;justify-content:space-between;padding:4px 0"><span>المجموع</span><b>${money(t.subtotal,currency)}</b></div>${t.service?`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>خدمة</span><b>${money(t.service,currency)}</b></div>`:''}${t.tax?`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>ضريبة</span><b>${money(t.tax,currency)}</b></div>`:''}${t.shipping?`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>توصيل</span><b>${money(t.shipping,currency)}</b></div>`:''}<div style="display:flex;justify-content:space-between;margin-top:8px;padding:10px;border-radius:14px;background:${brand};color:#fff;font-size:17px;font-weight:900"><span>الإجمالي</span><b>${money(t.total,currency)}</b></div></div>
      <div style="text-align:center;color:#64748b;font-weight:900;font-size:12px;margin-top:12px">شكراً لاختياركم ${escapeHtml(settings.name||'مطعمنا')}</div>
    </div>`;
  }

  function socialLink(type,url){ if(!url) return '#'; if(type==='whatsapp' && /^\d/.test(url)) return 'https://wa.me/'+url.replace(/\D/g,''); if(type==='phone' && /^\+?\d/.test(url)) return 'tel:'+url.replace(/\s/g,''); return url; }
  function icon(type,size){
    const w=size||22, c=`width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const m={
      home:`<svg ${c}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`, cart:`<svg ${c}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>`, search:`<svg ${c}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`, menu:`<svg ${c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>`, close:`<svg ${c}><path d="M18 6 6 18M6 6l12 12"/></svg>`, plus:`<svg ${c}><path d="M12 5v14M5 12h14"/></svg>`, edit:`<svg ${c}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`, trash:`<svg ${c}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`, print:`<svg ${c}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>`, download:`<svg ${c}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`, settings:`<svg ${c}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.36.6.98 1 1.7 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>`, products:`<svg ${c}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>`, table:`<svg ${c}><path d="M4 10h16M5 10l2-6h10l2 6M6 10v10M18 10v10M9 20h6"/></svg>`, kitchen:`<svg ${c}><path d="M8 3v4M12 3v4M16 3v4M6 7h12l-1 14H7L6 7Z"/><path d="M9 11h6"/></svg>`, reports:`<svg ${c}><path d="M4 19V5a2 2 0 0 1 2-2h11l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 17v-6M13 17V7M17 17v-4"/></svg>`, key:`<svg ${c}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15 5l4 4M13 7l4 4"/></svg>`, bell:`<svg ${c}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`, whatsapp:`<svg ${c}><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z"/></svg>`, instagram:`<svg ${c}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>`, facebook:`<svg ${c}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`, tiktok:`<svg ${c}><path d="M14 3v11.2a4.2 4.2 0 1 1-4-4.2"/><path d="M14 3c1 3.5 3.2 5.2 6 5.4"/></svg>`, snapchat:`<svg ${c}><path d="M12 3c3 0 4.5 2.1 4.5 5.4v2.2c.7.8 1.6 1 2.5 1.2-.3 1.6-1.4 2.2-2.7 2.5-.4 1.6-1.7 3.7-4.3 3.7s-3.9-2.1-4.3-3.7c-1.3-.3-2.4-.9-2.7-2.5.9-.2 1.8-.4 2.5-1.2V8.4C7.5 5.1 9 3 12 3Z"/></svg>`, telegram:`<svg ${c}><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>`, x:`<svg ${c}><path d="M4 4l16 16M20 4 4 20"/></svg>`, youtube:`<svg ${c}><path d="M22 12s0-4-1-5c-1-1-4-1-9-1s-8 0-9 1-1 5-1 5 0 4 1 5 4 1 9 1 8 0 9-1 1-5 1-5Z"/><path d="m10 15 5-3-5-3z"/></svg>`, website:`<svg ${c}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`, phone:`<svg ${c}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5.2 13 19.8 19.8 0 0 1 2.1 4.4 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.5 1.8L7.8 9.8a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 1.8-.5l3 .5a2 2 0 0 1 1.7 2Z"/></svg>`, maps:`<svg ${c}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`, delivery:`<svg ${c}><path d="M10 17h4V5H2v12h3"/><path d="M14 17h1m4 0h3v-5l-3-4h-5v9h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`, burger:`<svg ${c}><path d="M4 12h16M5 12c0-4 3-6 7-6s7 2 7 6M6 16h12M7 20h10"/><path d="M8 9h.01M12 8h.01M16 9h.01"/></svg>`, fries:`<svg ${c}><path d="M8 3v8M12 2v9M16 3v8M6 11h12l-1 10H7L6 11Z"/></svg>`, drink:`<svg ${c}><path d="M7 3h10l-1 18H8L7 3ZM7 8h10M11 3v-1h6"/></svg>`
    };
    return m[type]||m.website;
  }
  async function fileToDataUrl(file,maxW,quality){
    if(!file) return '';
    const data=await new Promise((res,rej)=>{const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file);});
    if(!String(file.type||'').startsWith('image/')) return data;
    return await new Promise(resolve=>{const img=new Image(); img.onload=function(){const mw=maxW||1200; let w=img.width,h=img.height; if(w>mw){h=Math.round(h*mw/w);w=mw;} const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); resolve(canvas.toDataURL('image/jpeg',quality||.82));}; img.onerror=()=>resolve(data); img.src=data;});
  }
  async function ensureHtml2Canvas(){ if(window.html2canvas) return window.html2canvas; await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'); return window.html2canvas; }
  function downloadDataUrl(dataUrl,filename){ const a=document.createElement('a'); a.href=dataUrl; a.download=filename||'invoice.png'; document.body.appendChild(a); a.click(); a.remove(); }
  function printElement(id){ const el=typeof id==='string'?document.getElementById(id):id; if(!el) return; const w=window.open('','_blank','width=420,height=720'); w.document.write('<html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة</title><style>body{font-family:Cairo,Tahoma,Arial;margin:0;padding:12px}*{box-sizing:border-box}.invoice{width:280px;margin:auto}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #ddd;padding:6px 0}.center{text-align:center}@media print{button{display:none}}</style></head><body>'+el.outerHTML+'<script>setTimeout(()=>print(),300)<\/script></body></html>'); w.document.close(); }

  window.R7F={firebaseConfig,RESTAURANT_ID,BASE,DEFAULT_ADMIN_KEY,EMPTY_SETTINGS,SOCIAL_TYPES,CAT_ICONS,ready:()=>sdkReady,get,set,update,remove,push,watch,list,sortBySort,normalizeColor,settingsWithDefaults,money,orderNo,makeKey,hashKey,now,toMillis,localDate,todayStart,escapeHtml,errorMessage,ensureBaseData,cleanDemoData,sessionGet,sessionSave,sessionIsValid,requireAdmin,logout,validateAdminKey,calcExpiry,menuBaseUrl,qrUrl,statusLabel,channelLabel,totals,createInvoiceFromOrder,markDelivered,deviceId,invoiceHtml,socialLink,icon,fileToDataUrl,ensureHtml2Canvas,downloadDataUrl,printElement,sanitizeId};
})();
