(function(){
  'use strict';
  const APP='supermarket_pos_ar_v1';
  function N(v){return Number(v||0)||0}
  function E(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function db(){try{return JSON.parse(localStorage.getItem(APP)||'{}')||{}}catch(e){return {}}}
  function save(d){try{localStorage.setItem(APP,JSON.stringify(d||{}));window.DB=d;if(window.FirebaseBridge&&FirebaseBridge.queueSync)FirebaseBridge.queueSync(d);if(window.RestaurantRealtimeMirror&&RestaurantRealtimeMirror.queue)RestaurantRealtimeMirror.queue(d);}catch(e){console.warn(e)}}
  function ensure(){let d=db();['restaurantMenu','restaurantCategories','restaurantOrders','restaurantSales','sales','restaurantProductionBatches','restaurantProductionMovements'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});save(d);return d}
  function dishes(q){let d=ensure();q=String(q||'').toLowerCase();return d.restaurantMenu.filter(x=>x && x.active!=='غير نشط' && x.status!=='غير نشط' && x._deleted!==true && (!q || [x.name,x.category,x.barcode,x.sku].join(' ').toLowerCase().includes(q))).map(x=>({id:'rest:'+x.id,_searchId:'rest:'+x.id,_kind:'restaurant',restaurantDishId:x.id,name:x.name||'وجبة',sku:x.barcode||x.sku||('REST-'+x.id),barcode:x.barcode||x.sku||'',salePrice:N(x.price),unitSalePrice:N(x.price),price:N(x.price),stock:'إنتاج',category:x.category||'عام',image:x.image||x.mainImage||x.imageUrl||''})).slice(0,100)}
  window.productSearch=function(q){return dishes(q)};try{productSearch=window.productSearch}catch(e){}
  window.productUnitOptions=function(p){return [{label:'وجبة',value:'وجبة',factor:1,price:N(p&&(p.salePrice||p.price))}]};try{productUnitOptions=window.productUnitOptions}catch(e){}
  window.addProductToCart=function(id){
    let did=String(id||'').replace(/^rest:/,'');
    let p=dishes('').find(x=>String(x.restaurantDishId)===did || String(x.id)===String(id));
    if(!p){ if(window.toast)toast('هذا الكاشير يعرض وجبات المطعم فقط'); return; }
    window.cart=window.cart||[]; try{ if(typeof cart!=='undefined') window.cart=cart; }catch(e){}
    const line={productId:'rest:'+did,restaurantDishId:did,isRestaurant:true,name:p.name,sku:p.sku,barcode:p.barcode,unit:'وجبة',factor:1,qty:1,unitPrice:p.price,discount:0,total:p.price,source:'restaurant_menu'};
    try{cart.push(line)}catch(e){window.cart.push(line)}
    if(window.renderCart)renderCart();
  };try{addProductToCart=window.addProductToCart}catch(e){}
  window.showProductResults=function(q){
    let el=document.getElementById('productResults'); if(!el)return;
    let rows=dishes(q);
    el.innerHTML=rows.map(p=>`<div class="product-card restaurant-dish" onclick="addProductToCart('${E(p._searchId)}')"><b>${E(p.name)}</b><span class="restaurant-badge">وجبة مطعم</span><div class="muted">${E(p.sku||p.category||'')}</div><div>السعر: ${typeof money==='function'?money(p.price):p.price}</div><div class="status info">يخصم من نظام الإنتاج والهدر</div></div>`).join('') || '<div class="muted">لا توجد وجبات مطعم</div>';
  };try{showProductResults=window.showProductResults}catch(e){}
  function recordSaleToProduction(rec){
    try{
      if(!rec || !window.RestaurantProduction)return;
      const order={id:'cashier-prod-'+(rec.id||Date.now()),no:rec.invoiceNo||('INV-'+Date.now()),source:'main_cashier',status:'delivered',paymentStatus:'paid',deliveredAt:new Date().toISOString(),createdAt:rec.createdAt||new Date().toISOString(),total:N(rec.total),items:(rec.items||[]).filter(i=>i.restaurantDishId||String(i.productId||'').startsWith('rest:')).map(i=>({restaurantDishId:i.restaurantDishId||String(i.productId||'').replace(/^rest:/,''),menuId:i.restaurantDishId||String(i.productId||'').replace(/^rest:/,''),id:i.restaurantDishId||String(i.productId||'').replace(/^rest:/,''),name:i.name,qty:N(i.qty||1),price:N(i.unitPrice||i.price),total:N(i.total)||N(i.qty||1)*N(i.unitPrice||i.price)}))};
      if(order.items.length)RestaurantProduction.recordOrder(order,'main_cashier');
    }catch(e){console.warn('production sale record failed',e)}
  }
  const installSavePatch=function(){
    if(typeof window.saveSaleLike!=='function' || window.saveSaleLike.__restaurantProdFinal)return false;
    const old=window.saveSaleLike;
    window.saveSaleLike=function(collectionName='sales',flags={}){
      flags={...(flags||{}),print:false};
      const before=(typeof collection==='function')?[...(collection(collectionName)||[])]:[];
      const res=old.call(this,collectionName,flags);
      setTimeout(function(){
        try{
          let after=(typeof collection==='function')?(collection(collectionName)||[]):[];
          let rec=after.find(x=>!before.some(b=>String(b.id)===String(x.id))) || after[0];
          if(rec)recordSaleToProduction(rec);
        }catch(e){console.warn(e)}
      },100);
      return res;
    };
    window.saveSaleLike.__restaurantProdFinal=true; try{saveSaleLike=window.saveSaleLike}catch(e){}
    return true;
  };
  const installRenderPatch=function(){
    if(typeof window.renderCashier==='function' && !window.renderCashier.__restaurantProdFinal){
      const oldRender=window.renderCashier;
      window.renderCashier=function(){let r=oldRender.apply(this,arguments);setTimeout(function(){let ps=document.getElementById('productSearch');if(ps)ps.placeholder='بحث أو باركود — وجبات المطعم فقط';showProductResults('');let btn=document.querySelector('button[onclick*="saveSaleLike"]');if(btn)btn.textContent='حفظ البيع';},30);return r};
      window.renderCashier.__restaurantProdFinal=true; try{renderCashier=window.renderCashier}catch(e){}
    }
  };
  function boot(){ensure();installSavePatch();installRenderPatch();setTimeout(()=>{installSavePatch();installRenderPatch();if(window.CFG&&CFG.kind==='cashier'&&window.renderPage)renderPage();},120)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
