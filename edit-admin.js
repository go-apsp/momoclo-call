/* ページ編集ツール（管理側）: admin.html の #pearea に編集UIを出す。管理者ログイン時のみ表示される。 */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var db,FB,AU,me=null,isAdmin=false;
var blocks=[],pages=[],curArea="top",editId=null,imgData=null,imgChanged=false;
var SECTION_LABELS={members:"メンバー紹介",feed:"メンバーの最新投稿",video:"動画コーナー",free:"自由エリア（追加した項目）",note:"ページ下部の注意書き"};
var TEXT_KEYS=[
 {key:"members.title",label:"メンバー紹介の見出し"},
 {key:"members.intro",label:"メンバー紹介の文章"},
 {key:"feed.title",label:"最新投稿の見出し"},
 {key:"feed.note",label:"最新投稿の注記"},
 {key:"video.intro",label:"動画コーナーの説明文"},
 {key:"page.note",label:"ページ下部の注意書き"}
];
var COLORS=[["","指定なし"],["#333333","黒"],["#e60033","赤（りな）"],["#2b6fe2","青（りじゅ）"],["#12b5a5","ターコイズ（そら）"],["#f2b705","黄（もあ）"],["#9b7ed9","ラベンダー（るり）"],["#f07800","オレンジ（ゆう）"],["#ff5c8a","ピンク"],["#888888","グレー"]];
function opts(list,val){return list.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(val||"")===String(o[0])?" selected":"")+'>'+esc(o[1])+'</option>'}).join("")}
function typeLabel(t){return{heading:"見出し",text:"テキスト",link:"リンク",button:"ボタン",card:"カード",image:"画像",group:"まとめカード"}[t]||t}
function summarize(b){
  if(b.type==="card"||b.type==="group")return b.title||"（タイトルなし）";
  if(b.type==="image")return b.text||"（画像）";
  return b.text||"（文字なし）";
}
async function init(){
  var host=$("pearea");if(!host)return;
  var appM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  var fsM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  var auM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  var app=appM.initializeApp(window.PE_CONFIG,"pe");
  db=fsM.getFirestore(app);FB=fsM;AU=auM;
  auM.onAuthStateChanged(auM.getAuth(app),async function(u){
    me=u;isAdmin=false;
    if(u){try{var d=await FB.getDoc(FB.doc(db,"admins",u.uid));isAdmin=d.exists()}catch(e){}}
    if(isAdmin){render();loadAll()}
    else{host.innerHTML=""}
  });
}
function render(){
  var host=$("pearea");
  host.innerHTML=
  '<div class="pe-box"><h3>項目の編集</h3>'+
  '<div class="row"><label for="peArea">編集するページ</label><select id="peArea"></select></div>'+
  '<div class="row"><label for="peNewPage">新しいページを作る（名前）</label><input type="text" id="peNewPage" placeholder="例: お知らせ"></div>'+
  '<button type="button" id="peMkPage">ページを作る</button> <span id="pePageLink" style="font-size:13px"></span>'+
  '<div id="peList" style="margin-top:12px"></div>'+
  '<h3 style="margin-top:16px">項目の追加・編集</h3>'+
  '<div class="row"><label>種類</label><select id="peType">'+
  '<option value="heading">見出し</option><option value="text">テキスト</option><option value="link">リンク</option><option value="button">ボタン</option><option value="card">カード</option><option value="image">画像</option><option value="group">まとめカード</option></select></div>'+
  '<div class="row" data-f="text"><label>文字</label><input type="text" id="peText" placeholder="表示する文字"></div>'+
  '<div class="row" data-f="title"><label>タイトル</label><input type="text" id="peTitle" placeholder="タイトル"></div>'+
  '<div class="row" data-f="body"><label>本文</label><textarea id="peBody" rows="3" placeholder="本文"></textarea></div>'+
  '<div class="row" data-f="url"><label>リンク先URL</label><input type="text" id="peUrl" placeholder="https://…"></div>'+
  '<div class="row" data-f="linktext"><label>リンクの文字（カード用）</label><input type="text" id="peLinkText" placeholder="開く →"></div>'+
  '<div class="row" data-f="image"><label>画像ファイル</label><input type="file" id="peImg" accept="image/*"><div id="peImgPrev" style="margin-top:6px"></div></div>'+
  '<div class="row" data-f="height"><label>まとめカードの高さ</label><select id="peHeight"><option value="s">小</option><option value="m">中</option><option value="l">大</option></select></div>'+
  '<div class="row" data-f="parent"><label>入れるまとめカード</label><select id="peParent"><option value="">（入れない）</option></select></div>'+
  '<div class="row"><label>色</label><select id="peColor">'+opts(COLORS,"")+'</select></div>'+
  '<div class="row"><label>見た目のプリセット</label><select id="pePreset"><option value="std">標準</option><option value="ukka">ukka風</option><option value="momo">ももクロコール風</option></select></div>'+
  '<div class="row"><label>フォント</label><select id="peFont"><option value="">おまかせ</option><option value="round">丸ゴシック（M PLUS Rounded）</option><option value="maru">Zen Maru Gothic</option><option value="pop">ポップ（Mochiy Pop One）</option></select></div>'+
  '<div class="row"><label>文字の大きさ</label><select id="peSize"><option value="">おまかせ</option><option value="s">小</option><option value="m">中</option><option value="l">大</option><option value="xl">特大</option></select></div>'+
  '<div class="row"><label>太さ</label><select id="peWeight"><option value="">おまかせ</option><option value="bold">太く</option><option value="normal">ふつう</option></select></div>'+
  '<div class="row"><label>動き</label><select id="peAnim"><option value="none">なし</option><option value="fade">ふわっと現れる</option><option value="slide">下から上がる</option><option value="pop">ポップに弾む</option><option value="float">ゆらゆら浮く</option><option value="sparkle">キラキラ</option></select></div>'+
  '<div class="row"><label>動きの速さ</label><select id="peSpeed"><option value="slow">ゆっくり</option><option value="normal">ふつう</option><option value="fast">速い</option></select></div>'+
  '<div class="row" data-f="action"><label>押したときのアクション</label><select id="peAction"><option value="direct">そのまま移動</option><option value="confirm">確認ダイアログ付きで移動</option><option value="dialog">ダイアログだけ表示</option></select></div>'+
  '<div class="row" data-f="dlg"><label>ダイアログのタイトル</label><input type="text" id="peDlgTitle" placeholder="確認"></div>'+
  '<div class="row" data-f="dlg"><label>ダイアログの本文</label><textarea id="peDlgBody" rows="2"></textarea></div>'+
  '<div class="row" data-f="dlg"><label>OKボタンの文字</label><input type="text" id="peDlgOk" placeholder="OK"></div>'+
  '<div class="row" data-f="dlg"><label>キャンセルの文字（空欄ならキャンセルなし）</label><input type="text" id="peDlgCancel" placeholder="キャンセル"></div>'+
  '<div class="row"><label>表示する</label><input type="checkbox" id="peVisible" checked></div>'+
  '<button type="button" class="primary" id="peSave">保存する</button> <button type="button" id="peCancelEdit" style="display:none">編集をやめる</button>'+
  '</div>';
  $("peArea").addEventListener("change",function(){curArea=this.value;editId=null;imgData=null;imgChanged=false;loadBlocks()});
  $("peType").addEventListener("change",syncForm);
  $("peAction").addEventListener("change",syncForm);
  $("peImg").addEventListener("change",onImgPick);
  $("peSave").addEventListener("click",saveBlock);
  $("peCancelEdit").addEventListener("click",function(){clearForm()});
  $("peMkPage").addEventListener("click",mkPage);
  syncForm();
}
function syncForm(){
  var t=$("peType").value;
  var show={
    text:["heading","text","link","button"].indexOf(t)>=0,
    title:["card","group"].indexOf(t)>=0,
    body:t==="card",
    url:["link","button","card","image"].indexOf(t)>=0,
    linktext:t==="card",
    image:t==="image",
    height:t==="group",
    parent:t!=="group",
    action:["link","button","card","image"].indexOf(t)>=0,
    dlg:true
  };
  document.querySelectorAll("#pearea [data-f]").forEach(function(el){
    var f=el.getAttribute("data-f");
    el.style.display=show[f]?"":"none";
  });
  var act=$("peAction").value;
  document.querySelectorAll('#pearea [data-f="dlg"]').forEach(function(el){
    el.style.display=(show.action&&act!=="direct")?"":"none";
  });
}
function onImgPick(){
  var f=$("peImg").files&&$("peImg").files[0];
  if(!f)return;
  var img=new Image();
  img.onload=function(){
    var max=1100,sc=Math.min(1,max/Math.max(img.width,img.height));
    var cv=document.createElement("canvas");
    cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);
    cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
    imgData=cv.toDataURL("image/jpeg",0.82);imgChanged=true;
    $("peImgPrev").innerHTML='<img src="'+imgData+'" style="max-width:220px;border-radius:10px">';
    URL.revokeObjectURL(img.src);
  };
  img.src=URL.createObjectURL(f);
}
async function loadAll(){await loadPages();await loadBlocks()}
async function loadPages(){
  pages=[];
  try{var d=await FB.getDoc(FB.doc(db,"siteMeta","pages"));if(d.exists())pages=(d.data()||{}).list||[]}catch(e){}
  var sel=$("peArea");if(!sel)return;
  sel.innerHTML='<option value="top">トップページ</option>'+pages.map(function(p){return '<option value="page:'+esc(p.name)+'">ページ: '+esc(p.title||p.name)+'</option>'}).join("");
  sel.value=curArea;
  updPageLink();
}
function updPageLink(){
  var el=$("pePageLink");if(!el)return;
  if(curArea.indexOf("page:")===0){
    var nm=curArea.slice(5);
    el.innerHTML='このページのアドレス: <a href="page.html?p='+encodeURIComponent(nm)+'" target="_blank" rel="noopener">page.html?p='+esc(nm)+'</a>';
  }else el.textContent="";
}
async function mkPage(){
  var nm=$("peNewPage").value.trim();
  if(!nm){alert("ページの名前を入れてください");return}
  if(pages.some(function(p){return p.name===nm})){alert("その名前のページはもうあります");return}
  pages.push({name:nm,title:nm});
  await FB.setDoc(FB.doc(db,"siteMeta","pages"),{list:pages});
  $("peNewPage").value="";curArea="page:"+nm;
  await loadPages();await loadBlocks();
  alert("ページを作りました。下の「項目の追加・編集」で中身を足せます");
}
async function loadSections(){
  var host=$("peSecs");if(!host)return;
  var order=["members","feed","video","free","note"],hidden=[];
  try{var d=await FB.getDoc(FB.doc(db,"siteMeta","sections"));if(d.exists()){var v=d.data()||{};if(v.order&&v.order.length)order=v.order;hidden=v.hidden||[]}}catch(e){}
  host.innerHTML=order.map(function(k,i){
    return '<div class="item"><span class="n">'+esc(SECTION_LABELS[k]||k)+'</span> '+
    '<button data-sup="'+i+'">↑</button> <button data-sdn="'+i+'">↓</button> '+
    '<label style="font-size:13px"><input type="checkbox" data-shide="'+esc(k)+'"'+(hidden.indexOf(k)>=0?"":" checked")+'> 表示</label></div>';
  }).join("");
  host.querySelectorAll("[data-sup]").forEach(function(b){b.addEventListener("click",function(){moveSec(order,hidden,+b.getAttribute("data-sup"),-1)})});
  host.querySelectorAll("[data-sdn]").forEach(function(b){b.addEventListener("click",function(){moveSec(order,hidden,+b.getAttribute("data-sdn"),1)})});
  host.querySelectorAll("[data-shide]").forEach(function(c){c.addEventListener("change",function(){saveSecs(order,hidden)})});
  host._order=order;host._hidden=hidden;
}
async function saveSecs(order,hidden){
  var host=$("peSecs");
  var nh=[];
  host.querySelectorAll("[data-shide]").forEach(function(c){if(!c.checked)nh.push(c.getAttribute("data-shide"))});
  await FB.setDoc(FB.doc(db,"siteMeta","sections"),{order:order,hidden:nh});
  loadSections();
}
async function moveSec(order,hidden,i,d){
  var j=i+d;if(j<0||j>=order.length)return;
  var t=order[i];order[i]=order[j];order[j]=t;
  await saveSecs(order,hidden);
}
async function loadTexts(){
  var host=$("peTexts");if(!host)return;
  var docs={};
  try{var s=await FB.getDocs(FB.collection(db,"siteTexts"));s.forEach(function(d){docs[d.id]=d.data()||{}})}catch(e){}
  host.innerHTML=TEXT_KEYS.map(function(tk){
    var v=docs[tk.key]||{};
    return '<div class="pe-textrow"><p class="n" style="font-weight:700">'+esc(tk.label)+'</p>'+
    '<textarea id="pt-'+esc(tk.key)+'" rows="2" placeholder="（元の文章のまま）">'+esc(v.text||"")+'</textarea>'+
    '<div class="row"><label>色</label><select id="ptc-'+esc(tk.key)+'">'+opts(COLORS,v.color||"")+'</select></div>'+
    '<div class="row"><label>動き</label><select id="pta-'+esc(tk.key)+'"><option value="none">なし</option><option value="fade">ふわっと</option><option value="slide">下から</option><option value="pop">ポップ</option><option value="float">ゆらゆら</option><option value="sparkle">キラキラ</option></select></div>'+
    '<div class="row"><label>速さ</label><select id="pts-'+esc(tk.key)+'"><option value="slow">ゆっくり</option><option value="normal">ふつう</option><option value="fast">速い</option></select></div>'+
    '<label style="font-size:13px"><input type="checkbox" id="ptv-'+esc(tk.key)+'"'+(v.visible===false?"":" checked")+'> 表示</label> '+
    '<button data-ptsave="'+esc(tk.key)+'">保存</button> <button data-ptreset="'+esc(tk.key)+'">もとに戻す</button></div>';
  }).join("");
  TEXT_KEYS.forEach(function(tk){
    var v=docs[tk.key]||{};
    var a=$("pta-"+tk.key);if(a)a.value=v.anim||"none";
    var s=$("pts-"+tk.key);if(s)s.value=v.speed||"normal";
  });
  host.querySelectorAll("[data-ptsave]").forEach(function(b){b.addEventListener("click",async function(){
    var k=b.getAttribute("data-ptsave");
    await FB.setDoc(FB.doc(db,"siteTexts",k),{
      text:$("pt-"+k).value, color:$("ptc-"+k).value, anim:$("pta-"+k).value, speed:$("pts-"+k).value, visible:$("ptv-"+k).checked
    });
    alert("保存しました");
  })});
  host.querySelectorAll("[data-ptreset]").forEach(function(b){b.addEventListener("click",async function(){
    if(!confirm("この文章の設定をもとに戻しますか？"))return;
    await FB.deleteDoc(FB.doc(db,"siteTexts",b.getAttribute("data-ptreset")));
    loadTexts();
  })});
}
async function loadBlocks(){
  var host=$("peList");if(!host)return;
  updPageLink();
  blocks=[];
  try{
    var q=FB.query(FB.collection(db,"pageBlocks"),FB.where("area","==",curArea));
    var s=await FB.getDocs(q);
    s.forEach(function(d){var b=d.data()||{};b.id=d.id;blocks.push(b)});
  }catch(e){}
  blocks.sort(function(a,b){return (a.order||0)-(b.order||0)});
  var groups=blocks.filter(function(b){return b.type==="group"});
  var psel=$("peParent");
  if(psel){var cur=psel.value;psel.innerHTML='<option value="">（入れない）</option>'+groups.map(function(g){return '<option value="'+g.id+'">'+esc(g.title||"まとめカード")+'</option>'}).join("");psel.value=cur}
  function row(b,indent){
    return '<div class="item" style="'+(indent?"margin-left:22px":"")+'"><span class="n">['+esc(typeLabel(b.type))+'] '+esc(summarize(b))+'</span>'+
    (b.visible===false?' <span style="color:var(--sub);font-size:12px">（非表示）</span>':"")+
    '<br><button data-bup="'+b.id+'">↑</button> <button data-bdn="'+b.id+'">↓</button> <button data-bed="'+b.id+'">編集</button> <button data-bdel="'+b.id+'">削除</button></div>';
  }
  var html="";
  blocks.filter(function(b){return !b.parentId}).forEach(function(b){
    html+=row(b,false);
    if(b.type==="group"){
      blocks.filter(function(k){return k.parentId===b.id}).forEach(function(k){html+=row(k,true)});
    }
  });
  host.innerHTML=html||'<p class="empty">まだ項目がありません。下のフォームから追加できます。</p>';
  host.querySelectorAll("[data-bup]").forEach(function(x){x.addEventListener("click",function(){moveBlock(x.getAttribute("data-bup"),-1)})});
  host.querySelectorAll("[data-bdn]").forEach(function(x){x.addEventListener("click",function(){moveBlock(x.getAttribute("data-bdn"),1)})});
  host.querySelectorAll("[data-bed]").forEach(function(x){x.addEventListener("click",function(){fillForm(x.getAttribute("data-bed"))})});
  host.querySelectorAll("[data-bdel]").forEach(function(x){x.addEventListener("click",function(){delBlock(x.getAttribute("data-bdel"))})});
}
function siblingsOf(b){
  return blocks.filter(function(x){return (x.parentId||"")===(b.parentId||"")});
}
async function moveBlock(id,d){
  var b=null;blocks.forEach(function(x){if(x.id===id)b=x});
  if(!b)return;
  var sib=siblingsOf(b);
  var i=sib.indexOf(b),j=i+d;
  if(j<0||j>=sib.length)return;
  var t=sib[i];sib[i]=sib[j];sib[j]=t;
  for(var k=0;k<sib.length;k++){
    sib[k].order=k;
    await FB.updateDoc(FB.doc(db,"pageBlocks",sib[k].id),{order:k});
  }
  loadBlocks();
}
function fillForm(id){
  var b=null;blocks.forEach(function(x){if(x.id===id)b=x});
  if(!b)return;
  editId=id;imgData=null;imgChanged=false;
  $("peType").value=b.type||"text";
  $("peText").value=b.text||"";$("peTitle").value=b.title||"";$("peBody").value=b.body||"";
  $("peUrl").value=b.url||"";$("peLinkText").value=b.linkText||"";
  $("peHeight").value=b.height||"m";
  $("peColor").value=b.color||"";$("pePreset").value=b.preset||"std";$("peFont").value=b.font||"";
  $("peSize").value=b.size||"";$("peWeight").value=b.weight||"";
  $("peAnim").value=b.anim||"none";$("peSpeed").value=b.speed||"normal";
  $("peAction").value=b.action||"direct";
  $("peDlgTitle").value=b.dlgTitle||"";$("peDlgBody").value=b.dlgBody||"";$("peDlgOk").value=b.dlgOk||"";$("peDlgCancel").value=b.dlgCancel||"";
  $("peVisible").checked=b.visible!==false;
  $("peParent").value=b.parentId||"";
  $("peImgPrev").innerHTML=b.imageId?'<span style="font-size:13px;color:var(--sub)">画像は登録済みです（変えるときは新しいファイルを選んでください）</span>':"";
  $("peCancelEdit").style.display="";
  syncForm();
  window.scrollTo({top:$("peSave").offsetTop-200,behavior:"smooth"});
}
function clearForm(){
  editId=null;imgData=null;imgChanged=false;
  ["peText","peTitle","peBody","peUrl","peLinkText","peDlgTitle","peDlgBody","peDlgOk","peDlgCancel"].forEach(function(id){var e=$(id);if(e)e.value=""});
  var f=$("peImg");if(f)f.value="";
  $("peImgPrev").innerHTML="";$("peCancelEdit").style.display="none";
  $("peVisible").checked=true;
  syncForm();
}
async function saveBlock(){
  var t=$("peType").value;
  var data={
    area:curArea,type:t,
    text:$("peText").value,title:$("peTitle").value,body:$("peBody").value,
    url:$("peUrl").value.trim(),linkText:$("peLinkText").value,
    height:$("peHeight").value,
    parentId:(t==="group")?"":$("peParent").value,
    color:$("peColor").value,preset:$("pePreset").value,font:$("peFont").value,
    size:$("peSize").value,weight:$("peWeight").value,
    anim:$("peAnim").value,speed:$("peSpeed").value,
    action:$("peAction").value,
    dlgTitle:$("peDlgTitle").value,dlgBody:$("peDlgBody").value,dlgOk:$("peDlgOk").value,dlgCancel:$("peDlgCancel").value,
    visible:$("peVisible").checked
  };
  var old=null;if(editId)blocks.forEach(function(x){if(x.id===editId)old=x});
  if(t==="image"&&imgChanged&&imgData){
    var ref=await FB.addDoc(FB.collection(db,"pageImages"),{data:imgData});
    data.imageId=ref.id;
    if(old&&old.imageId){try{await FB.deleteDoc(FB.doc(db,"pageImages",old.imageId))}catch(e){}}
  }else if(old){data.imageId=old.imageId||""}
  if(editId){
    await FB.updateDoc(FB.doc(db,"pageBlocks",editId),data);
  }else{
    var sib=blocks.filter(function(x){return (x.parentId||"")===(data.parentId||"")});
    data.order=sib.length;
    await FB.addDoc(FB.collection(db,"pageBlocks"),data);
  }
  clearForm();loadBlocks();
  alert("保存しました");
}
async function delBlock(id){
  var b=null;blocks.forEach(function(x){if(x.id===id)b=x});
  if(!b)return;
  if(!confirm("この項目を削除しますか？"))return;
  if(b.type==="group"){
    var kids=blocks.filter(function(x){return x.parentId===id});
    for(var i=0;i<kids.length;i++){await FB.updateDoc(FB.doc(db,"pageBlocks",kids[i].id),{parentId:""})}
  }
  if(b.imageId){try{await FB.deleteDoc(FB.doc(db,"pageImages",b.imageId))}catch(e){}}
  await FB.deleteDoc(FB.doc(db,"pageBlocks",id));
  if(editId===id)clearForm();
  loadBlocks();
}
document.addEventListener("DOMContentLoaded",function(){init().catch(function(){})});
})();
