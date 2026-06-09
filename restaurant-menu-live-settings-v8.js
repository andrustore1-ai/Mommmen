/* V8: force restaurant menu settings to save, sync and render live in menu/table pages */
(function(){
  'use strict';
  if(window.__RESTAURANT_MENU_LIVE_SETTINGS_V8__) return;
  window.__RESTAURANT_MENU_LIVE_SETTINGS_V8__=true;
  const APP_KEY='supermarket_pos_ar_v1';
  const ORANGE='#EA580B';
  const $=id=>document.getElementById(id);
  const q=(s,p=document)=>p.querySelector(s);
  const qa=(s,p=document)=>Array.from(p.querySelectorAll(s));
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const cleanId=v=>String(v||'').trim().replace(/[.#$\[\]\/\\]/g,'_').replace(/\s+/g,'_')||('id_'+Date.now());
  const now=()=>new Date().toISOString();
  function readDB(){try{return JSON.parse(localStorage.getItem(APP_KEY)||'{}')||{}}catch(e){return {}}}
  function writeDB(d){
    try{localStorage.setItem(APP_KEY,JSON.stringify(d||{}));}catch(e){}
    try{window.DB=d;}catch(e){}
    try{window.dispatchEvent(new CustomEvent('oskar-db-updated',{detail:{source:'menu-settings-v8'}}));}catch(e){}
    try{if(window.FirebaseBridge&&FirebaseBridge.queueSync)FirebaseBridge.queueSync(d);}catch(e){}
    return d;
  }
  function toList(v){
    if(Array.isArray(v)) return v.filter(Boolean);
    if(v&&typeof v==='object') return Object.entries(v).map(([id,x])=>({id,...(x||{})}));
    return [];
  }
  function toObj(list,prefix){
    const out={};
    (list||[]).filter(Boolean).forEach((x,i)=>{const id=cleanId(x.id||x.type||x.provider||x.entity||x.name||(prefix+'_'+i)); out[id]={id,...x,sort:Number(x.sort||i+1)};});
    return out;
  }
  function normalizeSettings(d){
    d=d||readDB();
    const s=d.settings=d.settings||{};
    const pays=toList(s.paymentMethods||s.payments).concat(toList(d.restaurantPaymentMethods));
    const socials=toList(s.socials).concat(toList(d.restaurantSocialLinks));
    const payObj=toObj(pays.map(p=>({
      ...p,
      provider:p.provider||p.entity||p.name||p.label||'',
      entity:p.entity||p.provider||p.name||p.label||'',
      name:p.name||p.provider||p.entity||p.label||'',
      accountName:p.accountName||p.owner||p.accountOwner||'',
      owner:p.owner||p.accountName||p.accountOwner||'',
      account:p.account||p.number||p.accountNumber||p.phone||'',
      number:p.number||p.account||p.accountNumber||p.phone||'',
      image:p.image||p.logo||p.iconUrl||'',
      logo:p.logo||p.image||p.iconUrl||'',
      active:p.active!==false
    })).filter(p=>p.provider||p.owner||p.account||p.image),'pay');
    const socialObj=toObj(socials.map(x=>({
      ...x,
      type:x.type||x.id||'website',
      label:x.label||x.name||x.type||'',
      url:x.url||x.link||x.value||'',
      active:x.active!==false
    })).filter(x=>x.url||x.label),'soc');
    const name=s.menuName||s.restaurantName||s.storeName||s.name||'مطعم أوسكار';
    const logo=s.logoImage||s.menuLogo||s.logo||'';
    const banner=s.bannerImage||s.menuBanner||'';
    const theme=s.themeColor||s.menuPrimary||ORANGE;
    Object.assign(s,{
      name,storeName:name,restaurantName:name,menuName:name,
      currency:s.currency||'₪',
      themeColor:theme,menuPrimary:theme,
      publicMenuUrl:s.publicMenuUrl||s.menuBaseUrl||'', menuBaseUrl:s.menuBaseUrl||s.publicMenuUrl||'',
      logoImage:logo,menuLogo:logo,logoText:s.logoText||s.storeShort||'R',
      bannerEnabled:s.bannerEnabled!==undefined?s.bannerEnabled:(s.menuBannerEnabled!==false),
      menuBannerEnabled:s.menuBannerEnabled!==undefined?s.menuBannerEnabled:(s.bannerEnabled!==false),
      bannerImage:banner,menuBanner:banner,
      bannerTitle:s.bannerTitle||s.menuBannerTitle||'عروض حصرية',
      menuBannerTitle:s.menuBannerTitle||s.bannerTitle||'عروض حصرية',
      bannerSubtitle:s.bannerSubtitle||s.menuBannerSubtitle||'اطلب وجبتك مباشرة من المنيو',
      menuBannerSubtitle:s.menuBannerSubtitle||s.bannerSubtitle||'اطلب وجبتك مباشرة من المنيو',
      outsideEnabled:s.outsideEnabled!==false,
      outsideTitle:s.outsideTitle||'طلب خارج المطعم',
      outsideText:s.outsideText||'اختر وجباتك وأرسل الطلب مباشرة للمطبخ أو عبر واتساب.',
      whatsapp:s.whatsapp||'',
      serviceRate:Number(s.serviceRate||0),taxRate:Number(s.taxRate||0),
      paymentMethods:payObj,payments:payObj,socials:socialObj,
      _updatedAt:s._updatedAt||now()
    });
    d.restaurantPaymentMethods=Object.values(payObj);
    d.restaurantSocialLinks=Object.values(socialObj);
    return s;
  }
  function icon(type){
    const map={whatsapp:'☎',instagram:'◎',facebook:'f',tiktok:'♪',snapchat:'👻',telegram:'✈',x:'𝕏',youtube:'▶',website:'🌐',phone:'☎',maps:'📍'};
    if(window.R7F&&typeof R7F.icon==='function') return R7F.icon(type||'website',20);
    return '<span style="font-weight:950">'+esc(map[type]||'🔗')+'</span>';
  }
  function socialHref(type,url){
    url=String(url||'').trim();
    if(!url) return '#';
    if(type==='whatsapp' && /^\+?\d/.test(url)) return 'https://wa.me/'+url.replace(/\D/g,'');
    if(type==='phone' && /^\+?\d/.test(url)) return 'tel:'+url.replace(/\s/g,'');
    if(!/^https?:|^tel:|^mailto:/i.test(url) && /\./.test(url)) return 'https://'+url;
    return url;
  }
  async function fileToDataURL(file){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
  async function uploadOrDataUrl(file,path,current){
    if(!file) return current||'';
    try{if(window.FirebaseBridge&&FirebaseBridge.uploadFile) return await FirebaseBridge.uploadFile(file,path+Date.now()+'_'+String(file.name||'image').replace(/[^\w.\-ء-ي]/g,'_'));}
    catch(e){console.warn('Storage upload failed, using local data URL fallback',e);}
    try{return await fileToDataURL(file);}catch(e){return current||'';}
  }
  async function pushNow(d){
    writeDB(d);
    try{if(window.FirebaseBridge&&FirebaseBridge.sync){const merged=await FirebaseBridge.sync(d,{prefer:'local'});writeDB(merged);return merged;}}
    catch(e){console.warn('Firebase sync failed',e);}
    return d;
  }
  function installSettingsPage(){
    if(!/مطعم-إعدادات-المطعم\.html/i.test(location.pathname)) return;
    const style=document.createElement('style');
    style.textContent=`
      .pay-row,.social-row{position:relative}.pay-preview{width:62px;height:62px;border-radius:18px;object-fit:cover;background:#fff;border:1px solid #fed7aa;display:block}.pay-preview-wrap,.soc-preview-wrap{display:flex;align-items:center;justify-content:center;gap:8px;min-height:42px}.soc-preview{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:#fff7ed;border:1px solid #fed7aa;color:#ea580b}.pay-row .setting-row-grid,.social-row .setting-row-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))!important}@media(max-width:760px){.pay-row .setting-row-grid,.social-row .setting-row-grid{grid-template-columns:1fr!important}.setting-row-head{align-items:flex-start}.setting-row-actions .btn{min-width:auto}}
    `;
    document.head.appendChild(style);
    function enhanceRows(){
      qa('.pay-row').forEach((r,i)=>{
        if(!q('.pay-preview-wrap',r)){
          const field=document.createElement('div');field.className='field pay-preview-wrap';field.innerHTML='<label>معاينة الصورة</label><img class="pay-preview" alt="">';q('.setting-row-grid',r)?.appendChild(field);
        }
        const img=q('.pay-preview',r), inp=q('.pay-image',r), file=q('.pay-file',r);
        const update=()=>{if(img) img.src=(inp&&inp.value)||'';}; update();
        inp&&inp.addEventListener('input',update);
        file&&file.addEventListener('change',async()=>{const f=file.files&&file.files[0]; if(f){try{const data=await fileToDataURL(f); if(img)img.src=data;}catch(e){}}});
      });
      qa('.social-row').forEach(r=>{
        if(!q('.soc-preview-wrap',r)){
          const field=document.createElement('div');field.className='field soc-preview-wrap';field.innerHTML='<label>الأيقونة</label><div class="soc-preview"></div>';q('.setting-row-grid',r)?.prepend(field);
        }
        const sel=q('.soc-type',r), prev=q('.soc-preview',r); const update=()=>{if(prev)prev.innerHTML=icon(sel&&sel.value||'website')}; update(); sel&&sel.addEventListener('change',update);
      });
    }
    const mo=new MutationObserver(enhanceRows);mo.observe(document.body,{childList:true,subtree:true});setTimeout(enhanceRows,300);
    const oldLoad=window.loadSettings;
    window.loadSettings=function(){
      const d=readDB();const s=normalizeSettings(d);
      if(typeof oldLoad==='function'){try{oldLoad.apply(this,arguments);}catch(e){console.warn(e)}}
      try{
        if($('menuName'))$('menuName').value=s.menuName||s.name;
        if($('currency'))$('currency').value=s.currency||'₪';
        if($('menuPrimary'))$('menuPrimary').value=s.menuPrimary||s.themeColor||ORANGE;
        if($('whatsapp'))$('whatsapp').value=s.whatsapp||'';
        if($('menuBaseUrl'))$('menuBaseUrl').value=s.menuBaseUrl||s.publicMenuUrl||'';
        if($('bannerEnabled'))$('bannerEnabled').value=String(s.menuBannerEnabled!==false&&s.bannerEnabled!==false);
        if($('bannerTitle'))$('bannerTitle').value=s.menuBannerTitle||s.bannerTitle||'';
        if($('bannerSubtitle'))$('bannerSubtitle').value=s.menuBannerSubtitle||s.bannerSubtitle||'';
        if($('logoText'))$('logoText').value=s.logoText||'';
        if($('logoImage'))$('logoImage').value=s.logoImage||s.menuLogo||'';
        if($('bannerImage'))$('bannerImage').value=s.bannerImage||s.menuBanner||'';
        if($('logoPreview'))$('logoPreview').src=$('logoImage')?.value||'';
        if($('bannerPreview'))$('bannerPreview').src=$('bannerImage')?.value||'';
        if($('outsideEnabled'))$('outsideEnabled').value=String(s.outsideEnabled!==false);
        if($('outsideTitle'))$('outsideTitle').value=s.outsideTitle||'طلب خارج المطعم';
        if($('outsideText'))$('outsideText').value=s.outsideText||'';
      }catch(e){}
      setTimeout(enhanceRows,100);
    };
    window.saveSettings=async function(){
      const btn=document.activeElement;try{if(btn&&btn.tagName==='BUTTON')btn.disabled=true;}catch(e){}
      try{
        const d=readDB();const s=d.settings=d.settings||{};
        let logo=$('logoImage')?.value.trim()||'';
        let banner=$('bannerImage')?.value.trim()||'';
        logo=await uploadOrDataUrl($('logoFile')?.files?.[0],'restaurant/menu/logo_',logo);
        banner=await uploadOrDataUrl($('bannerFile')?.files?.[0],'restaurant/menu/banner_',banner);
        const pays={};
        for(const [i,r] of qa('.pay-row').entries()){
          let provider=q('.pay-provider',r)?.value.trim()||'', owner=q('.pay-owner',r)?.value.trim()||'', number=q('.pay-number',r)?.value.trim()||'', image=q('.pay-image',r)?.value.trim()||'';
          image=await uploadOrDataUrl(q('.pay-file',r)?.files?.[0],'restaurant/menu/payment_',image);
          if(!provider&&!owner&&!number&&!image) continue;
          const id=cleanId(r.dataset.id||provider||('pay_'+i));
          pays[id]={id,provider,entity:provider,name:provider,label:provider,accountName:owner,owner,accountOwner:owner,account:number,number,accountNumber:number,phone:number,image,logo:image,iconUrl:image,active:true,sort:i+1,updatedAt:now()};
        }
        const socials={};
        qa('.social-row').forEach((r,i)=>{
          const type=q('.soc-type',r)?.value.trim()||'website', label=q('.soc-label',r)?.value.trim()||type, url=q('.soc-url',r)?.value.trim()||'';
          if(!url&&!label) return;
          const id=cleanId(r.dataset.id||type||('soc_'+i));
          socials[id]={id,type,label,name:label,url,link:url,active:true,sort:i+1,updatedAt:now()};
        });
        const name=$('menuName')?.value.trim()||'مطعم أوسكار', theme=$('menuPrimary')?.value.trim()||ORANGE;
        Object.assign(s,{name,storeName:name,restaurantName:name,menuName:name,currency:$('currency')?.value.trim()||'₪',themeColor:theme,menuPrimary:theme,whatsapp:$('whatsapp')?.value.trim()||'',publicMenuUrl:$('menuBaseUrl')?.value.trim()||'',menuBaseUrl:$('menuBaseUrl')?.value.trim()||'',logoText:$('logoText')?.value.trim()||'R',logoImage:logo,menuLogo:logo,logo:logo,bannerEnabled:$('bannerEnabled')?.value!=='false',menuBannerEnabled:$('bannerEnabled')?.value!=='false',bannerTitle:$('bannerTitle')?.value.trim()||'',menuBannerTitle:$('bannerTitle')?.value.trim()||'',bannerSubtitle:$('bannerSubtitle')?.value.trim()||'',menuBannerSubtitle:$('bannerSubtitle')?.value.trim()||'',bannerImage:banner,menuBanner:banner,outsideEnabled:$('outsideEnabled')?.value!=='false',outsideTitle:$('outsideTitle')?.value.trim()||'طلب خارج المطعم',outsideText:$('outsideText')?.value.trim()||'',serviceRate:Number($('serviceRate')?.value||0),taxRate:Number($('taxRate')?.value||0),paymentMethods:pays,payments:pays,socials,_updatedAt:now()});
        d.restaurantPaymentMethods=Object.values(pays);d.restaurantSocialLinks=Object.values(socials);d.lastLocalUpdate=Date.now();
        await pushNow(d);
        try{if($('logoPreview'))$('logoPreview').src=logo;if($('bannerPreview'))$('bannerPreview').src=banner;}catch(e){}
        if(typeof window.toast==='function') window.toast('تم حفظ ومزامنة إعدادات المنيو فعليًا'); else alert('تم حفظ ومزامنة إعدادات المنيو فعليًا');
        setTimeout(()=>window.loadSettings&&window.loadSettings(),200);
      }catch(e){console.error(e); alert('تعذر حفظ الإعدادات: '+(e.message||e));}
      finally{try{if(btn&&btn.tagName==='BUTTON')btn.disabled=false;}catch(e){}}
    };
    setTimeout(()=>{try{window.loadSettings&&window.loadSettings()}catch(e){}},500);
  }
  function tableParam(){const p=new URLSearchParams(location.search);return p.get('table')||p.get('tableId')||p.get('t')||p.get('no')||'';}
  function applyMenu(){
    if(!/مطعم-المنيو-الرقمي\.html/i.test(location.pathname)) return;
    const d=readDB();const s=normalizeSettings(d);
    try{document.documentElement.style.setProperty('--brand',s.themeColor||ORANGE);}catch(e){}
    try{document.title=s.name||'المنيو'; if($('topName'))$('topName').textContent=s.name||'المنيو'; if($('drawerName'))$('drawerName').textContent=s.name||'المنيو';}catch(e){}
    const logoHtml=s.logoImage?'<img src="'+esc(s.logoImage)+'" alt="">':esc(s.logoText||'R');
    try{if($('topLogo'))$('topLogo').innerHTML=logoHtml; if($('drawerLogo'))$('drawerLogo').innerHTML=logoHtml;}catch(e){}
    try{
      const b=$('banner'); if(b){
        if(s.bannerEnabled!==false&&(s.bannerImage||s.bannerTitle||s.bannerSubtitle)){b.classList.add('show'); if($('bannerImg')){if(s.bannerImage){$('bannerImg').src=s.bannerImage;$('bannerImg').style.display='block'}else{$('bannerImg').removeAttribute('src');$('bannerImg').style.display='none'}} if($('bannerTitle'))$('bannerTitle').textContent=s.bannerTitle||s.menuBannerTitle||''; if($('bannerSub'))$('bannerSub').textContent=s.bannerSubtitle||s.menuBannerSubtitle||'';}
        else b.classList.remove('show');
      }
    }catch(e){}
    try{const o=$('outside'); if(o){if(s.outsideEnabled!==false){o.classList.add('show'); if($('outsideTitle'))$('outsideTitle').textContent=s.outsideTitle||'طلب خارج المطعم'; if($('outsideText'))$('outsideText').textContent=s.outsideText||'';}else o.classList.remove('show');}}catch(e){}
    const t=tableParam();
    try{if($('tableNote')){if(t){$('tableNote').style.display='block';$('tableNote').textContent='أنت تطلب من طاولة رقم '+t;}else $('tableNote').style.display='none';} if($('drawerTable')){if(t){$('drawerTable').style.display='block';$('drawerTable').textContent='أنت تطلب من طاولة رقم '+t;}else $('drawerTable').style.display='none';}}catch(e){}
    try{
      const arr=toList(s.socials).filter(x=>x.active!==false&&x.url).sort((a,b)=>Number(a.sort||0)-Number(b.sort||0));
      if($('drawerSocials')) $('drawerSocials').innerHTML=arr.length?arr.map(x=>'<a href="'+esc(socialHref(x.type,x.url))+'" target="_blank" title="'+esc(x.label||x.type)+'">'+icon(x.type)+'</a>').join(''):'<span style="color:#94a3b8;font-weight:900">لا توجد روابط تواصل</span>';
    }catch(e){}
    try{
      const pays=toList(s.paymentMethods||s.payments).filter(p=>p.active!==false&&(p.provider||p.entity||p.name||p.account||p.number||p.image||p.logo)).sort((a,b)=>Number(a.sort||0)-Number(b.sort||0));
      if($('drawerPayments')) $('drawerPayments').innerHTML=pays.length?'<h3>طرق الدفع</h3>'+pays.map(p=>{const name=p.provider||p.entity||p.name||p.label||'طريقة دفع', accName=p.accountName||p.owner||p.accountOwner||'', num=p.account||p.number||p.accountNumber||p.phone||'', img=p.image||p.logo||p.iconUrl||'';return '<div class="payMethodCard"><div class="payMethodText"><b>'+esc(name)+'</b>'+(accName?'<span>اسم الحساب: '+esc(accName)+'</span>':'')+(num?'<span>رقم الحساب أو الجوال: '+esc(num)+'</span>':'')+'</div>'+(img?'<img class="payMethodPic" src="'+esc(img)+'" alt="">':'<div class="payMethodPic" style="display:grid;place-items:center;color:#ea580b;font-weight:950">₪</div>')+'</div>';}).join(''):'';
    }catch(e){}
  }
  function installMenuPage(){
    if(!/مطعم-المنيو-الرقمي\.html/i.test(location.pathname)) return;
    const st=document.createElement('style');
    st.textContent=`.pic{height:190px!important;overflow:hidden}.pic img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important}.card{min-height:0}.drawer.show{display:block!important}.payMethodCard{display:flex!important;align-items:center!important;gap:10px!important}.payMethodPic{width:52px!important;height:52px!important;min-width:52px!important;border-radius:15px!important;object-fit:cover!important;background:#fff7ed!important;border:1px solid #fed7aa!important}.payMethodText{flex:1;min-width:0;text-align:right}.payMethodText span{display:block;word-break:break-word}@media(max-width:560px){.pic{height:210px!important}.banner{min-height:210px!important}}`;
    document.head.appendChild(st);
    window.openDrawer=function(){const el=$('drawer'); if(el)el.classList.add('show'); applyMenu();};
    window.closeDrawer=function(){const el=$('drawer'); if(el)el.classList.remove('show');};
    setTimeout(applyMenu,50);setTimeout(applyMenu,500);setTimeout(applyMenu,1500);
    let n=0;const int=setInterval(()=>{applyMenu(); if(++n>20)clearInterval(int)},1000);
    window.addEventListener('storage',applyMenu);window.addEventListener('oskar-db-updated',applyMenu);window.addEventListener('focus',applyMenu);
  }
  function patchTables(){
    if(!/مطعم-الطاولات\.html/i.test(location.pathname)) return;
    const int=setInterval(()=>{try{const d=readDB();const s=normalizeSettings(d);if($('baseUrl')&&!$('baseUrl').value){const base=(s.menuBaseUrl||s.publicMenuUrl||location.href.replace(/مطعم-الطاولات\.html.*/,'مطعم-المنيو-الرقمي.html'));$('baseUrl').placeholder=base;}}catch(e){}},1000);
    setTimeout(()=>clearInterval(int),15000);
  }
  installSettingsPage();installMenuPage();patchTables();
})();
