/* ページ編集ツール（表示側）: Firestoreの pageBlocks / pageImages / siteTexts / siteMeta を読んで表示に反映する。失敗してもページは通常通り表示される。 */
(function(){
"use strict";
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var AREA=window.PAGE_AREA||"top";
var DUR={slow:1.4,normal:0.8,fast:0.4};
var FDUR={slow:3.2,normal:2.2,fast:1.3};
var REG={};
function animDecl(b){
  var a=b.anim||"none";if(a==="none")return "";
  if(a==="float"||a==="sparkle")return "animation-duration:"+(FDUR[b.speed||"normal"]||2.2)+"s;";
  return "animation-duration:"+(DUR[b.speed||"normal"]||0.8)+"s;";
}
function animClass(b){var a=b.anim||"none";return a==="none"?"":" pa-"+a}
function textStyle(b){
  var s="";
  if(b.color)s+="color:"+b.color+";";
  if(b.font==="round")s+="font-family:'M PLUS Rounded 1c',sans-serif;";
  if(b.font==="maru")s+="font-family:'Zen Maru Gothic',sans-serif;";
  if(b.font==="pop")s+="font-family:'Mochiy Pop One','Zen Maru Gothic',sans-serif;";
  if(b.size==="s")s+="font-size:13px;";
  if(b.size==="m")s+="font-size:16px;";
  if(b.size==="l")s+="font-size:20px;";
  if(b.size==="xl")s+="font-size:26px;";
  if(b.weight==="bold")s+="font-weight:700;";
  if(b.weight==="normal")s+="font-weight:400;";
  return s;
}
function showDialog(b){
  var old=document.querySelector(".pdlg-ov");if(old)old.remove();
  var ov=document.createElement("div");ov.className="pdlg-ov";
  var hasCancel=!!(b.dlgCancel&&b.dlgCancel!=="");
  ov.innerHTML='<div class="pdlg"><p class="pdlg-t">'+esc(b.dlgTitle||"確認")+'</p><p class="pdlg-b">'+esc(b.dlgBody||"")+'</p><div class="pdlg-btns">'+(hasCancel?'<button type="button" class="pdlg-c">'+esc(b.dlgCancel)+'</button>':"")+'<button type="button" class="pdlg-ok">'+esc(b.dlgOk||"OK")+'</button></div></div>';
  document.body.appendChild(ov);
  function close(){ov.remove()}
  ov.addEventListener("click",function(e){if(e.target===ov)close()});
  var c=ov.querySelector(".pdlg-c");if(c)c.addEventListener("click",close);
  ov.querySelector(".pdlg-ok").addEventListener("click",function(){
    close();
    if(b.action==="confirm"&&b.url)location.href=b.url;
  });
}
function actAttrs(b){
  if(b.id)REG[b.id]=b;
  return ' data-act="'+esc(b.action||"direct")+'" data-bid="'+esc(b.id||"")+'" data-url="'+esc(b.url||"")+'"';
}
function blockHTML(b,imgs,children){
  if(b.visible===false)return "";
  var ts=textStyle(b)+animDecl(b),ac=animClass(b);
  var pre='pb pb-'+(b.preset||"std");
  var st=' style="'+ts+'"';
  if(b.type==="heading"){
    return '<h3 class="'+pre+' pb-h'+ac+'"'+st+'>'+esc(b.text||"")+'</h3>';
  }
  if(b.type==="text"){
    return '<p class="'+pre+' pb-t'+ac+'"'+st+'>'+esc(b.text||"")+'</p>';
  }
  if(b.type==="link"){
    if(!b.action||b.action==="direct"){
      return '<p class="pb-line"><a class="'+pre+' pb-a'+ac+'"'+st+' href="'+esc(b.url||"#")+'">'+esc(b.text||"")+'</a></p>';
    }
    return '<p class="pb-line"><span class="'+pre+' pb-a'+ac+'"'+st+actAttrs(b)+'>'+esc(b.text||"")+'</span></p>';
  }
  if(b.type==="button"){
    return '<p class="pb-line"><span class="'+pre+' pb-btn'+ac+'"'+st+actAttrs(b)+'>'+esc(b.text||"")+'</span></p>';
  }
  if(b.type==="card"){
    var lk="";
    if(b.url){lk='<div class="pb-card-lk"><span class="pb-a"'+actAttrs(b)+'>'+esc(b.linkText||"開く →")+'</span></div>'}
    return '<div class="'+pre+' pb-card'+ac+'" style="'+animDecl(b)+'"><p class="pb-card-t" style="'+textStyle(b)+'">'+esc(b.title||"")+'</p><p class="pb-card-b" style="'+textStyle(b)+'">'+esc(b.body||"")+'</p>'+lk+'</div>';
  }
  if(b.type==="image"){
    var src=b.imageId?(imgs[b.imageId]||""):(b.imageUrl||"");
    if(!src)return "";
    var img='<img class="pb-img" src="'+esc(src)+'" alt="'+esc(b.text||"")+'">';
    var wrap;
    if(b.url||b.action==="dialog"){wrap='<span class="'+pre+' pb-imgwrap'+ac+'" style="'+animDecl(b)+'"'+actAttrs(b)+'>'+img+'</span>'}
    else{wrap='<div class="'+pre+' pb-imgwrap'+ac+'" style="'+animDecl(b)+'">'+img+'</div>'}
    if(b.text)wrap+='<p class="pb-cap" style="'+textStyle(b)+'">'+esc(b.text)+'</p>';
    return wrap;
  }
  if(b.type==="group"){
    var kids=(children[b.id]||[]).map(function(k){return blockHTML(k,imgs,children)}).join("");
    return '<div class="'+pre+' pb-group'+ac+'" style="'+animDecl(b)+'"><p class="pb-group-t" style="'+textStyle(b)+'">'+esc(b.title||"")+'</p><div class="pb-group-in gh-'+(b.height||"m")+'">'+kids+'</div></div>';
  }
  return "";
}
async function init(){
  var appM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  var fsM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  var app=appM.initializeApp(window.PE_CONFIG,"pe");
  var db=fsM.getFirestore(app);
  try{
    var sm=await fsM.getDoc(fsM.doc(db,"siteMeta","sections"));
    if(sm.exists()){
      var sd=sm.data()||{};
      var secs=document.querySelectorAll("[data-section]");
      secs.forEach(function(el){
        if((sd.hidden||[]).indexOf(el.getAttribute("data-section"))>=0)el.style.display="none";
      });
      if(sd.order&&sd.order.length&&secs.length){
        var parent=secs[0].parentNode;
        var map={};
        secs.forEach(function(el){map[el.getAttribute("data-section")]=el});
        sd.order.forEach(function(k){if(map[k])parent.appendChild(map[k])});
      }
    }
  }catch(e){}
  try{
    var st=await fsM.getDocs(fsM.collection(db,"siteTexts"));
    st.forEach(function(d){
      var v=d.data()||{};
      document.querySelectorAll('[data-tkey="'+d.id+'"]').forEach(function(el){
        if(v.visible===false){el.style.display="none";return}
        if(v.text)el.textContent=v.text;
        if(v.color)el.style.color=v.color;
        if(v.anim&&v.anim!=="none"){
          el.classList.add("pa-"+v.anim);
          var dur=(v.anim==="float"||v.anim==="sparkle")?(FDUR[v.speed||"normal"]||2.2):(DUR[v.speed||"normal"]||0.8);
          el.style.animationDuration=dur+"s";
        }
      });
    });
  }catch(e){}
  if(AREA.indexOf("page:")===0){
    try{
      var pm=await fsM.getDoc(fsM.doc(db,"siteMeta","pages"));
      var list=(pm.exists()&&(pm.data()||{}).list)||[];
      var nm=AREA.slice(5);
      list.forEach(function(p){if(p.name===nm){
        document.title=p.title||nm;
        var h=document.getElementById("ptitle");if(h)h.textContent=p.title||nm;
      }});
    }catch(e){}
  }
  var host=document.getElementById("freearea");
  if(!host)return;
  try{
    var q=fsM.query(fsM.collection(db,"pageBlocks"),fsM.where("area","==",AREA));
    var snap=await fsM.getDocs(q);
    var blocks=[];
    snap.forEach(function(d){var b=d.data()||{};b.id=d.id;blocks.push(b)});
    blocks.sort(function(a,b2){return (a.order||0)-(b2.order||0)});
    var imgs={};
    var need=blocks.filter(function(b){return b.imageId});
    for(var i=0;i<need.length;i++){
      try{var im=await fsM.getDoc(fsM.doc(db,"pageImages",need[i].imageId));if(im.exists())imgs[need[i].imageId]=(im.data()||{}).data||""}catch(e){}
    }
    var children={},tops=[];
    blocks.forEach(function(b){if(b.parentId){(children[b.parentId]=children[b.parentId]||[]).push(b)}else{tops.push(b)}});
    host.innerHTML=tops.map(function(b){return blockHTML(b,imgs,children)}).join("");
    host.addEventListener("click",function(ev){
      var el=ev.target.closest("[data-act]");
      if(!el)return;
      var b=REG[el.getAttribute("data-bid")];
      if(!b)return;
      if((b.action||"direct")==="direct"){if(b.url)location.href=b.url;return}
      showDialog(b);
    });
  }catch(e){}
}
document.addEventListener("DOMContentLoaded",function(){init().catch(function(){})});
})();
