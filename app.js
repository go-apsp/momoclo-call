(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmt(t){t=Math.max(0,Math.floor(t||0));var m=Math.floor(t/60),s=t%60;return m+":"+(s<10?"0":"")+s}

var BUILTIN=[
 {youtubeId:"1Bsn_63O9sY",title:"ukka「Final Chapter」＠Kanadevia Hall (2026.05.24)",builtin:true},
 {youtubeId:"pd4gCJTcRAA",title:"〖ライブ映像〗ukka新体制お披露目ワンマンライブ「New Chapter “7”」",builtin:true}
];

var db=null,FB=null;
var videos=BUILTIN.slice(),curVid=BUILTIN[0].youtubeId,cmts=[];
var player=null,ready=false,playing=false,dragging=false;
var baseT=0,baseAt=0; // 表示位置の補間用

function now(){
  if(!player||!ready)return 0;
  try{
    if(playing)return baseT+(performance.now()-baseAt)/1000;
    return player.getCurrentTime()||0;
  }catch(e){return 0}
}
function dur(){try{return (player&&ready&&player.getDuration())||0}catch(e){return 0}}

function showErr(msg){var e=$("err");e.textContent=msg;e.style.display="block"}
function hideErr(){$("err").style.display="none"}

/* ---------- Firebase ---------- */
async function initFB(){
  var appM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  var fsM=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  var app=appM.initializeApp(window.FB_CONFIG);
  db=fsM.getFirestore(app);
  FB=fsM;
}
async function loadVideos(){
  videos=BUILTIN.slice();
  try{
    var snap=await FB.getDocs(FB.collection(db,"videos"));
    var extra=[];
    snap.forEach(function(d){var v=d.data();if(v&&v.youtubeId)extra.push({youtubeId:v.youtubeId,title:v.title||v.youtubeId,order:(typeof v.order==="number"?v.order:999)})});
    extra.sort(function(a,b){return a.order-b.order});
    extra.forEach(function(v){if(!videos.some(function(x){return x.youtubeId===v.youtubeId}))videos.push(v)});
  }catch(e){/* ルール未公開時などは内蔵動画だけで続行 */}
  var sel=$("vidsel");sel.innerHTML="";
  videos.forEach(function(v){
    var o=document.createElement("option");o.value=v.youtubeId;o.textContent=v.title;sel.appendChild(o);
  });
  sel.value=curVid;
}
async function loadComments(){
  cmts=[];
  try{
    var q=FB.query(FB.collection(db,"comments"),FB.where("videoId","==",curVid));
    var snap=await FB.getDocs(q);
    snap.forEach(function(d){var c=d.data();if(c)cmts.push({id:d.id,name:c.name||"",text:c.text||"",t:(typeof c.t==="number"?c.t:0)})});
    cmts.sort(function(a,b){return a.t-b.t});
    hideErr();
  }catch(e){
    showErr("コメントを読み込めませんでした。時間をおいて開き直してみてください。");
  }
  renderList();
}
function renderList(){
  var el=$("clist");
  if(!cmts.length){el.innerHTML='<p class="empty">まだコメントがありません。最初のコメントをどうぞ。</p>';return}
  el.innerHTML=cmts.map(function(c){
    return '<button class="item" data-t="'+c.t+'"><span class="t">'+fmt(c.t)+'</span><span class="n">'+esc(c.name)+'</span>'+esc(c.text)+'</button>';
  }).join("");
}

/* ---------- YouTube ---------- */
window.onYouTubeIframeAPIReady=function(){
  player=new YT.Player("yt",{
    videoId:curVid,
    playerVars:{playsinline:1,rel:0},
    events:{
      onReady:function(){ready=true;try{baseT=player.getCurrentTime()||0}catch(e){}baseAt=performance.now();requestAnimationFrame(loop)},
      onStateChange:function(ev){
        if(ev.data===YT.PlayerState.PLAYING){playing=true;try{baseT=player.getCurrentTime()||0}catch(e){}baseAt=performance.now();$("playbtn").textContent="⏸ 一時停止"}
        else{playing=false;if(ev.data===YT.PlayerState.PAUSED)$("playbtn").textContent="▶ 再生"}
      }
    }
  });
};
function loadYT(){
  var s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";document.head.appendChild(s);
}
function seekTo(t){
  if(!player||!ready)return;
  var d=dur();t=Math.max(0,d?Math.min(t,d):t);
  player.seekTo(t,true);baseT=t;baseAt=performance.now();
}

/* ---------- カード表示 ---------- */
function activeCards(span,max){
  var n=now(),out=[];
  for(var i=0;i<cmts.length;i++){var c=cmts[i];if(c.t<=n&&n<c.t+span)out.push(c)}
  if(out.length>max)out=out.slice(out.length-max);
  return out;
}
var lastBelow="",lastOvl="";
function paint(){
  var below=activeCards(12,3);
  var key=below.map(function(c){return c.id}).join(",");
  if(key!==lastBelow){
    lastBelow=key;
    $("cards").innerHTML=below.map(function(c){
      return '<div class="card"><span class="t">'+fmt(c.t)+'</span><span class="n">'+esc(c.name)+'</span><p>'+esc(c.text)+'</p></div>';
    }).join("");
  }
  var ovl=activeCards(5,3);
  var key2=ovl.map(function(c){return c.id}).join(",");
  if(key2!==lastOvl){
    lastOvl=key2;
    $("ovl").innerHTML=ovl.map(function(c){
      return '<div class="ovcard"><span class="t">'+fmt(c.t)+'</span><span class="n">'+esc(c.name)+'</span>'+esc(c.text)+'</div>';
    }).join("");
  }
}
function loop(){
  var n=now(),d=dur();
  $("tm").textContent=fmt(n);$("dur").textContent=fmt(d);
  if(!dragging&&d>0)$("bar").value=Math.round(n/d*1000);
  paint();
  requestAnimationFrame(loop);
}

/* ---------- クイズ ---------- */
var QUIZ=[
 {q:"結城りなさんがukkaに加入したのはいつ？",opts:["2019年11月","2021年9月","2023年4月"],ans:1,exp:"2021年9月25日、オーディション「Brand New ukka!」で葵るりさんとともに加入が発表されました。"},
 {q:"『KUNOICHI 13』で、りなさんが初めて1stステージをクリアしたときの残り時間は？",opts:["残り5秒","残り25秒","残り1分"],ans:1,exp:"残り25秒でクリア。前回落下したドラゴングライダーへのリベンジでした。"},
 {q:"『SASUKE 43』での結城りなさんのゼッケン番号は？",opts:["16番","24番","41番"],ans:2,exp:"41番。アイドル予選会2025で優勝し、本戦への出場権を掴みました。"}
];
function renderQuiz(){
  $("quiz").innerHTML=QUIZ.map(function(it,qi){
    return '<div class="q"><b>Q'+(qi+1)+". "+esc(it.q)+'</b><div class="opts">'+
      it.opts.map(function(o,oi){return '<button data-q="'+qi+'" data-o="'+oi+'">'+esc(o)+'</button>'}).join("")+
      '</div><p class="exp" id="exp'+qi+'" style="display:none"></p></div>';
  }).join("");
}

/* ---------- イベント ---------- */
document.addEventListener("click",function(ev){
  var sk=ev.target.closest("[data-seek]");
  if(sk){seekTo(now()+parseFloat(sk.getAttribute("data-seek")));return}
  var it=ev.target.closest(".item");
  if(it){seekTo(parseFloat(it.getAttribute("data-t")));if(player&&ready)player.playVideo();return}
  var qb=ev.target.closest(".quiz .opts button");
  if(qb){
    var qi=+qb.getAttribute("data-q"),oi=+qb.getAttribute("data-o"),it2=QUIZ[qi];
    var box=qb.parentElement;box.querySelectorAll("button").forEach(function(b){b.classList.remove("sel")});
    qb.classList.add("sel");
    var ex=$("exp"+qi);ex.style.display="block";
    ex.textContent=(oi===it2.ans?"正解！ ":"残念、正解は「"+it2.opts[it2.ans]+"」。 ")+it2.exp;
    return;
  }
});
$("playbtn").addEventListener("click",function(){
  if(!player||!ready)return;
  if(playing)player.pauseVideo();else player.playVideo();
});
$("bar").addEventListener("input",function(){
  dragging=true;var d=dur();if(d>0){var t=d*this.value/1000;$("tm").textContent=fmt(t)}
});
$("bar").addEventListener("change",function(){
  var d=dur();if(d>0)seekTo(d*this.value/1000);dragging=false;
});
$("vidsel").addEventListener("change",function(){
  curVid=this.value;lastBelow="";lastOvl="";$("cards").innerHTML="";$("ovl").innerHTML="";
  if(player&&ready){player.loadVideoById(curVid);baseT=0;baseAt=performance.now()}
  loadComments();
});
$("ovtoggle").addEventListener("click",function(){
  var ovl=$("ovl"),inside=ovl.classList.contains("inside");
  ovl.classList.toggle("inside",!inside);ovl.classList.toggle("outside",inside);
  this.textContent="表示: "+(inside?"枠外":"枠内");
  try{localStorage.setItem("ukka-overlay-position",inside?"outside":"inside")}catch(e){}
});
$("fsbtn").addEventListener("click",function(){
  var w=$("mvwrap");
  if(document.fullscreenElement){document.exitFullscreen()}
  else if(w.requestFullscreen){w.requestFullscreen()}
  else if(w.webkitRequestFullscreen){w.webkitRequestFullscreen()}
});
$("fsexit").addEventListener("click",function(){if(document.fullscreenElement)document.exitFullscreen()});
document.addEventListener("fullscreenchange",function(){
  $("fsexit").style.display=document.fullscreenElement?"block":"none";
});
$("addbtn").addEventListener("click",async function(){
  var name=$("nick").value.trim(),text=$("ctext").value.trim();
  if(!name){alert("ニックネームを入れてください");return}
  if(!text){alert("コメントを書いてください");return}
  if(!db){alert("まだ準備中です。少し待ってからお試しください");return}
  try{localStorage.setItem("ukka-nick",name)}catch(e){}
  var t=Math.floor(now()*10)/10;
  this.disabled=true;
  try{
    var ref=await FB.addDoc(FB.collection(db,"comments"),{videoId:curVid,name:name,text:text,t:t,at:FB.serverTimestamp()});
    cmts.push({id:ref.id,name:name,text:text,t:t});cmts.sort(function(a,b){return a.t-b.t});
    renderList();$("ctext").value="";
  }catch(e){
    alert("コメントを追加できませんでした。時間をおいてお試しください。");
  }
  this.disabled=false;
});

/* ---------- 起動 ---------- */
(function(){
  try{
    var savedNick=localStorage.getItem("ukka-nick");if(savedNick)$("nick").value=savedNick;
    var pos=localStorage.getItem("ukka-overlay-position");
    if(pos==="outside"){$("ovl").classList.remove("inside");$("ovl").classList.add("outside");$("ovtoggle").textContent="表示: 枠外"}
  }catch(e){}
  renderQuiz();
  loadYT();
  initFB().then(loadVideos).then(loadComments).catch(function(){showErr("読み込みに失敗しました。開き直してみてください。")});
})();
})();
