(async () => {
const B = "https://www.gstatic.com/firebasejs/10.12.2/";
const M = {};
for (const n of ["app", "auth", "firestore"]) {
  try { M[n] = await import(B + "firebase-" + n + ".js"); }
  catch (e) { window.__show("読み込み失敗: firebase-" + n + " / " + (e && e.message)); throw e; }
}
const { initializeApp } = M.app;
const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = M.auth;
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, increment, writeBatch, serverTimestamp } = M.firestore;

window.__ok = true;
{ const eb = document.getElementById("err"); if (eb) eb.remove(); }
/* ★ Firebaseコンソール > プロジェクトの設定 > ウェブアプリ のconfigを貼る */
const firebaseConfig = {
  apiKey: "AIzaSyBWmghjT5uh-awZEyvi53rYPe8Y8Gf2ICA",
  authDomain: "momoclo-call.firebaseapp.com",
  projectId: "momoclo-call",
  storageBucket: "momoclo-call.firebasestorage.app",
  messagingSenderId: "972978318918",
  appId: "1:972978318918:web:921e911bc2a29571f62447"
};
const DEF_TIDS = {"tCD81ACqUYk": "45R1m5osIXo92tgY1eHTeW", "XN4RSUj15TE": "1hHkOBpuly0rAoFuKWy5CM", "f-X5-pYU9gM": "6gIf4tylgA6mr7mj62Pz55"};
function parseSpTid(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  const m = s.match(/(?:track[:/])([A-Za-z0-9]{22})/);
  if (m) return m[1];
  const m2 = s.match(/^([A-Za-z0-9]{22})$/);
  return m2 ? m2[1] : s.split("?")[0].split("/").pop();
}
let SONGS = UI.songs;
async function loadSongs() {
  try {
    const snap = await getDocs(query(collection(db, "songs"), orderBy("order")));
    if (!snap.empty) {
      const arr = snap.docs.map(d => {
        const x = d.data();
        const rawTid = x.tid !== undefined ? x.tid : (x.sid !== undefined ? x.sid : (DEF_TIDS[x.yid] || ""));
        return {s: x.title, title: x.title, vid: x.yid, tid: parseSpTid(rawTid), spOffset: +(x.spOffset || 0), startSec: x.startSec || 0, endSec: x.endSec || 0, isDefault: !!x.isDefault};
      });
      SONGS.length = 0; arr.forEach(x => SONGS.push(x));
      const di = arr.findIndex(x => x.isDefault);
      if (di >= 0) si = di;
      si = Math.min(si, SONGS.length - 1); VID = SONGS[si].vid;
      UI.songSel(si);
      cueCurrentSong();
    }
  } catch (e) {}
  loadCalls();
}
let si = 0;
try { si = Math.min(+localStorage.getItem("momo_song") || 0, SONGS.length - 1); } catch (e) {}
let VID = SONGS[si].vid;
const {LAB, OSHI, PEN, esc, fmt, colorOf} = UI;

const auth = getAuth(initializeApp(firebaseConfig)), db = getFirestore(auth.app);
const $ = id => document.getElementById(id);
function toast(s, ms) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("on"), ms || 2400); }

let me = null, prof = null, calls = [], liked = new Set(), act = null, openId = null;
let authStateReady = false, pendingMkFinishOpen = false;   // プロトタイプ2 移植4: 終了フローは認証状態が確定してから開く
let EV = [], cur = null, sess = null, pickI = 0, native = false;
const LIMIT = 600000;   // 湧きを数えるのは、再生を始めてから10分
let mk = {scenes: [], type: "call", from: null, base: ""};
let tlId = null, tlZoom = false, tlD = 1, mkPv = null, refCalls = [], refPlay = false, randPlay = false, mkMeas = null;
let cmts = {}, pendAll = [], pendKnown = new Set();
let spRange = null, spEdit = null, mySps = [], spRef = null, curRef = null;
let screen = "play";            // build 59: 画面切替 "play"(再生画面) | "mk"(推しコール作成画面) | "sp"(シェアポイント作成画面)。プレイヤー(#mvwrap)は移動しない
let mkSel = -1;                 // 作成画面: 選択中の場面インデックス(-1=未選択)
let mkReturnScrollY = null;    // プロトタイプ2 移植11: 作成画面へ入る直前のスクロール位置。戻るときにプレイ画面の表示位置を復元
let mkLenPhase = null;          // 作成画面: 長さ指定の計測中は "run"
let spStep = 0;                 // シェアポイント作成の段階 0=始点を決める 1=終点を決める 2=作成する
let mkPub = true;               // 作成画面: 保存先(公開=true / 下書き=false)。確定は「保存して戻る」
let mkRate = 1;                 // 作成画面・シェアポイント作成画面: 再生速度(1 → 0.5 → 0.25)
let PRESETS = [], psLoaded = false, psListShown = false;   // build 60: プリセットコール(presetsコレクション。管理画面で登録)
/* ---------- build 64: 作成の2モード制 / 長押し / シーク連動スクラブ / 拡大タイムライン / 位置再編集 ---------- */
let mkMode = "nori";            // 作成モード "nori"(♪ノリノリながら) | "oki"(お気に置きにいっちゃう)。localStorageに保存し、次回も同じモードで開く
try { const m64 = localStorage.getItem("momo_mkmode"); if (m64 === "oki" || m64 === "nori") mkMode = m64; } catch (e) {}
let mkSelOrigT = null;          // カードを選んだときの開始位置(位置編集の「戻す」用)
let mkHoldClickAt = 0;          // 大きなボタンを長押しで処理した時刻(続くクリック=mhMain を握りつぶすため)
let mkScrSt = null, mkPosScrSt = null, mkHoldSt = null;   // スクラブ(新規)/位置スクラブ/長押し の進行中状態(タイムライン追従の判定にも使う)
let mkTune = {gain: 0.5, dead: 14};   // 操作感: 反応の鈍さ(指の絶対位置への追従速度) / 手ブレ抑制(小さい動きを無視する幅。既定はモックと同じ14相当)。localStorage保存
try {
  const g64 = parseFloat(localStorage.getItem("momo_drag_gain")); if (isFinite(g64)) mkTune.gain = Math.min(1, Math.max(0.2, g64));
  const d64 = parseFloat(localStorage.getItem("momo_drag_dead")); if (isFinite(d64)) mkTune.dead = Math.min(30, Math.max(4, Math.round(d64)));
} catch (e) {}
/* ---------- build 62: ゲスト作成 / ウェルカムカード / ハート・湧きの開放 / ガイドモード ---------- */
let guestLiked = new Set();   // ゲストのハート済み表示用(このページを開いている間だけ。誰が押したかの記録としては残さない)
let wakuHold = null;          // 湧く!を押した場面カードを、設定時間(d)いっぱい表示し続けるための保持 {e, until}
/* その訪問中(セッション)に自分が作ったコール。sessionStorageに保持するので、セッションが変われば消える(緩い本人判定) */
function sessGet(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function sessSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
let mySession = new Set(sessGet("momo_my_calls", []));

/* ---------- MV(YouTube) & Spotify埋め込みプレイヤー(Iframe API) ---------- */
let yt = null, ytReady = false, last = 0, drag = false;
let spMode = false, bigCall = false, spApi = window.__spIframeApi || null, spCtrl = null, spLoadedTid = "";
let spAnchor = {pos: 0, at: 0, paused: true, durMs: 240000, isPreview: false};

const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player("yt", {
    videoId: VID, playerVars: {playsinline: 1, controls: 0, rel: 0},
    events: {
      onReady: () => { ytReady = true; },
      onError: () => { if (!spMode) toast("MVを表示できません。公開したURLで開いてください"); }
    }
  });
};

window.onSpotifyIframeApiReady = IFrameAPI => {
  spApi = IFrameAPI;
  window.__spIframeApi = IFrameAPI;
  initSpController();
};

const spHasTrack = () => !!(SONGS[si] && SONGS[si].tid);
const spOff = () => +(SONGS[si] && SONGS[si].spOffset) || 0;
const spRawNow = () => {
  if (!spHasTrack()) return 0;
  const ms = spAnchor.paused ? spAnchor.pos : Math.min(spAnchor.durMs || 240000, spAnchor.pos + (performance.now() - spAnchor.at));
  return Math.max(0, ms / 1000);
};
const spRawDur = () => (spAnchor.durMs || 240000) / 1000;

function initSpController() {
  if (spCtrl || !spApi) return;
  const el = $("spEmbed"); if (!el) return;
  const initTid = (SONGS[si] && SONGS[si].tid) || (SONGS.find(x => x.tid) || {}).tid || "45R1m5osIXo92tgY1eHTeW";
  spApi.createController(el, {uri: "spotify:track:" + initTid, width: "100%", height: "100%"}, ctrl => {
    spCtrl = ctrl;
    spLoadedTid = initTid;
    ctrl.addListener("playback_update", e => {
      const d = (e && e.data) || {};
      const pos = typeof d.position === "number" ? d.position : spAnchor.pos;
      const durMs = (typeof d.duration === "number" && d.duration > 0) ? d.duration : spAnchor.durMs;
      const paused = !!d.isPaused;
      const isPreview = typeof d.duration === "number" && d.duration > 0 && d.duration <= 35000;
      spAnchor = {pos, at: performance.now(), paused, durMs, isPreview};
      paintSpWarn();
    });
    const curTid = (SONGS[si] && SONGS[si].tid) || "";
    if (curTid && curTid !== spLoadedTid) {
      spLoadedTid = curTid;
      try { spCtrl.loadUri("spotify:track:" + curTid); } catch (e) {}
    }
    paintSpMode();
  });
}

function paintSpWarn() {
  const w = $("spPrevWarn"); if (!w) return;
  w.style.display = (spMode && spHasTrack() && spAnchor.isPreview) ? "block" : "none";
}

function paintSpMode() {
  const mv = $("mv"), wrap = $("spWrap"), box = $("spEmbedBox"), noTr = $("spNoTrack"), b1 = $("spModeBtn"), b2 = $("spHeadBtn");
  if (mv) mv.classList.toggle("sp-mode", spMode);
  if (b1) { b1.classList.toggle("on", spMode); b1.textContent = spMode ? "🎵 Spotifyモード ON" : "🎵 Spotifyモード"; }
  if (b2) { b2.classList.toggle("on", spMode); b2.textContent = spMode ? "Spotify ON" : "Spotifyモード"; }
  if (!wrap) return;
  if (!spMode) { wrap.style.display = "none"; paintSpWarn(); return; }
  wrap.style.display = "flex";
  const has = spHasTrack();
  if (box) box.style.display = has ? "block" : "none";
  if (noTr) noTr.style.display = has ? "none" : "flex";
  if (!has && spCtrl) { try { spCtrl.pause(); } catch (e) {} spAnchor.paused = true; }
  paintSpWarn();
}

function spCueCurrentSong() {
  const tid = (SONGS[si] && SONGS[si].tid) || "";
  spAnchor = {pos: 0, at: performance.now(), paused: true, durMs: 240000, isPreview: false};
  paintSpMode();
  if (!tid) return;
  if (!spCtrl) { initSpController(); return; }
  if (spLoadedTid !== tid) {
    spLoadedTid = tid;
    try { spCtrl.loadUri("spotify:track:" + tid); } catch (e) {}
  } else {
    try { spCtrl.pause(); spCtrl.seek(0); } catch (e) {}
  }
}

function cueCurrentSong() {
  if (ytReady && yt && yt.cueVideoById) { try { yt.cueVideoById(VID); } catch (e) {} }
  spCueCurrentSong();
}

const playerReady = () => spMode ? (!!spCtrl && spHasTrack()) : ytReady;
const playerState = () => {
  if (spMode) {
    if (!spCtrl || !spHasTrack()) return -1;
    if (!spAnchor.paused) return 1;
    if (spAnchor.pos > 0 && spAnchor.durMs > 0 && spAnchor.pos >= spAnchor.durMs - 600) return 0;
    return spAnchor.pos > 0 ? 2 : -1;
  }
  return ytReady ? yt.getPlayerState() : -1;
};
const now = () => spMode ? (spHasTrack() ? Math.max(0, spRawNow() + spOff()) : 0) : (ytReady ? yt.getCurrentTime() : 0);
const dur = () => spMode ? Math.max(1, spRawDur() + spOff()) : (ytReady ? (yt.getDuration() || 240) : 240);
const curRange = () => { const sg = SONGS[si]; return (sg && +sg.endSec > +sg.startSec && +sg.endSec > 0) ? {s: +sg.startSec, e: +sg.endSec} : null; };
const clampT = t => { const R = curRange(); return Math.max(R ? R.s : 0, Math.min(R ? R.e : dur(), t)); };
const rangeStart = () => { const R = curRange(); return R ? R.s : 0; };

function playerSeek(t) {
  if (spMode) {
    if (!spHasTrack()) return;
    const rawSec = Math.max(0, t - spOff());
    spAnchor.pos = rawSec * 1000;
    spAnchor.at = performance.now();
    if (spCtrl) { try { spCtrl.seek(Math.round(rawSec)); } catch (e) {} }
  } else if (ytReady) {
    yt.seekTo(t, true);
  }
}
function playerPlay() {
  if (spMode) {
    if (!spHasTrack()) return toast("この曲はSpotifyでは再生できません");
    if (!spCtrl) { initSpController(); return toast("Spotifyプレイヤーの準備中です"); }
    spAnchor.paused = false; spAnchor.at = performance.now();
    try { if (spCtrl.resume) spCtrl.resume(); else spCtrl.play(); } catch (e) { try { spCtrl.play(); } catch (e2) {} }
  } else if (ytReady) {
    yt.playVideo();
  }
}
function playerPause() {
  if (spMode) {
    spAnchor.pos = spRawNow() * 1000; spAnchor.paused = true; spAnchor.at = performance.now();
    if (spCtrl) { try { spCtrl.pause(); } catch (e) {} }
  } else if (ytReady) {
    try { yt.pauseVideo(); } catch (e) {}
  }
}

const bar = $("bar");
bar.addEventListener("input", () => { drag = true; });
bar.addEventListener("change", () => { drag = false; if (playerReady()) playerSeek(clampT(+bar.value)); });

function loop(ts) {
  last = ts;
  const t = now(), st = playerState(), pl = st === 1;
  $("fsplay").textContent = pl ? "一時停止" : "再生";
  const pb = $("play");   // build 59: 大きな再生ボタンは常に「再生/一時停止」のまま(長さ指定は作成画面の大きなボタンが担当)
  if (screen === "mk" && mkMode === "oki") paintPlaceBtn();   // プロトタイプ2 移植3: お気に置きモードでは「置きに行く」表示にする
  else { pb.textContent = pl ? "一時停止" : "再生"; pb.dataset.a = "play"; pb.disabled = false; pb.classList.remove("meas", "place-ready", "place-idle"); }
  const mp1 = $("mkPlayBtn"); if (mp1) mp1.textContent = pl ? "⏸ 一時停止" : "▶ 再生";
  const mp2 = $("spPlayBtn"); if (mp2) mp2.textContent = pl ? "⏸ 一時停止" : "▶ 再生";
  if (screen === "mk") paintKnob();
  if (st === 0 && sess) { sess = null; paintApply(); }   // 曲が終わったら、次回の再生でリセット
  if (mkPv && t >= mkPv.until) { mkPv = null; playerPause(); paintPvBtn(); toast("プレビューが終わりました"); }   // プレビューは表示終了+3秒で止める
  if (pl !== loop.prevPl) { loop.prevPl = pl; guideEvent(pl ? "play" : "pause"); }   // build 62: ガイドモードの再生/停止の検知
  const R = curRange(); if (R && pl && !mkPv && !(mkScrSt && mkScrSt.active) && !(window.__p2PlaceDragActive && window.__p2PlaceDragActive()) && t >= R.e) playerPause();   // 再生範囲の終わりで止める(配置ドラッグ中は止めない: プロトタイプ2 / v55: お気に置くドラッグ中も止めない)
  if (spRange && pl && !mkPv && t >= spRange.b) { spRange = null; playerPause(); toast("シェアポイントの範囲が終わりました"); }   // シェアポイントの終点で止める
  const kr = mkPv ? null : kanranRange();   // build 63: 観覧モードの有効範囲(作成中プレビューでは効かせない)
  if (kr && pl) {   // 観覧モード: 指定範囲の外には出ない(手前なら始点へ寄せ、終点で止めて始点へ戻す)
    if (t < kr.a - 0.05) playerSeek(kr.a);
    else if (t >= kr.b && Date.now() - kanranEndAt > 800) { kanranEndAt = Date.now(); playerPause(); playerSeek(kr.a); toast("観覧モードの範囲の終わりまで再生しました"); }
  }
  if (pl && act && !isMine() && !mkPv) { const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); } }   // 再生を始めてから10分を数える
  if (!drag) { bar.max = dur(); bar.value = t; }
  $("tm").textContent = fmt(t); $("dur").textContent = fmt(dur());
  const pvSrc = (!mkPv && screen === "play" && window.__p2UniPreviewScenes) ? window.__p2UniPreviewScenes() : null;   // プロトタイプ2 v52: 作成中プレビューONの間は、再生側のカード演出も作りかけのシーンを流す(プレビューOFFでは従来どおり視聴中コール)
  const SRC = mkPv ? mkPv.scenes : (pvSrc || EV);
  let on = SRC.filter(x => t >= x.t && t < x.t + x.d);           // いま出ている場面(重なってもそれぞれ本来のタイミング)
  if (wakuHold && !mkPv && !pvSrc) {   // build 62: 湧く!を押した場面は、再生位置に関係なく設定時間いっぱい表示し続ける
    if (performance.now() < wakuHold.until) { if (!on.includes(wakuHold.e)) on.push(wakuHold.e); }
    else wakuHold = null;
  }
  if (kr) on = on.filter(x => x.t < kr.b && x.t + x.d > kr.a);   // build 63: 観覧モードでは範囲と重ならない場面カードは出さない
  UI.cards(on); UI.nexts(SRC.filter(x => t < x.t && x.t - t <= 6 && x.k !== "koko" && (!kr || (x.t < kr.b && x.t + x.d > kr.a))), t);
  const tp = $("tlPos");
  if (tp) { const on2 = tlId && (tlId === act || tlId === "__cur__") && dur() > 0; tp.style.display = on2 ? "block" : "none"; if (on2) tp.style.left = "calc(64px + (100% - 72px) * " + Math.min(1, t / dur()) + ")"; }
  const e = on.slice().reverse().find(x => x.k !== "koko") || null;   // 「自分も湧く!」の対象
  const sessOwn = !!(act && mySession.has(act));   // build 62: この訪問中に作ったコールは湧きも押せない
  document.querySelectorAll(".wk").forEach(x => { x.classList.toggle("hot", !!e); x.classList.toggle("off", sessOwn); });
  cur = (mkPv || pvSrc) ? null : e;   // プロトタイプ2 v52: プレビュー中は作りかけを「湧く!」の対象にしない(mkPvと同じ)
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- プロトタイプ2: カード表示スタイル切り替え(まずバブル) ---------- */
/* P2CS-BEGIN */
(function () {
  var origCards = UI.cards.bind(UI);
  var STYLES = ["stack", "bubble", "stream", "slide", "carousel", "pulse"];
  var style = "bubble";
  try { style = localStorage.getItem("momo_p2_cardstyle_v3") || "bubble"; } catch (e) {}
  if (STYLES.indexOf(style) < 0) style = "bubble";
  var stEl = document.createElement("style");
  stEl.textContent = "#bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:7}"
    + ".p2bub{position:absolute;transform:translateX(-50%);padding:9px 18px;border-radius:999px;color:#fff;text-align:center;max-width:86%;background:rgba(255,255,255,.16);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.35);box-shadow:0 4px 18px rgba(0,0,0,.25),inset 0 2px 6px rgba(255,255,255,.35),inset 0 -6px 12px rgba(255,255,255,.08);opacity:0;animation-name:p2floatUp;animation-timing-function:ease-out;animation-fill-mode:forwards}"
    + ".p2bub::before{content:\"\";position:absolute;top:12%;left:10%;width:34%;height:26%;border-radius:50%;background:rgba(255,255,255,.38);filter:blur(2px);pointer-events:none}"
    + ".p2bubIn{display:block;animation:p2sway 1.7s ease-in-out infinite}"
    + "@keyframes p2sway{0%,100%{transform:translateX(-4px) rotate(-1.1deg) scale(1.04,.96)}25%{transform:translateX(3px) rotate(.8deg) scale(.97,1.04)}50%{transform:translateX(5px) rotate(1.2deg) scale(1.02,.98)}75%{transform:translateX(-3px) rotate(-.8deg) scale(.98,1.02)}}"
    + "@media (prefers-reduced-motion:reduce){.p2bubIn{animation:none}}"
    + ".p2bub strong{font-size:16px;line-height:1.35}"
    + ".p2bub em{display:block;font-size:10px;font-style:normal;opacity:.85}"
    + ".p2bub.b-call{background:rgba(255,45,110,.55)}"
    + ".p2bub.b-sing{background:rgba(30,136,229,.55)}"
    + ".p2bub.b-koko{background:rgba(255,190,0,.68);color:#3a2a00}"
    + "@keyframes p2floatUp{0%{transform:translate(-50%,10px) scale(.8);opacity:0}12%{opacity:1;transform:translate(-50%,0) scale(1.06)}22%{transform:translate(-50%,-8px) scale(1)}78%{opacity:1;transform:translate(-50%,-96px) scale(1)}100%{opacity:0;transform:translate(-50%,-138px) scale(.92)}}"
    /* Geminiの下書き(2026-11-18)を土台に、段移動をtransformへ寄せて滑らかにした3スタイル */
    + ".p2c{position:absolute;left:50%;width:84%;max-width:340px;padding:10px 14px;border-radius:12px;color:#fff;text-align:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 8px 24px rgba(0,0,0,.35);will-change:transform,opacity}"
    + ".p2c strong{font-size:15px;line-height:1.3}"
    + ".p2c em{display:block;font-size:10px;font-style:normal;opacity:.85}"
    + ".p2c.k-call{background:rgba(255,45,110,.55)}"
    + ".p2c.k-sing{background:rgba(30,136,229,.55)}"
    + ".p2c.k-koko{background:rgba(255,190,0,.68);color:#2b1a00}"
    + ".p2c.s-slide{bottom:8px;transform:translateX(-50%) translateY(130%);opacity:0;transition:transform .55s cubic-bezier(.22,.9,.35,1),opacity .55s ease}"
    + ".p2c.s-slide.pp0{transform:translateX(-50%) translateY(0) scale(1);opacity:1;z-index:5}"
    + ".p2c.s-slide.pp1{transform:translateX(-50%) translateY(-62px) scale(.9);opacity:.85;z-index:4}"
    + ".p2c.s-slide.pp2{transform:translateX(-50%) translateY(-116px) scale(.82);opacity:.68;z-index:3}"
    + ".p2c.s-slide.pp3{transform:translateX(-50%) translateY(-162px) scale(.75);opacity:.52;z-index:2}"
    + ".p2c.s-slide.pp4{transform:translateX(-50%) translateY(-200px) scale(.7);opacity:.38;z-index:1}"
    + ".p2c.s-slide.leaving{transform:translateX(-50%) translateY(-215px) scale(.68);opacity:0}"
    + ".p2c.s-carousel{bottom:8px;transform:translateX(-50%) translateY(34px) scale(.84) rotate(-5deg);opacity:0;transition:transform .5s cubic-bezier(.22,.9,.35,1),opacity .5s ease}"
    + ".p2c.s-carousel.pp0{transform:translateX(-50%) translateY(0) scale(1) rotate(0deg);opacity:1;z-index:5}"
    + ".p2c.s-carousel.pp1{transform:translateX(-50%) translateY(-14px) scale(.9) rotate(-2.5deg);opacity:.9;z-index:4}"
    + ".p2c.s-carousel.pp2{transform:translateX(-50%) translateY(-26px) scale(.81) rotate(2deg);opacity:.75;z-index:3}"
    + ".p2c.s-carousel.pp3{transform:translateX(-50%) translateY(-36px) scale(.74) rotate(-3.5deg);opacity:.58;z-index:2}"
    + ".p2c.s-carousel.pp4{transform:translateX(-50%) translateY(-44px) scale(.68) rotate(3deg);opacity:.42;z-index:1}"
    + ".p2c.s-carousel.leaving{transform:translateX(-50%) translateY(-30px) scale(.7) rotate(6deg);opacity:0}"
    + ".p2c.s-pulse{bottom:10px;transform:translateX(-50%) scale(1.45);opacity:0;transition:transform .45s cubic-bezier(.34,1.8,.64,1),opacity .35s ease}"
    + ".p2c.s-pulse.pp0{transform:translateX(-50%) translateY(0) scale(1);opacity:1;z-index:5;animation:p2heartbeat .9s ease-in-out infinite}"
    + "@keyframes p2heartbeat{0%,100%{scale:1}35%{scale:1.08}}"
    + ".p2c.s-pulse.pp1{transform:translateX(-50%) translateY(-12px) scale(.92);opacity:.75;z-index:4}"
    + ".p2c.s-pulse.pp2{transform:translateX(-50%) translateY(-22px) scale(.85);opacity:.5;z-index:3}"
    + ".p2c.s-pulse.pp3{transform:translateX(-50%) translateY(-30px) scale(.8);opacity:.32;z-index:2}"
    + ".p2c.s-pulse.pp4{transform:translateX(-50%) translateY(-36px) scale(.76);opacity:.18;z-index:1}"
    + ".p2c.s-pulse.leaving{transform:translateX(-50%) scale(.65);opacity:0}"
    + ".p2csbtns{display:inline-flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}"
    + ".p2csbtns button{padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#f4f4fb;font-size:12px}"
    + ".p2csbtns button.sel{background:var(--pink,#ff5d8f);border-color:transparent;font-weight:700}"
    /* ストリーム(Gemini案1: 下からスライドインし、等間隔で上へ流れ、薄くなって消える。ココ好き!は上部。色は他の見せ方と同じ種類色の半透明) */
    + ".p2c.s-stream{bottom:10px;border-radius:999px;padding:10px 18px;transform:translateX(-50%) translateY(64px);opacity:0;transition:transform .7s cubic-bezier(.22,.9,.35,1),opacity .7s ease}"
    + ".p2c.s-stream.pp0{transform:translateX(-50%) translateY(0);opacity:1;z-index:5}"
    + ".p2c.s-stream.pp1{transform:translateX(-50%) translateY(-66px);opacity:.8;z-index:4}"
    + ".p2c.s-stream.pp2{transform:translateX(-50%) translateY(-132px);opacity:.55;z-index:3}"
    + ".p2c.s-stream.pp3{transform:translateX(-50%) translateY(-198px);opacity:.32;z-index:2}"
    + ".p2c.s-stream.pp4{transform:translateX(-50%) translateY(-264px);opacity:.14;z-index:1}"
    + ".p2c.s-stream.leaving{opacity:0}"
    + ".p2c.s-stream.k-koko{bottom:auto;top:12%}"
    + ".p2c.s-stream.k-koko.kt0{transform:translateX(-50%) translateY(0);opacity:1;z-index:5}"
    + ".p2c.s-stream.k-koko.kt1{transform:translateX(-50%) translateY(52px);opacity:.75;z-index:4}"
    /* 見せ方切替は下の「モード」引き出し内に格納 */
    + ".p2csRow{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.14);text-align:center}"
    + ".p2csRow .p2csLbl{display:block;font-size:11px;color:var(--mut);font-weight:700;margin-bottom:6px}"
    + ".p2csRow .p2csbtns{justify-content:center}";
  document.head.appendChild(stEl);
  var bub = document.createElement("div");
  bub.id = "bubbles";
  $("mv").appendChild(bub);
  var alive = {}, aliveP = {}, lastOn = [];
  function keyOf(e) { return e.t + "|" + e.k + "|" + e.x; }
  function hashOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  var OFFS = [-58, -29, 0, 29, 58];
  function clearCustom() { bub.innerHTML = ""; alive = {}; aliveP = {}; }
  function cardHTML(e) { return "<strong>" + UI.esc(e.x) + "</strong>" + (e.mine ? "<em>このスコアは反映されません</em>" : ""); }
  /* バブル: カードごとに独立して浮き上がる */
  function renderBubble(on) {
    var t = now(), seen = {};
    var sorted = on.slice().sort(function (a, b) { return a.t - b.t; });
    sorted.forEach(function (e, idx) {
      var k = keyOf(e); seen[k] = 1;
      if (alive[k]) return;
      var el = document.createElement("div");
      el.className = "p2bub b-" + e.k;
      el.style.left = "calc(50% + " + OFFS[hashOf(k) % OFFS.length] + "px)";
      el.style.bottom = (26 + idx * 54) + "px";
      el.style.animationDuration = Math.max(0.6, (e.t + e.d) - t).toFixed(2) + "s";
      el.innerHTML = "<span class=\"p2bubIn\">" + cardHTML(e) + "</span>";
      bub.appendChild(el); alive[k] = el;
    });
    Object.keys(alive).forEach(function (k) { if (!seen[k]) { alive[k].remove(); delete alive[k]; } });
  }
  /* スライド/カルーセル/パルス/ストリーム: 段クラス(pp0=最新)を付け替えて滑らかに動かす。ストリームはココ好き!を上部(kt)に分ける */
  function applyPos(rec) {
    if (style === "stream" && rec.kind === "koko") { rec.el.className = "p2c s-stream k-koko kt" + Math.min(rec.pos, 1); return; }
    rec.el.className = "p2c s-" + style + " k-" + rec.kind + " pp" + Math.min(rec.pos, 4);
  }
  function leaveEl(el) { el.classList.add("leaving"); setTimeout(function () { el.remove(); }, 900); }
  function renderPos(on) {
    var seen = {};
    var main = on.filter(function (e) { return e.k !== "koko"; }).slice(style === "stream" ? -5 : -3);
    var koko = on.filter(function (e) { return e.k === "koko"; }).slice(-2);
    var items = [];
    if (style === "stream") {
      var ms = main.slice().sort(function (a, b) { return a.t - b.t; });
      ms.forEach(function (e, i) { items.push({ e: e, pos: ms.length - 1 - i }); });
      var ks = koko.slice().sort(function (a, b) { return a.t - b.t; });
      ks.forEach(function (e, i) { items.push({ e: e, pos: ks.length - 1 - i }); });
    } else {
      var all = main.concat(koko).sort(function (a, b) { return a.t - b.t; });
      all.forEach(function (e, i) { items.push({ e: e, pos: all.length - 1 - i }); });
    }
    items.forEach(function (it) {
      var e = it.e;
      var k = keyOf(e); seen[k] = 1;
      var rec = aliveP[k];
      if (!rec) {
        var el = document.createElement("div");
        el.className = "p2c s-" + style + " k-" + e.k;
        el.innerHTML = cardHTML(e);
        bub.appendChild(el);
        rec = aliveP[k] = { el: el, kind: e.k, pos: it.pos, entered: false };
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { if (aliveP[k] !== rec) return; rec.entered = true; applyPos(rec); });
        });
      } else {
        rec.pos = it.pos;
        if (rec.entered) applyPos(rec);
      }
    });
    Object.keys(aliveP).forEach(function (k) { if (!seen[k]) { var rec = aliveP[k]; delete aliveP[k]; leaveEl(rec.el); } });
  }
  function renderCustom(on) { if (style === "bubble") renderBubble(on); else renderPos(on); }
  UI.cards = function (on) {
    lastOn = on;
    if (style === "stack") {
      if (Object.keys(alive).length || Object.keys(aliveP).length) clearCustom();
      origCards(on);
    } else {
      if ($("cards").firstChild) $("cards").innerHTML = "";
      if ($("kokos").firstChild) $("kokos").innerHTML = "";
      renderCustom(on);
    }
  };
  /* 切り替えUI: 下の「モード」引き出し(激湧き/観覧と同じバー)の中に格納 */
  var row = document.createElement("div");
  row.className = "p2csRow";
  row.innerHTML = "<span class=\"p2csLbl\">カードの見せ方</span><span class=\"p2csbtns\">"
    + "<button type=\"button\" data-cs=\"stack\">縦積み</button>"
    + "<button type=\"button\" data-cs=\"bubble\">バブル</button>"
    + "<button type=\"button\" data-cs=\"stream\">ストリーム</button>"
    + "<button type=\"button\" data-cs=\"slide\">スライド</button>"
    + "<button type=\"button\" data-cs=\"carousel\">カルーセル</button>"
    + "<button type=\"button\" data-cs=\"pulse\">パルス</button></span>";
  var plBody = $("plModeBody");
  if (plBody) plBody.appendChild(row);
  function paintBtns() { row.querySelectorAll("button[data-cs]").forEach(function (b) { b.classList.toggle("sel", b.dataset.cs === style); }); }
  row.querySelectorAll("button[data-cs]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.dataset.cs; if (v === style) return;
      style = v;
      try { localStorage.setItem("momo_p2_cardstyle_v3", style); } catch (e) {}
      paintBtns();
      clearCustom();
      if (style === "stack") { origCards([]); origCards(lastOn); }
      else { $("cards").innerHTML = ""; $("kokos").innerHTML = ""; renderCustom(lastOn); }
    });
  });
  paintBtns();
})();
/* P2CS-END */

/* ---------- プロトタイプ2: 再生画面の操作レイアウト(3段+ペン長押し色バー+モード引き出し) ---------- */
(function () {
  var stEl = document.createElement("style");
  stEl.textContent = ".p2row1{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:10px}"
    + "body.scr-mk .p2row1 #penbtn,body.scr-sp .p2row1 #penbtn,body.scr-mk .p2row1 #wakubtn,body.scr-sp .p2row1 #wakubtn{display:none}"
    + "#plMode{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:26}"
    + "body:not(.scr-mk):not(.scr-sp) #app{padding-bottom:54px}"
    + "#plModeBar{width:100%;height:42px;background:rgba(38,42,74,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:0;border-top:2px solid #3a3f6b;color:var(--ink);font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font:inherit}"
    + "#plModeBar .drwHint{font-size:11px;color:var(--mut);font-weight:700}"
    + "#plModeBody{max-height:0;overflow:hidden;transition:max-height .3s ease;background:rgba(28,30,56,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}"
    + "#plMode.open #plModeBody{max-height:42vh;overflow-y:auto;padding:10px}"
    + "#plModeBody .drwBtns{display:flex;gap:14px;justify-content:center}"
    + "body.scr-mk #plMode,body.scr-sp #plMode{display:none}"
    + "#dots{position:fixed;left:50%;transform:translateX(-50%);bottom:118px;z-index:65;background:rgba(28,30,56,.92);border:1px solid #3a3f6b;border-radius:999px;padding:8px 12px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none}"
    + "#dots.open{display:flex}"
    + "[data-a=\"pen\"]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}"
    + "#share{flex-wrap:nowrap;gap:6px;align-items:center}"
    + "#share .shBtn{min-width:0;flex:1 1 auto;padding:7px 2px;font-size:11px;white-space:nowrap}"
    + "#share #login{min-width:0;height:32px;padding:0 8px;font-size:11px;flex:none}"
    + "#share .ico{width:36px;height:36px;flex:none}"
    + "#share .ico svg{width:22px;height:22px}";
  document.head.appendChild(stEl);
  /* モード引き出し(作成画面の作成モードバーと同じ仕様) */
  $("plModeBar").addEventListener("click", function () {
    var d = $("plMode"); if (!d) return;
    d.classList.toggle("open");
    this.setAttribute("aria-expanded", d.classList.contains("open") ? "true" : "false");
  });
  /* ペンライト: タップ=点灯/消灯(従来通り)、長押し=色バーを重ねて出す */
  var dotsEl = $("dots"), lpTimer = null, lpSuppress = false;
  function closeDots() { if (dotsEl) dotsEl.classList.remove("open"); }
  document.querySelectorAll('[data-a="pen"]').forEach(function (b) {
    b.addEventListener("pointerdown", function () {
      lpSuppress = false;
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = setTimeout(function () { lpSuppress = true; if (dotsEl) dotsEl.classList.add("open"); }, 480);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      b.addEventListener(ev, function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });
    });
    b.addEventListener("click", function (e) { if (lpSuppress) { lpSuppress = false; e.stopPropagation(); } });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
  document.addEventListener("pointerdown", function (e) {
    if (!dotsEl || !dotsEl.classList.contains("open")) return;
    if (dotsEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('[data-a="pen"]')) return;
    closeDots();
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("#dots button")) closeDots();
  });
})();

/* ---------- プロトタイプ2 v43: 再生画面の三層レイヤー+付箋タブ(タイムライン追加+スライドガイド) ----------
   再生コントロール一式(.p2row1+.playrow+#barwrap)とコールカード一覧(#playSceneList)に加え、
   タイムラインも同じステージの3枚目のシートとして重ねる「三階建て」レイヤー。
   どのシートも消えずに重なって存在し続け、下のシートは下へ少しずれて端がはみ出し、
   端では上のシートが透過グラデーションで透けるので「下にもう1枚ある」と分かる。
   下のシートの付箋(右端のタブ専用帯にまっすぐ立つ縦書きタブ)をタップすると、そのシートが
   短いアニメーションで上(手前)に来る。付箋帯の中ではスライド切替もできる: 指を置いたまま
   上下に滑らせ、指が別の付箋の上に来た瞬間にそのシートが上に来る(離すのを待たない)。付箋はタブ専用帯(幅32px)の中に収まり、回転なし(0度)で
   まっすぐ立ち、シート本体(ボタン類)には一切重ならない(v41の実機フィードバック対応を維持)。
   タイムラインシートの中身は、曲全体を小さく押し込んだ図解ではなく「拡大して流れる」表示:
   時間軸を PXPS(px/秒) に拡大し、カードは大きく文言入り(入りきらない文言は省略)で描き、
   再生位置に追従して自動スクロールする。シート内をタップ(スクロールではなく、ほぼ動かさず
   離したとき)すると既存の全画面タイムライン(#tlFsBtn のクリック相当)を開く。
   v42では再生画面の NEXT カード(#nexts)も一旦非表示にする(再生画面の範囲のみ・CSSだけの
   変更で UI.nexts の仕組み自体は残すので、CSSを外せばすぐ戻せる)。
   v43ではスライド操作のガイドを追加: ステージが有効化されるたび(再生画面を開くたび)に、
   付箋帯のそばで指先マークがタブを撫でるように上下する見本の動きと、縦文字「スライド」を
   5秒だけさりげなく表示する(v43当初は2秒、v45で祐治の指示により5秒に延長。指の動きは5秒で2往復)。実際にシートは切り替えず、ガイドは pointer-events:none で
   操作を妨げない。既読フラグでは抑制せず、同じ画面に留まる間の再描画では繰り返さない。
   作成画面(scr-mk)/シェア画面(scr-sp)ではステージをほどいて元のDOM配置に完全に戻す。
   #plMode / #mkRateSelect / #spPanel / #pEv には触らない。 */
(function () {
  var row1 = document.querySelector(".p2row1");
  var playrow = document.querySelector(".playrow");
  var barwrap = document.getElementById("barwrap");
  var list = document.getElementById("playSceneList");
  if (!row1 || !playrow || !barwrap || !list || !row1.parentNode) return;
  var app = row1.parentNode;
  function mkMarker(el) { var m = document.createElement("span"); m.style.display = "none"; m.setAttribute("data-p2lt", "marker"); el.parentNode.insertBefore(m, el); return m; }
  var mRow1 = mkMarker(row1), mPlay = mkMarker(playrow), mBar = mkMarker(barwrap), mList = mkMarker(list);
  var stage = document.createElement("div"); stage.id = "p2LayerStage"; stage.setAttribute("data-top", "ctrl");
  var ctrl = document.createElement("div"); ctrl.id = "p2LayerCtrl";
  /* タイムラインシート(3枚目)。中身は renderTl() が拡大タイムラインを描く */
  var tlSheet = document.createElement("div"); tlSheet.id = "p2LayerTl";
  tlSheet.innerHTML = '<div class="p2tl-head"><span class="p2tl-title">タイムライン</span><span class="p2tl-now"></span><button type="button" class="p2tl-fs">全画面で見る</button></div>'
    + '<div class="p2tl-scroll"><div class="p2tl-inner"></div></div>'
    + '<div class="p2tl-hint">タップすると全画面で表示します</div>';
  var tlScroll = tlSheet.querySelector(".p2tl-scroll");
  var tlInner = tlSheet.querySelector(".p2tl-inner");
  var tlNowEl = tlSheet.querySelector(".p2tl-now");
  var tabCtrl = document.createElement("button"); tabCtrl.type = "button"; tabCtrl.className = "p2lt-tab p2lt-tab-ctrl"; tabCtrl.textContent = "操作"; tabCtrl.setAttribute("aria-label", "再生コントロールを上に表示する");
  var tabList = document.createElement("button"); tabList.type = "button"; tabList.className = "p2lt-tab p2lt-tab-list"; tabList.textContent = "一覧"; tabList.setAttribute("aria-label", "コールカード一覧を上に表示する");
  var tabTl = document.createElement("button"); tabTl.type = "button"; tabTl.className = "p2lt-tab p2lt-tab-tl"; tabTl.textContent = "タイムライン"; tabTl.setAttribute("aria-label", "タイムラインを上に表示する");
  /* v43: スライド操作ガイド。指先マーク+縦文字「スライド」だけのシンプルな見本表示 */
  var GUIDE_MS = 5000;
  var guide = document.createElement("div"); guide.id = "p2SlideGuide"; guide.setAttribute("aria-hidden", "true"); guide.setAttribute("data-guide-ms", String(GUIDE_MS));
  guide.innerHTML = '<div class="p2g-move"><span class="p2g-text">スライド</span><span class="p2g-finger"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><circle cx="13" cy="13" r="10.5" fill="rgba(255,255,255,.26)"/><circle cx="13" cy="13" r="6.6" fill="rgba(255,255,255,.96)" stroke="rgba(20,20,40,.55)" stroke-width="1.4"/><circle cx="13" cy="13" r="2.4" fill="#ff7ab8"/></svg></span></div>';
  var st = document.createElement("style"); st.id = "p2LayerStyles";
  st.textContent = "#p2LayerStage{position:relative}"
    + "#p2LayerCtrl{display:flex;flex-direction:column;gap:14px}"
    + ".p2lt-tab{display:none}"
    /* v42: NEXTカードは再生画面でのみ一旦非表示(仕組みは残すので戻せる) */
    + "body:not(.scr-mk):not(.scr-sp) #nexts{display:none!important}"
    + "#p2LayerTl{display:none}"
    /* ステージ有効時: 3枚のシートを重ねる */
    + "#p2LayerStage.p2lt-active{margin-right:0}"
    + "#p2LayerStage.p2lt-active #p2LayerCtrl,#p2LayerStage.p2lt-active #playSceneList,#p2LayerStage.p2lt-active #p2LayerTl{position:absolute;border:1px solid rgba(255,255,255,.20);border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.42);transition:transform .22s ease,opacity .22s ease;overflow:hidden}"
    + "#p2LayerStage.p2lt-active #p2LayerCtrl{padding:10px;background:linear-gradient(180deg,rgba(38,42,74,.99),rgba(22,23,45,.99));gap:10px}"
    + "#p2LayerStage.p2lt-active #playSceneList{margin:0;padding:10px;display:none;background:linear-gradient(180deg,rgba(24,26,48,.99),rgba(15,17,31,.99))}"
    + "#p2LayerStage.p2lt-active #playSceneList.on{display:flex;flex-direction:column}"
    + "#p2LayerStage.p2lt-active #playSceneList .psl-items{max-height:none;flex:1;min-height:0}"
    + "#p2LayerStage.p2lt-active #p2LayerTl{margin:0;padding:10px;background:linear-gradient(180deg,rgba(24,26,48,.99),rgba(15,17,31,.99));display:flex;flex-direction:column}"
    /* 上(手前): 右端32pxはタブ専用帯として避け、下にだけ下のシートのはみ出し分を空ける。中心は不透明、端ほど透過して下が透ける。傾きなし */
    + "#p2LayerStage.p2lt-active [data-p2lt-front]{left:0;top:0;right:32px;bottom:14px;z-index:3;transform:none;-webkit-mask-image:radial-gradient(125% 125% at 50% 50%,#000 60%,rgba(0,0,0,.62) 88%,rgba(0,0,0,.30) 100%);mask-image:radial-gradient(125% 125% at 50% 50%,#000 60%,rgba(0,0,0,.62) 88%,rgba(0,0,0,.30) 100%)}"
    /* 下(奥): タブ帯を避けた幅のまま下へ少しずらし、下端が階段状にはみ出す。回転・縮小なし。タップは付箋だけ(シート本体は操作不可が正) */
    + "#p2LayerStage.p2lt-active [data-p2lt-back='0']{left:0;top:8px;right:32px;bottom:7px;z-index:2;transform:none;pointer-events:none}"
    + "#p2LayerStage.p2lt-active [data-p2lt-back='1']{left:0;top:16px;right:32px;bottom:0;z-index:1;transform:none;pointer-events:none}"
    /* 付箋タブ: 3枚とも右端のタブ専用帯(幅32px)の中にまっすぐ(回転なし)立つ。上のシートのものだけ控えめな目印になり、他の2枚はタップ可能。シート本体には一切重ならない */
    + "#p2LayerStage.p2lt-active .p2lt-tab{display:block;position:absolute;right:2px;z-index:6;width:28px;transform:none;padding:11px 0;border-radius:0 9px 9px 0;writing-mode:vertical-rl;font-size:12px;font-weight:900;letter-spacing:.14em;box-shadow:2px 3px 8px rgba(0,0,0,.45);cursor:pointer;font-family:inherit;transition:right .22s ease,opacity .22s ease,transform .22s ease}"
    + ".p2lt-tab-ctrl{top:6px;background:#ff7ab8;color:#2a0c1c}"
    + ".p2lt-tab-list{top:62px;background:#ffd23f;color:#2a2410}"
    + ".p2lt-tab-tl{top:118px;background:#4dc9ff;color:#0b2233;font-size:11px;letter-spacing:.1em;padding:8px 0}"
    + "#p2LayerStage.p2lt-active .p2lt-tab{touch-action:none}"
    + ".p2lt-tab-hot{filter:brightness(1.22);box-shadow:0 0 0 2px #fff,2px 3px 10px rgba(0,0,0,.55)!important}"
    + "#p2LayerStage[data-top='ctrl'] .p2lt-tab-ctrl,#p2LayerStage[data-top='list'] .p2lt-tab-list,#p2LayerStage[data-top='tl'] .p2lt-tab-tl{opacity:.55;pointer-events:none;box-shadow:none}"
    + "#p2LayerStage[data-top='ctrl'] .p2lt-tab-list,#p2LayerStage[data-top='ctrl'] .p2lt-tab-tl,#p2LayerStage[data-top='list'] .p2lt-tab-ctrl,#p2LayerStage[data-top='list'] .p2lt-tab-tl,#p2LayerStage[data-top='tl'] .p2lt-tab-ctrl,#p2LayerStage[data-top='tl'] .p2lt-tab-list{opacity:1;pointer-events:auto}"
    /* タイムラインシートの中身: 拡大して流れるタイムライン */
    + ".p2tl-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}"
    + ".p2tl-title{font-size:14px;font-weight:900;color:#fff}"
    + ".p2tl-now{font-size:12px;font-weight:900;color:#aee9e2;font-variant-numeric:tabular-nums}"
    + ".p2tl-fs{margin-left:auto;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:900;font-family:inherit;cursor:pointer}"
    + ".p2tl-scroll{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;position:relative;border-radius:8px;background:rgba(10,11,24,.55)}"
    + ".p2tl-inner{position:relative;padding:2px 0 6px;min-height:100%;box-sizing:border-box}"
    + ".p2tl-ruler{position:relative;height:16px}"
    + ".p2tl-tick{position:absolute;top:0;font-size:9px;font-weight:700;color:#8e91b8;white-space:nowrap;padding-left:2px}"
    + ".p2tl-lane{position:relative;height:46px;margin-top:4px;border-top:1px solid rgba(255,255,255,.07)}"
    + ".p2tl-lab{position:sticky;left:0;z-index:4;display:inline-block;background:rgba(10,11,24,.88);padding:2px 6px;font-size:10px;font-weight:900;color:#cfd2f2;border-radius:0 0 6px 0}"
    + ".p2tl-card{position:absolute;top:9px;height:34px;border-radius:8px;border:1.5px solid;box-sizing:border-box;padding:2px 7px;overflow:hidden;font-size:13px;font-weight:800;color:#fff;line-height:1.3;white-space:nowrap}"
    + ".p2tl-card small{display:block;font-size:9px;font-weight:900;opacity:.9;line-height:1.15}"
    + ".p2tl-card .p2tl-x{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".p2tl-pos{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.85);z-index:5;pointer-events:none}"
    + ".p2tl-empty{padding:18px 8px;font-size:13px;font-weight:700;color:#9aa3c7}"
    + ".p2tl-hint{margin-top:6px;font-size:10px;font-weight:700;color:#9aa3c7;text-align:right}"
    + "#p2SlideGuide{display:none}"
    + "#p2LayerStage.p2lt-active #p2SlideGuide{display:block;position:absolute;right:0;top:0;bottom:14px;width:52px;z-index:8;pointer-events:none;opacity:0;transition:opacity .28s ease}"
    + "#p2LayerStage.p2lt-active #p2SlideGuide.on{opacity:.92}"
    + ".p2g-move{position:absolute;right:1px;top:8px;display:flex;align-items:flex-start;gap:1px}"
    + "#p2SlideGuide.on .p2g-move{animation:p2gSlide 5s ease-in-out 1}"
    + ".p2g-text{writing-mode:vertical-rl;font-size:11px;font-weight:900;letter-spacing:.18em;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.85);margin-top:2px}"
    + ".p2g-finger{display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.5))}"
    + "@keyframes p2gSlide{0%{transform:translateY(0)}6%{transform:translateY(6px)}24%{transform:translateY(104px)}31%{transform:translateY(104px)}48%{transform:translateY(0)}56%{transform:translateY(6px)}74%{transform:translateY(104px)}81%{transform:translateY(104px)}98%,100%{transform:translateY(0)}}"
    + "@media (prefers-reduced-motion:reduce){#p2LayerStage.p2lt-active #p2LayerCtrl,#p2LayerStage.p2lt-active #playSceneList,#p2LayerStage.p2lt-active #p2LayerTl,.p2lt-tab{transition:none}#p2SlideGuide.on .p2g-move{animation:none}}";
  document.head.appendChild(st);
  var built = false, ctrlH = 0;
  var guideTimer = null, guideShown = false;
  function showGuide() {
    if (guideShown) return;
    guideShown = true;
    guide.classList.add("on");
    if (guideTimer) clearTimeout(guideTimer);
    guideTimer = setTimeout(hideGuide, GUIDE_MS);
  }
  function hideGuide() { guide.classList.remove("on"); if (guideTimer) { clearTimeout(guideTimer); guideTimer = null; } }
  function resetGuide() { hideGuide(); guideShown = false; }
  try { window.__p2ltGuide = { show: showGuide, reset: resetGuide, ms: GUIDE_MS, el: guide }; } catch (e) {}
  var sheets = { ctrl: ctrl, list: list, tl: tlSheet };
  function isPlayScreen() { return !document.body.classList.contains("scr-mk") && !document.body.classList.contains("scr-sp"); }
  function paintTabs() {
    var top = stage.getAttribute("data-top");
    tabCtrl.setAttribute("aria-pressed", top === "ctrl" ? "true" : "false");
    tabList.setAttribute("aria-pressed", top === "list" ? "true" : "false");
    tabTl.setAttribute("aria-pressed", top === "tl" ? "true" : "false");
  }
  function setTop(which) { stage.setAttribute("data-top", which); applyFrontBack(); paintTabs(); if (which === "tl") { renderTl(true); followTl(); } }
  function applyFrontBack() {
    var top = stage.getAttribute("data-top");
    var backRank = 0;
    ["ctrl", "list", "tl"].forEach(function (k) {
      var el = sheets[k];
      if (k === top) { el.setAttribute("data-p2lt-front", ""); el.removeAttribute("data-p2lt-back"); }
      else { el.setAttribute("data-p2lt-back", String(backRank)); backRank++; el.removeAttribute("data-p2lt-front"); }
    });
  }
  function clearFrontBack() {
    ["ctrl", "list", "tl"].forEach(function (k) { sheets[k].removeAttribute("data-p2lt-front"); sheets[k].removeAttribute("data-p2lt-back"); });
  }
  /* ---------- タイムラインシート: 拡大して流れる表示 ---------- */
  var PXPS = 16;   /* 1秒=16px に拡大。シート幅で見えるのは曲の一部だけ、それでよい */
  var TCOL = { call: "#ff6b9d", sing: "#4dc9ff", koko: "#ffd23f" };   /* 既存図解と同じ種類色 */
  var tlKey = null, tlManualUntil = 0, tlLastAuto = -1;
  function tlTarget() {
    /* プロトタイプ2 v50: 作成セッション中はタイムラインも作りかけのプレビューにする */
    var pvScenes = null;
    try { pvScenes = window.__p2UniPreviewScenes && window.__p2UniPreviewScenes(); } catch (e) {}
    if (pvScenes && pvScenes.length) {
      var pvCall = { id: "__p2pv__", ownerName: "プレビュー", versionName: "作りかけ", scenes: pvScenes };
      return { c: pvCall, D: Math.max(dur() || 0, pvScenes.reduce(function (m, s) { return Math.max(m, (+s.t || 0) + (+s.d || 0)); }, 0), 1) };
    }
    /* 対象コールと長さDの決め方は既存の tlNow と同じ優先順位: act → EV系の pseudo → calls[0] */
    try {
      if (act && calls.some(function (x) { return x.id === act; })) {
        var raw = calls.find(function (x) { return x.id === act; });
        var c = Object.assign({}, raw, { scenes: mkPlaybackScenes(raw.scenes) });
        return { c: c, D: Math.max(dur() || 0, c.scenes.reduce(function (m, s) { return Math.max(m, (+s.t || 0) + (+s.d || 0)); }, 0), 1) };
      }
      var sc = mkPv ? mkPv.scenes : EV;
      if (sc && sc.length) {
        var pseudo = { id: "__cur__", ownerName: refPlay ? "参考コール" : randPlay ? "ランダム再生" : "プレビュー", versionName: (curRef && curRef.versionName) || "", scenes: sc };
        return { c: pseudo, D: Math.max(dur() || 0, sc.reduce(function (m, s) { return Math.max(m, (+s.t || 0) + (+s.d || 0)); }, 0), 1) };
      }
      if (calls[0]) {
        var raw0 = calls[0];
        var c0 = Object.assign({}, raw0, { scenes: mkPlaybackScenes(raw0.scenes) });
        return { c: c0, D: Math.max(dur() || 0, c0.scenes.reduce(function (m, s) { return Math.max(m, (+s.t || 0) + (+s.d || 0)); }, 0), 1) };
      }
    } catch (e) {}
    return null;
  }
  function renderTl(force) {
    var tg = tlTarget();
    if (!tg || !tg.c.scenes || !tg.c.scenes.length) {
      if (tlKey !== "empty") { tlKey = "empty"; tlInner.innerHTML = '<div class="p2tl-empty">表示できるコールがまだありません</div>'; tlNowEl.textContent = ""; }
      return;
    }
    var c = tg.c, D = tg.D;
    var key = (c.id || "") + "|" + c.scenes.length + "|" + Math.round(D * 10) + "|" + (c.scenes[0] ? c.scenes[0].t : 0) + "|" + (c.scenes[c.scenes.length - 1] ? c.scenes[c.scenes.length - 1].t : 0) + "|" + (c.versionName || "");
    if (!force && key === tlKey) return;
    tlKey = key;
    var W = Math.max(Math.ceil(D * PXPS), 320);
    var html = '<div class="p2tl-ruler" style="width:' + W + 'px">';
    for (var sec = 0; sec <= D; sec += 10) html += '<span class="p2tl-tick" style="left:' + Math.round(sec * PXPS) + 'px">' + fmt(sec) + '</span>';
    html += '</div>';
    ["call", "sing", "koko"].forEach(function (k) {
      html += '<div class="p2tl-lane" style="width:' + W + 'px"><span class="p2tl-lab">' + LAB[k] + '</span>';
      c.scenes.forEach(function (s) {
        if (s.k !== k) return;
        var l = Math.max(0, Math.round((+s.t || 0) * PXPS));
        var w = Math.max(76, Math.round(((+s.d || 0) || 3) * PXPS));
        var col = TCOL[k] || "#ffffff";
        html += '<div class="p2tl-card" title="' + esc(String(s.x || LAB[k])) + '" style="left:' + l + 'px;width:' + w + 'px;border-color:' + col + ';background:' + col + '30"><small>' + fmt(Math.max(0, +s.t || 0)) + " " + LAB[k] + '</small><span class="p2tl-x">' + esc(String(s.x || LAB[k])) + '</span></div>';
      });
      html += '</div>';
    });
    html += '<div class="p2tl-pos" style="left:0"></div>';
    tlInner.innerHTML = html;
    tlInner.style.width = W + "px";
    followTl();
  }
  function followTl() {
    if (stage.getAttribute("data-top") !== "tl") return;
    var t = 0;
    try { t = now() || 0; } catch (e) {}
    var pe = tlInner.querySelector(".p2tl-pos");
    if (pe) pe.style.left = Math.round(t * PXPS) + "px";
    tlNowEl.textContent = fmt(t);
    if (Date.now() < tlManualUntil) return;   /* ユーザーが自分でスクロールした直後は追従で奪わない */
    var desired = Math.round(t * PXPS - tlScroll.clientWidth * 0.35);
    if (desired < 0) desired = 0;
    if (Math.abs(tlScroll.scrollLeft - desired) > 4) { tlLastAuto = desired; tlScroll.scrollLeft = desired; }
  }
  function openTlFull() { var b = document.getElementById("tlFsBtn"); if (b) b.click(); }
  tlSheet.querySelector(".p2tl-fs").addEventListener("click", function (e) { e.stopPropagation(); openTlFull(); });
  /* タップ(ほぼ動かさず離した)と横スクロールの区別: スクロールしただけでは全画面に飛ばない */
  var tapInfo = null;
  tlScroll.addEventListener("pointerdown", function (e) { tapInfo = { x: e.clientX, y: e.clientY, sl: tlScroll.scrollLeft, st: tlScroll.scrollTop, t: Date.now() }; tlManualUntil = Date.now() + 3500; });
  tlScroll.addEventListener("pointerup", function (e) {
    if (!tapInfo) return;
    var moved = Math.abs(e.clientX - tapInfo.x) + Math.abs(e.clientY - tapInfo.y);
    var scrolled = Math.abs(tlScroll.scrollLeft - tapInfo.sl) + Math.abs(tlScroll.scrollTop - tapInfo.st);
    var dt = Date.now() - tapInfo.t;
    tapInfo = null;
    if (moved < 10 && scrolled < 4 && dt < 500) openTlFull();
  });
  tlScroll.addEventListener("pointercancel", function () { tapInfo = null; });
  tlScroll.addEventListener("scroll", function () { if (Math.abs(tlScroll.scrollLeft - tlLastAuto) > 6) tlManualUntil = Date.now() + 3500; });
  setInterval(function () {
    if (built && stage.classList.contains("p2lt-active") && stage.getAttribute("data-top") === "tl") { renderTl(false); followTl(); }
  }, 250);
  /* ---------- ステージの構築・解除・同期(v41の仕組みを3枚に拡張) ---------- */
  function sync() {
    if (!built) return;
    var active = isPlayScreen() && list.classList.contains("on");
    if (active && !stage.classList.contains("p2lt-active")) {
      var h = ctrl.offsetHeight || ctrl.scrollHeight || 0;
      if (h > 40) ctrlH = h;
      stage.classList.add("p2lt-active");
      applyFrontBack();
      showGuide();
      if (stage.getAttribute("data-top") === "tl") renderTl(true);
    } else if (!active) {
      stage.classList.remove("p2lt-active");
      clearFrontBack();
      resetGuide();
      stage.style.height = "";
      return;
    }
    if (ctrlH > 40) stage.style.height = (ctrlH + 30) + "px";
  }
  function build() {
    if (built) return;
    app.insertBefore(stage, mRow1);
    ctrl.appendChild(row1); ctrl.appendChild(playrow); ctrl.appendChild(barwrap);
    stage.appendChild(ctrl); stage.appendChild(list); stage.appendChild(tlSheet); stage.appendChild(tabCtrl); stage.appendChild(tabList); stage.appendChild(tabTl); stage.appendChild(guide);
    built = true; paintTabs(); sync();
  }
  function unbuild() {
    if (!built) return;
    resetGuide();
    stage.classList.remove("p2lt-active"); stage.style.height = "";
    app.insertBefore(row1, mRow1); app.insertBefore(playrow, mPlay); app.insertBefore(barwrap, mBar); app.insertBefore(list, mList);
    if (stage.parentNode) stage.parentNode.removeChild(stage);
    built = false; tlKey = null;
  }
  /* 付箋のタップ切替。スライド切替が起きた直後の click は飲み込む(離した瞬間に別のシートへ飛ぶ誤作動防止) */
  var suppressTapUntil = 0;
  function tabClicked(which) { if (Date.now() < suppressTapUntil) return; setTop(which); }
  tabCtrl.addEventListener("click", function () { tabClicked("ctrl"); });
  tabList.addEventListener("click", function () { tabClicked("list"); });
  tabTl.addEventListener("click", function () { tabClicked("tl"); });
  /* 付箋帯のスライド切替: 指を置いたまま帯の中を上下に滑らせ、指が別の付箋の上に来た瞬間に
     そのシートが上に来る(離すのを待たない)。1回のジェスチャーで3枚を一気にめくれる。
     対象はタブ専用帯の中で始めたジェスチャーだけ。シート本体のスクロールには干渉しない。 */
  var tabByKey = { ctrl: tabCtrl, list: tabList, tl: tabTl };
  var slide = null;
  function tabAtPoint(x, y) {
    var found = null;
    ["ctrl", "list", "tl"].forEach(function (k) {
      var r = tabByKey[k].getBoundingClientRect();
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 4 && y <= r.bottom + 4) found = k;
    });
    return found;
  }
  function paintHot(which) {
    ["ctrl", "list", "tl"].forEach(function (k) { tabByKey[k].classList.toggle("p2lt-tab-hot", k === which); });
  }
  stage.addEventListener("pointerdown", function (e) {
    if (!stage.classList.contains("p2lt-active")) return;
    var sr = stage.getBoundingClientRect();
    if (e.clientX < sr.right - 34) return;   /* タブ専用帯(右端32px+余白)の外で始めたジェスチャーは対象外 */
    slide = { id: e.pointerId, switched: false };
    paintHot(tabAtPoint(e.clientX, e.clientY));
  });
  window.addEventListener("pointermove", function (e) {
    if (!slide || e.pointerId !== slide.id) return;
    var which = tabAtPoint(e.clientX, e.clientY);
    paintHot(which);
    if (which && which !== stage.getAttribute("data-top")) { setTop(which); slide.switched = true; }
  });
  function endSlide(e) {
    if (!slide || (e && e.pointerId !== slide.id)) return;
    if (slide.switched) suppressTapUntil = Date.now() + 600;
    slide = null;
    paintHot(null);
  }
  window.addEventListener("pointerup", endSlide);
  window.addEventListener("pointercancel", endSlide);
  var mo = new MutationObserver(function () { if (!isPlayScreen()) unbuild(); else { build(); sync(); } });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  mo.observe(list, { attributes: true, attributeFilter: ["class"] });
  var itemsEl = document.getElementById("playSceneItems");
  if (itemsEl) {
    var mo2 = new MutationObserver(function () { if (built && stage.getAttribute("data-top") === "tl") renderTl(false); });
    mo2.observe(itemsEl, { childList: true });
  }
  window.addEventListener("resize", sync);
  build();
})();

/* ---------- プロトタイプ2 v44: 制作範囲を絞る(作成画面のみ) ----------
   推しコール作成画面で、作る場所を「前／後」の二択で半分ずつ絞り込んでいくバー。
   バーは動画エリア(#mvwrap)の直下に置き、バー1本の中で完結させる(外に説明を足して
   画面を押し下げない)。見た目: 横幅いっぱい・高さ44px、両端が矢じり型(左=左向き三角/
   右=右向き三角)、中はベタ塗りで左半分が青(#2196f3)・右半分が赤(#f44336)、半分で色が
   変わる。左半分に「前」、右半分に「後」。中央には両色にまたがって、うっすら説明文字と
   現在の範囲(開始〜終了)を小さく重ねる。説明文字は、全体が対象のとき「制作範囲を絞る」、
   1回でも絞った後は「さらに範囲を絞る」、最大5段階に達したら「最大まで絞りました」。
   左半分タップ=その範囲の前半、右半分タップ=後半が新しい範囲になる。最大5段階
   (例: 240→120→60→30→15→7.5秒)。5段階では両半分を disabled にして絞れない見た目にする。
   「途中でやめる」専用ボタンは付けない(どの段階でもそのまま作り始められる前提で、
   制作途中でもバーを操作して範囲を切り替え直せる)。「1つ戻る」「全体に戻す」はバーの
   直下にささやかな小さいボタンで両方付ける。
   範囲の効き方: 250ms間隔の監視で、作成画面での再生が範囲の終わりを超えたら一時停止して
   範囲の頭へ戻し、範囲より前から再生されていたら範囲の頭へ寄せる。これにより再生位置に
   連動するノリノリながらモードのカード作成も範囲内に閉じる。プレビュー(mkPv)再生中と
   スクラブドラッグ(mkScrSt/mkPosScrSt)中は監視を止める(既存仕組みを壊さない)。
   作成画面を出たら全体に戻し、作成画面に入るたび・曲が変わるたび全体から始める。
   対象は作成画面(body.scr-mk)のみ。再生画面の三層ステージ(v43)には触らない。
   v46では曲全体タイムラインを同じブロック内に追加: 動画エリア(#mv)の下の方に、黒基調の
   トラック1本をうっすらレイヤーで浮かべる(absolute配置で画面を押し下げない、縦幅は細く、
   pointer-events:none で操作を妨げない、右下の全画面ボタン #fsbtn を避けて右に余白)。
   種類別の色分け・レーン分けはしない。現在の範囲の真ん中に白い線を引き、範囲を選ぶたびに
   全体の中で現在の範囲にあたる部分が赤く(#f44336系)なる。全体が対象のときは赤くしない。
   範囲の状態は v44 の cur をそのまま使い、paint() から連動して即更新する(二重管理しない)。 */
(function () {
  var mv = document.getElementById("mvwrap");
  if (!mv || !mv.parentNode) return;
  var MAXD = 5;
  var bar = document.createElement("div"); bar.id = "p2RangeBar";
  bar.innerHTML = '<div class="p2r-bar">'
    + '<span class="p2r-tri p2r-tri-l"></span>'
    + '<button type="button" class="p2r-half p2r-front">前</button>'
    + '<button type="button" class="p2r-half p2r-back">後</button>'
    + '<span class="p2r-tri p2r-tri-r"></span>'
    + '<span class="p2r-center"><span class="p2r-cap">制作範囲を絞る</span><span class="p2r-time"></span></span>'
    + '</div>'
    + '<div class="p2r-sub"><button type="button" class="p2r-btn p2r-back1">← 1つ戻る</button><button type="button" class="p2r-btn p2r-all">全体に戻す</button><span class="p2r-stage"></span></div>';
  mv.parentNode.insertBefore(bar, mv.nextSibling);
  /* v46: 曲全体タイムライン(動画エリアの下の方に浮かべるオーバーレイ) */
  var mvBox = document.getElementById("mv");
  var songTl = document.createElement("div"); songTl.id = "p2SongTl"; songTl.setAttribute("aria-hidden", "true");
  songTl.innerHTML = '<div class="p2stl-track"><div class="p2stl-hl"></div><div class="p2stl-mid"></div></div>';
  if (mvBox) mvBox.appendChild(songTl);
  var hlEl = songTl.querySelector(".p2stl-hl"), midEl = songTl.querySelector(".p2stl-mid");
  var capEl = bar.querySelector(".p2r-cap"), timeEl = bar.querySelector(".p2r-time"), stageEl = bar.querySelector(".p2r-stage");
  var frontBtn = bar.querySelector(".p2r-front"), backBtn = bar.querySelector(".p2r-back");
  var back1Btn = bar.querySelector(".p2r-back1"), allBtn = bar.querySelector(".p2r-all");
  var st = document.createElement("style"); st.id = "p2RangeStyles";
  st.textContent = "#p2RangeBar{display:none}"
    + "body.scr-mk #p2RangeBar{display:block;margin:8px 0 2px}"
    + ".p2r-bar{position:relative;display:flex;align-items:stretch;height:44px}"
    + ".p2r-tri{flex:0 0 auto;width:0;height:0;border-top:22px solid transparent;border-bottom:22px solid transparent}"
    + ".p2r-tri-l{border-right:16px solid #2196f3}"
    + ".p2r-tri-r{border-left:16px solid #f44336}"
    + ".p2r-half{flex:1;border:0;margin:0;padding:0 10px;font-family:inherit;font-size:15px;font-weight:900;color:#fff;cursor:pointer;display:flex;align-items:center}"
    + ".p2r-front{background:#2196f3;justify-content:flex-start}"
    + ".p2r-back{background:#f44336;justify-content:flex-end}"
    + ".p2r-half:disabled{opacity:.45;cursor:default}"
    + "#p2RangeBar.maxed .p2r-half{filter:grayscale(.4)}"
    + ".p2r-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;line-height:1.3}"
    + ".p2r-cap{display:block;font-size:12px;font-weight:900;letter-spacing:.12em;color:rgba(255,255,255,.85);text-shadow:0 1px 4px rgba(0,0,0,.45)}"
    + ".p2r-time{display:block;font-size:10px;font-weight:900;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55);font-variant-numeric:tabular-nums}"
    + ".p2r-sub{display:flex;align-items:center;gap:6px;margin-top:5px}"
    + ".p2r-btn{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:#cfd2f2;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:800;font-family:inherit;cursor:pointer}"
    + ".p2r-btn:disabled{opacity:.35;cursor:default}"
    + ".p2r-stage{margin-left:auto;font-size:10px;font-weight:800;color:#8e91b8}"
    /* v46: 曲全体タイムライン。作成画面でのみ、動画エリアの下の方にうっすら浮かべる */
    + "#p2SongTl{display:none}"
    + "body.scr-mk #p2SongTl{display:block;position:absolute;left:8px;right:60px;bottom:10px;height:12px;z-index:2;pointer-events:none;opacity:.92}"
    + ".p2stl-track{position:relative;width:100%;height:100%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.30);border-radius:999px;box-sizing:border-box}"
    + ".p2stl-hl{position:absolute;top:0;bottom:0;background:rgba(244,67,54,.82);border-radius:999px;display:none}"
    + ".p2stl-mid{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#fff;border-radius:1px;box-shadow:0 0 4px rgba(0,0,0,.65)}";
  document.head.appendChild(st);
  function baseRange() {
    var R = null;
    try { R = curRange(); } catch (e) {}
    if (R && R.e > R.s) return { a: R.s, b: R.e };
    var d = 0;
    try { d = dur() || 0; } catch (e) {}
    return { a: 0, b: d > 0 ? d : 240 };
  }
  var cur = null;
  function inMk() { return document.body.classList.contains("scr-mk"); }
  function paint() {
    if (!cur) return;
    capEl.textContent = cur.depth >= MAXD ? "最大まで絞りました" : (cur.depth === 0 ? "制作範囲を絞る" : "さらに範囲を絞る");
    timeEl.textContent = fmt(cur.a) + "〜" + fmt(cur.b);
    stageEl.textContent = "絞り込み " + cur.depth + "/" + MAXD;
    var maxed = cur.depth >= MAXD;
    frontBtn.disabled = maxed; backBtn.disabled = maxed;
    bar.classList.toggle("maxed", maxed);
    back1Btn.disabled = cur.hist.length === 0;
    allBtn.disabled = cur.depth === 0;
    paintTl();
  }
  /* v46: 全体タイムラインのハイライト(現在の範囲)と半分の線を、v44の範囲に連動させる */
  function paintTl() {
    if (!cur) return;
    var base = baseRange();
    var len = base.b - base.a;
    if (!(len > 0)) return;
    var mid = (cur.a + cur.b) / 2;
    midEl.style.left = (((mid - base.a) / len) * 100) + "%";
    if (cur.depth === 0) { hlEl.style.display = "none"; return; }
    hlEl.style.display = "block";
    hlEl.style.left = (((cur.a - base.a) / len) * 100) + "%";
    hlEl.style.width = (((cur.b - cur.a) / len) * 100) + "%";
  }
  function reset() {
    var base = baseRange();
    cur = { a: base.a, b: base.b, depth: 0, hist: [] };
    paint();
  }
  function narrow(dir) {
    if (!cur || cur.depth >= MAXD) return;
    if (!(cur.b - cur.a > 0.2)) return;
    cur.hist.push({ a: cur.a, b: cur.b });
    var mid = (cur.a + cur.b) / 2;
    if (dir === "front") cur.b = mid; else cur.a = mid;
    cur.depth++;
    try { var t = now(); if (t < cur.a || t >= cur.b) playerSeek(cur.a); } catch (e) {}
    paint();
  }
  frontBtn.addEventListener("click", function () { narrow("front"); });
  backBtn.addEventListener("click", function () { narrow("back"); });
  back1Btn.addEventListener("click", function () {
    if (!cur || !cur.hist.length) return;
    var h = cur.hist.pop();
    cur.a = h.a; cur.b = h.b; cur.depth = Math.max(0, cur.depth - 1);
    paint();
  });
  allBtn.addEventListener("click", function () { reset(); });
  function songKey() { try { return String(si) + "|" + (SONGS[si] ? SONGS[si].title : ""); } catch (e) { return ""; } }
  var lastSongKey = songKey(), wasMk = inMk();
  setInterval(function () {
    var mk = inMk();
    if (mk !== wasMk) { reset(); wasMk = mk; }
    if (!mk) return;
    var sk = songKey();
    if (sk && lastSongKey && sk !== lastSongKey) { lastSongKey = sk; reset(); return; }
    if (sk) lastSongKey = sk;
    if (!cur || cur.depth === 0) {
      var nb = baseRange();
      if (!cur || nb.a !== cur.a || nb.b !== cur.b) { cur = { a: nb.a, b: nb.b, depth: 0, hist: [] }; paint(); }
      return;
    }
    try {
      if (typeof mkPv !== "undefined" && mkPv) return;
      if (typeof mkScrSt !== "undefined" && mkScrSt && mkScrSt.active) return;
      if (typeof mkPosScrSt !== "undefined" && mkPosScrSt && mkPosScrSt.active) return;
      if (window.__p2PlaceDragActive && window.__p2PlaceDragActive()) return;   // v55: お気に置くドラッグ中は範囲の終わりで止めない(ドラッグ側が位置を決めている)
      var stt = (typeof playerState === "function") ? playerState() : -1;
      if (stt !== 1) return;
      var t = now();
      if (t < cur.a - 0.05) playerSeek(cur.a);
      else if (t >= cur.b) { playerPause(); playerSeek(cur.a); }
    } catch (e) {}
  }, 250);
  var mo = new MutationObserver(function () {
    var mk = inMk();
    if (mk !== wasMk) { reset(); wasMk = mk; }
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  try { window.__p2Range = { get: function () { return cur ? { a: cur.a, b: cur.b, depth: cur.depth, hist: cur.hist.length } : null; }, narrow: narrow, reset: reset, el: bar, tl: songTl, MAXD: MAXD,
    /* v47: 絞っている間(depth>=1)は、スクラブ・打ち込みで決まる位置も範囲内に閉じるためのクランプ。
       tail は末尾から空ける秒数(カードの長さ等)。絞っていない時と作成画面の外では素通し */
    clamp: function (t, tail) {
      if (!cur || cur.depth === 0 || !inMk()) return t;
      var hi = cur.b - (tail || 0);
      if (hi < cur.a) hi = cur.a;
      return Math.max(cur.a, Math.min(hi, t));
    },
    /* v47: 開始位置 t が範囲内にある時だけ、長さ d が範囲の終わりを超えないようにする */
    span: function (t, d) {
      if (!cur || cur.depth === 0 || !inMk()) return d;
      if (t < cur.a || t >= cur.b) return d;
      return Math.min(d, Math.max(0.5, cur.b - t));
    } }; } catch (e) {}
  reset();
})();

/* ================= プロトタイプ2 v48: 作成レイヤー統合UI(段階1/3) =================
   - 作成は付箋レイヤーの一番下の層として常駐させる。再生画面の三層ステージ左下に、下向き付箋「作成」を追加し、タップで作成へ入る
   - 作成の2モード制(ノリノリながら/お気に置き)は廃止し mkMode="uni" に固定。モード切替タブは隠し、「置きに行く」兼用(oki前提の各処理)は自然に無効になる
   - 作成レイヤーの並び: シークバー(見た目は細い線・当たり判定は広く・時刻テキストなし・速度セレクトなし)
     → 曲全体タイムライン(v46の浮き表示をやめシークバー直下へ移動。赤=現在の範囲/白線=範囲の真ん中/白い縦線=再生位置)
     → 制作タイムライン(常時表示) → 再生の段(▶再生+送りのみ) → カード一覧 → 作る用パーツ
   - カード一覧の先頭に常設「新規作成カード」: 時刻は再生位置に連動。タップで空カード(長さ3.0秒)、長押しで押した長さの空カードを作る
   - 空カードは文言欄「コールを指定」が薄く点滅。タップで既存の内容パネル(mkContentPanel)がそのカードに対して開く
   - 作りかけ(mk.scenes)は、再生側で別の曲を見に行っても保持される(A.song の接続変更 + 作成対象の曲を覚えて復元) */
(function p2Uni48() {
  try {
    document.body.classList.add("p2uni");
    try { mkMode = "uni"; } catch (e) {}

    var st = document.createElement("style"); st.id = "p2UniStyles";
    st.textContent = [
      "body.scr-mk.p2uni #mkModeTabs{display:none!important}",
      "body.scr-mk.p2uni #mkTlNote{display:none!important}",
      "body.scr-mk.p2uni #mkBigWrap{display:none!important}",
      "body.scr-mk.p2uni #mkRateSelect{display:none!important}",
      "body.scr-mk.p2uni .p2row1 .sq{display:none!important}",
      "body.scr-mk.p2uni .dots{display:none!important}",
      "body.scr-mk.p2uni #mkPosEdit,body.scr-mk.p2uni #mkEdit{display:none!important}",
      "body.scr-mk.p2uni #mkVer,body.scr-mk.p2uni #mkNote,body.scr-mk.p2uni #mkGuestName,body.scr-mk.p2uni #mkPubBtn,body.scr-mk.p2uni #mkPvBtn,body.scr-mk.p2uni #mkSaveBtn,body.scr-mk.p2uni .mkyameru{display:none!important}",
      "body.scr-mk.p2uni #mkPresets,body.scr-mk.p2uni #mkApplyNote{display:block!important}",
      "body.scr-mk.p2uni #mkTypes{display:flex!important}",
      "body.scr-mk.p2uni .mkTextRow{display:flex!important}",
      "body.scr-mk.p2uni #mkTuneBtn{display:block!important}",
      "body.scr-mk.p2uni #mkTlBox{display:flex!important}",
      "body.scr-mk.p2uni #mkTlBox{order:1}",
      "body.scr-mk.p2uni .mk-card-list{order:2}",
      "body.scr-mk.p2uni #mkPresets{order:3}",
      "body.scr-mk.p2uni #mkApplyNote{order:4}",
      "body.scr-mk.p2uni #mkTypes{order:5}",
      "body.scr-mk.p2uni .mkTextRow{order:6}",
      "body.scr-mk.p2uni #mkTuneBtn{order:7}",
      "body.scr-mk.p2uni #mkTunePanel{order:8}",
      "body.scr-mk.p2uni #barwrap .times{display:none!important}",
      "body.scr-mk.p2uni #barin{padding:11px 0;cursor:pointer}",
      "body.scr-mk.p2uni #p2SongTl{position:relative;left:auto;right:auto;bottom:auto;height:14px;margin:0 0 4px;opacity:1}",
      "#p2SongTl .p2stl-pos{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.8)}",
      "#p2LayerStage.p2lt-active{margin-bottom:30px}",
      ".p2uni-tab{position:absolute;left:8px;bottom:-27px;z-index:60;border:0;cursor:pointer;font-family:inherit;font-weight:900;font-size:13px;color:#10330f;background:#b9f6a5;padding:5px 16px 7px;border-radius:0 0 12px 12px;box-shadow:0 4px 10px rgba(0,0,0,.45)}",
      "#p2UniTabMk{display:none;position:fixed;left:8px;bottom:0;z-index:60;border:0;cursor:pointer;font-family:inherit;font-weight:900;font-size:13px;color:#10330f;background:#7ed957;padding:6px 16px 8px;border-radius:12px 12px 0 0;box-shadow:0 -3px 10px rgba(0,0,0,.4)}",
      "body.scr-mk.p2uni #p2UniTabMk{display:block}",
      ".p2uni-new{position:relative;margin:28px 0 10px;border:2px dashed #8e91b8;border-radius:12px;padding:8px;background:rgba(142,145,184,.08)}",
      ".p2uni-new .p2uni-bubble{position:absolute;left:10px;top:-23px;background:#fff;color:#222;font-size:11px;font-weight:700;padding:3px 8px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);z-index:2}",
      ".p2uni-new .p2uni-bubble:after{content:\"\";position:absolute;left:22px;bottom:-5px;width:10px;height:10px;background:#fff;transform:rotate(45deg)}",
      ".p2uni-newrow{display:flex;align-items:center;gap:8px}",
      ".p2uni-newtime{font-weight:900;font-size:17px;color:#cfd2f2;background:none;border:0;font-family:inherit;cursor:pointer;padding:6px 4px;min-width:70px;text-align:left}",
      ".p2uni-newlabel{flex:1;font-weight:900;font-size:15px;color:#7ed957}",
      ".p2uni-newhint{font-size:10px;color:var(--mut);line-height:1.5}",
      ".p2uni-empty{color:#9aa0d8;font-weight:700;animation:p2uniBlink 1.2s ease-in-out infinite}",
      "@keyframes p2uniBlink{0%,100%{opacity:1}50%{opacity:.35}}",
      ".p2uni-zone{cursor:pointer}"
    ].join("\n");
    document.head.appendChild(st);

    /* 曲全体タイムライン: 再生位置の白線を追加するだけにし、DOM移動は v51 の配置処理に任せる。
       (v48〜v50 ではここで #barwrap の隣へ移していたが、その隣は三層ステージの操作シート内で、
        作成画面に入るとステージごと取り外されて全体タイムラインが画面から消える不具合があった) */
    var posEl = null;
    var songTl = document.getElementById("p2SongTl");
    if (songTl) {
      var track = songTl.querySelector(".p2stl-track");
      if (track) { posEl = document.createElement("div"); posEl.className = "p2stl-pos"; posEl.style.left = "0%"; track.appendChild(posEl); }
    }
    function uniBase() {
      /* v53: 再生位置の線は、赤い範囲と真ん中の線(v44 paintTl)と同じ軸(登録範囲 or 曲全体)で描く。
         以前は絞った範囲を軸にしていたため、絞ると線だけがバーの端から端まで動いてしまい、
         赤い範囲の位置と合っていなかった(祐治の実機指摘3) */
      var R = curRange(); if (R) return {a: R.s, b: R.e};
      return {a: 0, b: Math.max(1, dur() || 240)};
    }

    /* 再生画面ステージ左下の下向き付箋「作成」 */
    var tab = null;
    function ensureTab() {
      var stage = document.getElementById("p2LayerStage"); if (!stage) return;
      if (tab && tab.parentNode === stage) return;
      if (!tab) {
        tab = document.createElement("button"); tab.type = "button"; tab.className = "p2uni-tab"; tab.id = "p2UniTab";
        tab.textContent = "作成 ▽"; tab.title = "推しコールを作る(作りかけはそのまま残ります)";
        tab.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (document.body.classList.contains("scr-mk")) return;
          var gb = document.getElementById("guideBar");
          if (gb && gb.classList.contains("on")) return;   /* ガイド進行中はガイド側の入口に任せる */
          A.startMk();
        });
      }
      stage.appendChild(tab);
    }
    ensureTab();

    /* 作成画面側の固定タブ: タップで再生側へ戻る(作りかけは保持される) */
    var tabMk = document.createElement("button"); tabMk.type = "button"; tabMk.id = "p2UniTabMk";
    tabMk.textContent = "作成 ▽"; tabMk.title = "いま作成中です。タップで再生画面へ戻ります(作りかけは残ります)";
    tabMk.addEventListener("click", function () { if (document.body.classList.contains("scr-mk")) exitMk(); });
    document.body.appendChild(tabMk);

    /* 作成対象の曲を覚える: 再生側で曲を変えても、作成に戻ると下書きの曲へ復元する */
    var uniSong = null, wasMk = false;
    function trackDraftSong() {
      var inMk = document.body.classList.contains("scr-mk");
      if (inMk && !wasMk) {
        if (mk.scenes.length && uniSong != null && si !== uniSong && SONGS[uniSong]) {
          si = uniSong; VID = SONGS[si].vid; UI.songSel(si); cueCurrentSong(); renderMk();
        }
        if (!mk.scenes.length) uniSong = si;
      }
      wasMk = inMk;
      if (inMk && mk.scenes.length) uniSong = si;
      if (inMk && mkMode !== "uni") { try { mkMode = "uni"; paintMkMode(); } catch (e) {} }
    }

    /* ---------- カード一覧の描画(新規作成カード + 空カード対応) ---------- */
    function uniIsEmpty(sc) { return !(sc.x && String(sc.x).trim()); }
    function uniNewCardHtml() {
      var t = 0; try { t = playerReady() ? now() : 0; } catch (e) {}
      return '<div class="p2uni-new" id="p2UniNew">'
        + '<div class="p2uni-bubble">聞きながらタップで再生位置を決定</div>'
        + '<div class="p2uni-newrow">'
        + '<button type="button" class="p2uni-newtime" id="p2UniNewTime">' + fmt(t) + '</button>'
        + '<div class="p2uni-newlabel">新規作成</div>'
        + '<div class="p2uni-newhint">タップ: その位置に空カード<br>長押し: 押した長さで作成</div>'
        + '</div></div>';
    }
    window.__p2UniCards = function (scenes, sel) {
      var h = uniNewCardHtml();
      if (!scenes.length) return h + '<div style="font-size:12px;color:var(--mut);padding:4px 2px">まだカードがありません。上の「新規作成」の時刻をタップすると、聞いている位置に空カードができます。</div>';
      var entries = scenes.map(function (e, i) { return {e: e, i: i}; });
      var card = function (o) {
        var e = o.e, i = o.i, empty = uniIsEmpty(e), isPl = mkIsPlaced(e);
        /* v51: カード全体を1つの選択ボタン(mkpick)にせず、時刻・文言・長さをそれぞれ独立した
           ボタンにする(秒数だけをタップしても他の部分が巻き込まれないようにするため)。
           土台の .mkpick は data-a を持たない div にし、文書全体のクリック委譲(A.mkPick)が
           カード面のタップでは発火しないようにする */
        var timeHtml = isPl
          ? '<button type="button" class="mkt p2uni-zone" data-zone="time" data-i="' + i + '">' + fmt(e.t) + '</button>'
          : '<span class="mkt">未配置</span>';
        var xHtml = empty
          ? '<button type="button" class="mkx p2uni-empty p2uni-zone" data-zone="content" data-i="' + i + '">コールを指定</button>'
          : '<button type="button" class="mkx p2uni-zone" data-zone="content" data-i="' + i + '">' + esc(e.x) + '</button>';
        var dHtml = isPl
          ? '<button type="button" class="mkd p2uni-zone" data-zone="dur" data-i="' + i + '">' + e.d + '秒</button>'
          : '<span class="mkd">まだ置いていません</span>';
        return '<div class="mkcard p2uni-card' + (i === sel ? " sel" : "") + (isPl ? "" : " pend") + '" data-ci="' + i + '">'
          + '<div class="mkpick">'
          + timeHtml + '<span class="mkk">' + LAB[e.k] + '</span>' + xHtml + dHtml
          + '</div>'
          + '<button type="button" class="p2uni-copy" data-copy="' + i + '">コピー</button>'
          + '<button type="button" class="mkdel" data-a="delScene" data-i="' + i + '" aria-label="削除">×</button>'
          /* v52: お気に置くは、選択中のカードにだけ、上辺に付箋のように出す(中央の常時丸ボタンは
             他の項目と混雑して押しにくいので廃止)。見た目(タブ形)は v52 のスタイルで付ける */
          + (i === sel ? '<button type="button" class="p2uni-place" data-place="' + i + '" title="お気に置く: 押したままタイムラインへ動かして離すと位置が決まります" aria-label="お気に置く"></button>' : '')
          + '</div>';
      };
      /* v55: 編集は一覧の中では行わない(埋め込みボードと v52 の固定表示は廃止)。
         編集は中央に浮かぶ大きなカード(__p2Uni55)で完結させるため、一覧は通常の並びのまま */
      var placed = entries.filter(function (o) { return mkIsPlaced(o.e); });
      var unplaced = entries.filter(function (o) { return !mkIsPlaced(o.e); });
      var out = placed.map(card).join("");
      if (unplaced.length) out += '<div style="font-size:11px;color:var(--mut);margin:8px 0 2px">未配置のカード(内容だけ先に作ったもの)</div>' + unplaced.map(card).join("");
      return h + out;
    };

    /* ---------- 新規作成カード: タップで空カード(3.0秒) / 長押しで押した長さ ---------- */
    var newHold = null;
    function uniCreateEmpty(t0, durSec) {
      var d = Math.round(Math.max(0.5, Math.min(20, durSec)) * 10) / 10;
      var tt = Math.round((+t0 || 0) * 10) / 10;
      tt = p2RangeClamp(tt, d);
      d = Math.round(Math.max(0.5, p2RangeSpan(tt, d)) * 10) / 10;
      var sc = {t: tt, d: d, placed: true, k: mk.type || "call", x: ""};
      mk.scenes.push(sc); mkSortScenes();
      mkSel = mk.scenes.indexOf(sc); mkSelOrigT = sc.t;
      renderMk();
      toast("空カードを作りました(" + fmt(sc.t) + " / " + sc.d + "秒)。「コールを指定」をタップして内容を入れてください");
    }
    var listEl = document.getElementById("mkList");
    if (listEl) {
      listEl.addEventListener("pointerdown", function (e) {
        var nt = e.target && e.target.closest ? e.target.closest("#p2UniNewTime") : null;
        if (!nt) return;
        e.preventDefault();
        newHold = {t0: (function () { try { return playerReady() ? now() : 0; } catch (err) { return 0; } })(), at: Date.now()};
        try { nt.setPointerCapture && nt.setPointerCapture(e.pointerId); } catch (err) {}
      });
      listEl.addEventListener("pointerup", function (e) {
        if (!newHold) return;
        var held = (Date.now() - newHold.at) / 1000, t0 = newHold.t0; newHold = null;
        if (held >= 0.25) uniCreateEmpty(t0, held);
        else uniCreateEmpty(t0, 3);
      });
      listEl.addEventListener("pointercancel", function () { newHold = null; });
      listEl.addEventListener("click", function (e) {
        var z = e.target && e.target.closest ? e.target.closest('[data-zone="content"]') : null;
        if (z) {
          e.stopPropagation(); e.preventDefault();
          var sc = mk.scenes[+z.dataset.i]; if (!sc) return;
          /* v55: 内容の編集も、中央に浮かぶ大きなカードの中で完結させる */
          if (window.__p2Uni55 && window.__p2Uni55.open) window.__p2Uni55.open(+z.dataset.i, "content");
          else openMkContentPanel(sc);
          return;
        }
        var nt2 = e.target && e.target.closest ? e.target.closest("#p2UniNewTime") : null;
        if (nt2) { e.stopPropagation(); e.preventDefault(); }
      });
    }

    /* 新規作成カードの時刻連動 + 全体タイムラインの再生位置線 */
    setInterval(function () {
      if (!document.body.classList.contains("scr-mk")) return;
      var el = document.getElementById("p2UniNewTime");
      if (el) {
        if (newHold) el.textContent = "長さ " + Math.max(0.5, Math.min(20, (Date.now() - newHold.at) / 1000)).toFixed(1) + "秒";
        else { try { el.textContent = fmt(playerReady() ? now() : 0); } catch (e) {} }
      }
      if (posEl) {
        try {
          var b = uniBase(), pc = (now() - b.a) / Math.max(0.001, b.b - b.a) * 100;
          posEl.style.left = Math.max(0, Math.min(100, pc)) + "%";
        } catch (e) {}
      }
    }, 250);

    var mo = new MutationObserver(function () { ensureTab(); trackDraftSong(); });
    mo.observe(document.body, {attributes: true, attributeFilter: ["class"]});
    setInterval(function () { ensureTab(); trackDraftSong(); }, 800);
    window.__p2Uni = {version: 48};
  } catch (e) { try { console.warn("p2Uni48", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v49: カード操作一式(段階2/3) =================
   - お気に置くボタン: 各カード中央のうっすら青い丸(白フチ+影で大きく見せる)。押したまま動かすとカードが浮いてドラッグでき、
     制作タイムライン(拡大表示中も含む)の上で離すと位置確定、外で離すとキャンセル。配置済みは開始時に「カード位置が変わります」と出す。置き直し無制限
   - コピーボタン: 押すと直下に同じカード(時刻も同じ)を複製
   - 編集ボード: 時刻タップ=位置用 / 長さタップ=長さ用(あわせてヒント吹き出し「長押しでコールの長さを編集」)。
     大きめの −/＋、秒数の直接入力とホイール変更、決定ボタン。位置は0.1秒単位、長さは0.5〜20秒、範囲絞り中は v47 クランプ適用
   - 長さの長押し: 押している長さで長さを決め直す(従来方式)。短いタップとの区別は既存の閾値 0.25秒
   - 文言タップ編集は v48 の内容パネル連携(元の内容入りで開く)をそのまま使う */
(function p2Uni49() {
  try {
    var st = document.createElement("style"); st.id = "p2Uni49Styles";
    st.textContent = [
      ".p2uni-card{position:relative}",
      ".p2uni-copy{flex:none;align-self:center;font-size:11px;font-weight:700;border:1.5px solid #8e91b8;background:none;color:#cfd2f2;border-radius:8px;padding:6px 8px;cursor:pointer;font-family:inherit}",
      ".p2uni-place{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;border:2px solid #fff;background:rgba(77,201,255,.45);box-shadow:0 2px 8px rgba(0,0,0,.5),0 0 0 4px rgba(77,201,255,.22);cursor:grab;z-index:3;touch-action:none;padding:0}",
      ".p2uni-place:after{content:\"\";position:absolute;left:50%;top:50%;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.9);transform:translate(-50%,-50%)}",
      ".p2uni-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.9;box-shadow:0 14px 30px rgba(0,0,0,.55);background:var(--panel);border-radius:10px;margin:0}",
      ".p2uni-hint{position:absolute;right:6px;top:-23px;background:#fff;color:#222;font-size:11px;font-weight:700;padding:3px 8px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);z-index:5}",
      ".p2uni-board{display:flex;align-items:center;gap:8px;padding:8px 4px 12px 40px;flex-wrap:wrap}",
      ".p2uni-board-label{font-size:12px;font-weight:900;color:#cfd2f2}",
      ".p2uni-board button{height:44px;min-width:44px;font-size:19px;font-weight:900;border-radius:12px;border:2px solid #8e91b8;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;padding:0 10px}",
      ".p2uni-board .p2uni-board-ok{background:#ffd23f;color:#2a2410;border-color:#ffd23f;font-size:14px}",
      ".p2uni-board-in{width:86px;height:44px;text-align:center;font-size:16px;font-weight:900;border-radius:12px;border:2px solid #8e91b8;background:var(--bg);color:var(--ink);font-family:inherit}",
      ".p2uni-board-unit{font-size:12px;color:var(--mut)}",
      "#mkTlBox.p2uni-tlhot{outline:2px solid #4dc9ff;outline-offset:2px}"
    ].join("\n");
    document.head.appendChild(st);

    /* ---------- 編集ボード ---------- */
    var board = null;   /* {sc, kind:"pos"|"dur", val} */
    function boardClamp(kind, v, sc) {
      if (kind === "dur") return Math.round(Math.max(0.5, Math.min(20, v)) * 10) / 10;
      var D = Math.max(dur() || 0, 1);
      v = Math.max(0, Math.min(Math.max(0, D - (sc ? sc.d : 0)), v));
      v = p2RangeClamp(v, sc ? sc.d : 0);
      return Math.round(v * 10) / 10;
    }
    window.__p2Uni49 = {
      boardHtml: function (i, e) {
        if (!board || board.sc !== e) return "";
        var label = board.kind === "pos" ? "位置" : "長さ";
        return '<div class="p2uni-board" data-board="' + i + '">'
          + '<span class="p2uni-board-label">' + label + '</span>'
          + '<button type="button" data-badj="-1" aria-label="減らす">−</button>'
          + '<input class="p2uni-board-in" type="text" inputmode="decimal" value="' + board.val.toFixed(1) + '" aria-label="' + label + '(秒)">'
          + '<span class="p2uni-board-unit">秒</span>'
          + '<button type="button" data-badj="1" aria-label="増やす">＋</button>'
          + '<button type="button" class="p2uni-board-ok" data-bok="' + i + '">決定</button>'
          + '<button type="button" class="p2uni-board-x" data-bx="1" aria-label="閉じる">×</button>'
          + '</div>';
      }
    };
    /* v55: 編集の入口は「中央に浮かぶ大きなカード」に一本化する。ポップアップが
       使えない場合だけ、従来の埋め込みボードに落とす(安全弁) */
    function openEditor(i, kind) {
      if (window.__p2Uni55 && window.__p2Uni55.open) { window.__p2Uni55.open(i, kind); return; }
      openBoard(i, kind);
    }
    function openBoard(i, kind) {
      var sc = mk.scenes[i]; if (!sc) return;
      mkSel = i; mkSelOrigT = sc.t;
      board = {sc: sc, kind: kind, val: kind === "pos" ? (sc.t || 0) : sc.d};
      renderMk();
      if (kind === "pos" && mkIsPlaced(sc) && playerReady()) playerSeek(sc.t);
    }
    function applyBoard() {
      if (!board) return;
      var sc = board.sc, inp = document.querySelector(".p2uni-board-in");
      var v = inp ? parseFloat(inp.value) : board.val;
      if (isNaN(v)) v = board.val;
      if (board.kind === "pos") {
        sc.t = boardClamp("pos", v, sc); sc.placed = true;
        mkSortScenes(); mkSel = mk.scenes.indexOf(sc);
        toast("位置を " + fmt(sc.t) + " にしました");
      } else {
        v = boardClamp("dur", v, sc);
        if (mkIsPlaced(sc)) v = Math.round(Math.max(0.5, p2RangeSpan(sc.t, v)) * 10) / 10;
        sc.d = v;
        toast("長さを " + sc.d + " 秒にしました");
      }
      board = null; renderMk();
    }
    function stepBoard(dir) {
      if (!board) return;
      var inp = document.querySelector(".p2uni-board-in");
      var v = inp ? parseFloat(inp.value) : board.val;
      if (isNaN(v)) v = board.val;
      v = boardClamp(board.kind, v + dir * 0.1, board.sc);
      board.val = v;
      if (inp) inp.value = v.toFixed(1);
    }
    function showDurHint(i) {
      var card = document.querySelector('#mkList .mkcard[data-ci="' + i + '"]');
      if (!card) return;
      var h = document.createElement("div"); h.className = "p2uni-hint"; h.textContent = "長押しでコールの長さを編集";
      card.appendChild(h);
      setTimeout(function () { try { h.remove(); } catch (e) {} }, 2200);
    }

    /* ---------- コピー ---------- */
    function uniCopy(i) {
      var sc = mk.scenes[i]; if (!sc) return;
      mk.scenes.splice(i + 1, 0, {t: sc.t, d: sc.d, placed: sc.placed, k: sc.k, x: sc.x});
      mkSel = i + 1; board = null;
      renderMk();
      toast("カードをコピーしました");
    }

    /* ---------- カード面(ゾーン以外)のタップ = 選択だけ ----------
       v51: A.mkPick は使わない。mkPick は「選択中カードの再タップで内容パネルを開く」動きを
       含むため、ゾーンのタップに続くクリックがカード面に着地すると内容パネルが開いてしまう
       (秒数タップが他の部分を巻き込む不具合の一因)。ここでは選択と音の確認だけを行う */
    function selectCardUni(i) {
      var sc = mk.scenes[i]; if (!sc) return;
      if (mkSel === i) return;   /* 選択中の再タップでは何も開かない(各ゾーンが単独で反応する仕様) */
      mkSel = i; mkLenPhase = null; mkSelOrigT = sc.t;
      mk.type = sc.k;
      board = null;
      renderMk();
      if (mkIsPlaced(sc) && playerReady()) { playerSeek(sc.t); playerPlay(); }
      try { guideEvent("picked"); } catch (e) {}
    }

    /* ---------- お気に置くドラッグ ---------- */
    var placeDrag = null;
    function tlHit(x, y) {
      var cands = [];
      var zb = document.getElementById("mkTlZoomBox");
      if (document.body.classList.contains("mk-tl-on") && zb) cands.push({el: zb, slide: document.getElementById("mkTlZoomSlide"), zoom: true});
      var box = document.getElementById("mkTlBox");
      if (box) cands.push({el: box, slide: document.getElementById("mkTlSlide"), zoom: false});
      for (var n = 0; n < cands.length; n++) {
        var r = cands[n].el.getBoundingClientRect();
        if (r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          cands[n].win = cands[n].zoom ? mkTlWin15() : mkTlAxis();   /* v53: 通常帯は表示と同じ主軸で変換する(従来は拡大ON時に30秒窓で変換し、通常表示=曲全体/範囲とも拡大表示=15秒ともずれていた) */
          return cands[n];
        }
      }
      return null;
    }
    function dragT(hit, x) {
      var r = (hit.slide || hit.el).getBoundingClientRect();
      if (!r.width) return null;
      var ratio = Math.max(0, Math.min(1, (x - r.left) / r.width));
      return hit.win.a + ratio * hit.win.span;
    }
    function startPlaceDrag(e, i, btn) {
      var sc = mk.scenes[i]; if (!sc) return;
      mkSel = i; board = null;
      /* v53: 拡大タイムラインは、メインのタイムラインに指が入った時ではなく、ドラッグを
         始めた瞬間に浮かび上がらせる(祐治の実機指摘2) */
      var zoomNow = false;
      try { mkSetZoom(true, mkIsPlaced(sc) ? sc.t : (now() || 0)); zoomNow = true; } catch (err) {}
      var card = btn.closest ? (btn.closest(".mkcard") || btn.closest(".p2uni-pop-face")) : null;   /* v55: 大きな編集カードから掴んだ時は、その顔部分をゴーストにする */
      var r = card ? card.getBoundingClientRect() : {left: e.clientX - 60, top: e.clientY - 20, width: 240, height: 48};
      var ghost = card ? card.cloneNode(true) : document.createElement("div");
      ghost.classList.add("p2uni-ghost"); ghost.removeAttribute("id");
      ghost.style.width = r.width + "px"; ghost.style.left = r.left + "px"; ghost.style.top = r.top + "px";
      document.body.appendChild(ghost);
      placeDrag = {sc: sc, origT: sc.t, origPlaced: mkIsPlaced(sc), ghost: ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, over: false, lastSeek: 0, zoomed: zoomNow, settle: null, lastX: e.clientX, lastY: e.clientY};
      if (placeDrag.origPlaced) toast("カード位置が変わります");
      try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) {}
    }
    /* v51: タイムラインの外でも、指の横位置から対応する曲位置を求める(制作タイムラインの
       スライド帯の左端=曲の頭・右端=曲の終わりとして、縦位置は問わない)。
       スクラブ(mkScr)の mkBandAbs と同じ考え方で、帯が取れない時だけ画面幅ベースに落とす */
    function absDragT(x) {
      var slide = document.getElementById("mkTlSlide");
      if (slide) {
        var r = slide.getBoundingClientRect();
        if (r.width > 10) { var ax = mkTlAxis(); return ax.a + Math.max(0, Math.min(1, (x - r.left) / r.width)) * ax.span; }   /* v53: 主軸に合わせる */
      }
      return mkBandAbs(x);
    }
    function movePlaceDrag(e) {
      var pd = placeDrag; if (!pd) return;
      pd.ghost.style.left = (e.clientX - pd.dx) + "px";
      pd.ghost.style.top = (e.clientY - pd.dy) + "px";
      pd.lastX = e.clientX; pd.lastY = e.clientY;
      var hit = tlHit(e.clientX, e.clientY);
      pd.over = !!hit;
      var box = document.getElementById("mkTlBox"); if (box) box.classList.toggle("p2uni-tlhot", !!hit);
      /* v51: ドロップ可否(タイムライン上かどうか)と、再生プレビューの位置計算を分ける。
         指がどこにあっても、その横位置に対応する位置へ仮置きし、音も追従させる */
      var t = hit ? dragT(hit, e.clientX) : absDragT(e.clientX);
      if (t == null) return;
      var D = Math.max(dur() || 0, 1);
      t = Math.round(Math.max(0, Math.min(Math.max(0, D - pd.sc.d), t)) * 10) / 10;
      t = p2RangeClamp(t, pd.sc.d);
      if (t !== pd.sc.t || !mkIsPlaced(pd.sc)) {
        pd.sc.t = t; pd.sc.placed = true;
        if (hit) { mkSetZoom(true, t); pd.zoomed = true; }
        renderMkTl(); paintKnob();
      }
      var n = Date.now();
      if (n - pd.lastSeek > 120 && playerReady()) { pd.lastSeek = n; playerSeek(t); if (playerState() !== 1) playerPlay(); }   /* v55: シークだけでは止まったままになるため、再生が止まっていたら再開する(旧スクラブ mkScrMove と同じ扱い) */
      /* v51: 指を止めたら(約320ms)、場所がどこでもその位置から再生して聞き直せる
         (スクラブの settle と同じ時間)。ドロップが有効なのはタイムライン上だけ、は変えない */
      if (pd.settle) clearTimeout(pd.settle);
      pd.settle = setTimeout(function () {
        if (placeDrag !== pd) return;
        if (playerReady()) { playerSeek(pd.sc.t); playerPlay(); }
      }, 320);
    }
    function endPlaceDrag(e) {
      var pd = placeDrag; placeDrag = null;
      if (!pd) return;
      if (pd.settle) clearTimeout(pd.settle);
      var box = document.getElementById("mkTlBox"); if (box) box.classList.remove("p2uni-tlhot");
      var hit = tlHit(e.clientX, e.clientY);
      if (hit) {
        var t = dragT(hit, e.clientX);
        if (t != null) {
          var D = Math.max(dur() || 0, 1);
          t = Math.round(Math.max(0, Math.min(Math.max(0, D - pd.sc.d), t)) * 10) / 10;
          pd.sc.t = p2RangeClamp(t, pd.sc.d); pd.sc.placed = true;
        }
      }
      if (pd.zoomed) mkSetZoom(false);
      pd.ghost.remove();
      if (hit) {
        mkSortScenes(); mkSel = mk.scenes.indexOf(pd.sc); renderMk();
        toast("「" + (pd.sc.x || LAB[pd.sc.k]) + "」を " + fmt(pd.sc.t) + " に置きました");
      } else {
        pd.sc.t = pd.origT; if (!pd.origPlaced) pd.sc.placed = false;
        renderMkTl(); paintKnob(); renderMk();
        toast("キャンセルしました");
      }
    }
    function cancelPlaceDrag() {
      if (!placeDrag) return;
      var pd = placeDrag; placeDrag = null;
      if (pd.settle) clearTimeout(pd.settle);
      var box = document.getElementById("mkTlBox"); if (box) box.classList.remove("p2uni-tlhot");
      if (pd.zoomed) mkSetZoom(false);
      pd.ghost.remove();
      pd.sc.t = pd.origT; if (!pd.origPlaced) pd.sc.placed = false;
      renderMk();
    }

    /* ---------- 一覧への委譲ハンドラ ---------- */
    var listEl = document.getElementById("mkList");
    var durHold = null;
    if (listEl) {
      listEl.addEventListener("pointerdown", function (e) {
        var pl = e.target && e.target.closest ? e.target.closest("[data-place]") : null;
        if (pl) { e.preventDefault(); startPlaceDrag(e, +pl.dataset.place, pl); return; }
        var z = e.target && e.target.closest ? e.target.closest('[data-zone="dur"]') : null;
        if (z) {
          var i = +z.dataset.i, sc = mk.scenes[i]; if (!sc) return;
          durHold = {i: i, sc: sc, at: Date.now(), active: false, span: z};
          try { z.setPointerCapture && z.setPointerCapture(e.pointerId); } catch (err) {}
        }
      });
      listEl.addEventListener("pointermove", function (e) { if (placeDrag) movePlaceDrag(e); });
      listEl.addEventListener("pointerup", function (e) {
        if (placeDrag) { endPlaceDrag(e); return; }
        if (durHold) {
          var held = (Date.now() - durHold.at) / 1000, dh = durHold; durHold = null;
          if (dh.active) {
            var d = Math.round(Math.max(0.5, Math.min(20, held)) * 10) / 10;
            if (mkIsPlaced(dh.sc)) d = Math.round(Math.max(0.5, p2RangeSpan(dh.sc.t, d)) * 10) / 10;
            dh.sc.d = d; board = null; renderMk();
            toast("長さを " + d + " 秒にしました");
          } else {
            openEditor(dh.i, "dur");
          }
        }
      });
      listEl.addEventListener("pointercancel", function () { durHold = null; cancelPlaceDrag(); });
      listEl.addEventListener("click", function (e) {
        var cp = e.target && e.target.closest ? e.target.closest("[data-copy]") : null;
        if (cp) { e.stopPropagation(); e.preventDefault(); uniCopy(+cp.dataset.copy); return; }
        var bok = e.target && e.target.closest ? e.target.closest("[data-bok]") : null;
        if (bok) { e.stopPropagation(); e.preventDefault(); applyBoard(); return; }
        var bx = e.target && e.target.closest ? e.target.closest("[data-bx]") : null;
        if (bx) { e.stopPropagation(); e.preventDefault(); board = null; renderMk(); return; }
        var adj = e.target && e.target.closest ? e.target.closest("[data-badj]") : null;
        if (adj) { e.stopPropagation(); e.preventDefault(); stepBoard(+adj.dataset.badj); return; }
        var z = e.target && e.target.closest ? e.target.closest("[data-zone]") : null;
        if (z && z.dataset.zone === "time") { e.stopPropagation(); e.preventDefault(); openEditor(+z.dataset.i, "pos"); return; }
        if (z && z.dataset.zone === "dur") { e.stopPropagation(); e.preventDefault(); return; }
        /* v51: ゾーン以外のカード面のタップは「選択だけ」。時刻・長さは上の分岐で処理済み、
           文言ゾーンは v48 側のハンドラが内容パネルを開くので、ここでは対象にしない */
        if (e.target && e.target.closest && e.target.closest("[data-zone]")) return;
        var pk = e.target && e.target.closest ? e.target.closest(".mkpick") : null;
        if (pk) {
          var card = pk.closest ? pk.closest(".mkcard") : null;
          if (card && card.dataset.ci != null) { e.stopPropagation(); e.preventDefault(); selectCardUni(+card.dataset.ci); }
        }
      });
      listEl.addEventListener("wheel", function (e) {
        var inp = e.target && e.target.closest ? e.target.closest(".p2uni-board-in") : null;
        if (!inp || !board) return;
        e.preventDefault();
        var v = parseFloat(inp.value); if (isNaN(v)) v = board.val;
        v = boardClamp(board.kind, v + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : 0.1), board.sc);
        board.val = v; inp.value = v.toFixed(1);
      }, {passive: false});
      listEl.addEventListener("input", function (e) {
        var inp = e.target && e.target.closest ? e.target.closest(".p2uni-board-in") : null;
        if (inp && board) { var v = parseFloat(inp.value); if (!isNaN(v)) board.val = v; }
      });
      setInterval(function () {
        if (!durHold) return;
        var held = (Date.now() - durHold.at) / 1000;
        if (held >= 0.25) {
          durHold.active = true;
          if (durHold.span) durHold.span.textContent = "長さ " + Math.max(0.5, Math.min(20, held)).toFixed(1) + "秒";
        }
      }, 100);
    }
    /* v55: 大きな編集カード(ポップアップ)から、お気に置くドラッグとコピーを使えるよう公開する。
       あわせて、ドラッグ中かどうかを本体 loop と範囲監視から見えるようにする(ドラッグ中に
       範囲の終わりで止めないための判定に使う) */
    window.__p2Uni49.startPlaceDrag = startPlaceDrag;
    window.__p2Uni49.movePlaceDrag = movePlaceDrag;
    window.__p2Uni49.endPlaceDrag = endPlaceDrag;
    window.__p2Uni49.cancelPlaceDrag = cancelPlaceDrag;
    window.__p2Uni49.copy = uniCopy;
    window.__p2Uni49.isPlacing = function () { return !!placeDrag; };
    window.__p2PlaceDragActive = function () { return !!placeDrag; };
    window.__p2Uni = {version: 49};
  } catch (e) { try { console.warn("p2Uni49", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v50: プレビュー連動と保存導線(段階3/3) =================
   - 作成を始めたら、右の付箋の一覧・タイムラインは作りかけのプレビューに切り替わる
   - 操作シートの右上にだけ「プレビュー ON/OFF」の小さい切替を置く(OFFで直前に見ていたコールへ戻る)
   - 作成に入る直前の再生状態(曲・コール・再生位置)を保持し、下書き保存/登録が完了したらそこへ戻す
   - 作成レイヤー最下部に「下書き保存」「この推しコールを登録」。既存の制作終了フローの保存経路につなぎ、
     完了後は A.save 側でカードが空になり、新規作成カードだけの初期状態に戻る(範囲もリセット)
   - サイトを離れようとした時だけ、作りかけがあれば beforeunload で離脱確認を出す
     (ブラウザ標準の確認ダイアログで、文面はブラウザ固定のものになる) */
(function p2Uni50() {
  try {
    var st = document.createElement("style"); st.id = "p2Uni50Styles";
    st.textContent = [
      "#p2UniPvToggle{position:absolute;top:4px;right:4px;z-index:6;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;border:1px solid #8e91b8;background:rgba(20,20,40,.55);color:#cfd2f2;cursor:pointer;font-family:inherit;opacity:.9}",
      "#p2UniPvToggle.off{opacity:.55}",
      "#p2UniSaveBar{order:99;display:flex;gap:10px;margin-top:8px}",
      "#p2UniSaveBar button{flex:1;height:48px;border-radius:24px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer}",
      "#p2UniSaveBar .p2uni-draft{background:none;border:2px solid #8e91b8;color:#cfd2f2}",
      "#p2UniSaveBar .p2uni-reg{background:#ffd23f;border:2px solid #ffd23f;color:#2a2410}"
    ].join("\n");
    document.head.appendChild(st);

    var session = false, snapshot = null, pvOn = true, lastSig = "__init__";
    var listBox = document.getElementById("playSceneList");
    var titleEl = listBox ? listBox.querySelector(".psl-title") : null;
    var origTitle = titleEl ? titleEl.textContent : null;

    window.__p2UniPreviewScenes = function () {
      if (!session || !pvOn) return null;
      try { return mkPlaybackScenes(mk.scenes); } catch (e) { return null; }
    };
    window.__p2UniPreviewList = function (box, items) {
      if (screen !== "play" || !session || !pvOn) return false;
      var scs = [];
      try { scs = mkPlaybackScenes(mk.scenes); } catch (e) {}
      var title = box.querySelector(".psl-title");
      if (title) title.textContent = "プレビュー(作りかけの推しコール)";
      if (!scs.length) {
        items.innerHTML = '<div style="font-size:12px;color:var(--mut);padding:6px 2px">まだ配置したカードがありません</div>';
      } else {
        items.innerHTML = scs.map(function (sc) {
          var label = String(sc.x || LAB[sc.k] || "コール").trim();
          return '<button type="button" class="psl-item p2uni-pv-item" data-t="' + sc.t + '"><span class="psl-time">' + esc(fmt(Math.max(0, +sc.t || 0))) + '</span><span class="psl-text">' + esc(label) + '</span></button>';
        }).join("");
      }
      box.classList.add("on");
      return true;
    };

    /* プレビュー項目タップで、その場面の6秒前へ(既存 playSceneJump と同じ) */
    var itemsEl = document.getElementById("playSceneItems");
    if (itemsEl) itemsEl.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".p2uni-pv-item") : null;
      if (!b) return;
      e.stopPropagation(); e.preventDefault();
      var t = parseFloat(b.dataset.t);
      if (playerReady() && !isNaN(t)) playerSeek(Math.max(0, t - 6));
    });

    /* 操作シート右上のプレビュー ON/OFF(切替はこの1箇所だけ) */
    var pvBtn = null;
    function paintPvToggle() {
      var ctrl = document.getElementById("p2LayerCtrl"); if (!ctrl) return;
      if (!pvBtn) {
        pvBtn = document.createElement("button"); pvBtn.type = "button"; pvBtn.id = "p2UniPvToggle";
        pvBtn.title = "作成中のプレビュー表示の切り替え";
        pvBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          pvOn = !pvOn; lastSig = "__changed__";
          if (!pvOn && titleEl && origTitle != null) titleEl.textContent = origTitle;
          paintPvToggle();
          try { paintPlaySceneList(); } catch (e) {}
        });
        ctrl.appendChild(pvBtn);
      }
      pvBtn.style.display = session ? "" : "none";
      pvBtn.textContent = pvOn ? "プレビュー ON" : "プレビュー OFF";
      pvBtn.classList.toggle("off", !pvOn);
    }

    /* 作成レイヤー最下部の保存ボタン2つ */
    function uniFinish(pub) {
      if (!mk.scenes.length) { toast("カードがありません"); return; }
      if (!pub && !me) { toast("ゲストは下書き保存できません。登録ならできます"); return; }
      if (!authStateReady) { pendingMkFinishOpen = true; toast("準備中です。少し待ってからもう一度押してください"); return; }
      mkFinishDraft = {step: -1, pub: null, name: "", title: "", versionName: "", note: ""};
      chooseMkFinish(pub);
    }
    var mkSec = document.getElementById("mk");
    if (mkSec) {
      var btnBar = document.createElement("div"); btnBar.id = "p2UniSaveBar";
      btnBar.innerHTML = '<button type="button" class="p2uni-draft">下書き保存</button><button type="button" class="p2uni-reg">この推しコールを登録</button>';
      btnBar.querySelector(".p2uni-draft").addEventListener("click", function () { uniFinish(false); });
      btnBar.querySelector(".p2uni-reg").addEventListener("click", function () { uniFinish(true); });
      mkSec.appendChild(btnBar);
    }

    function finishOpen() {
      var fo = document.getElementById("mkFinishOverlay");
      return !!(fo && fo.style.display === "flex");
    }
    function restoreSnapshot() {
      if (!snapshot) return;
      var snap = snapshot, changed = false;
      try {
        if (snap.si != null && SONGS[snap.si] && si !== snap.si) {
          si = snap.si; VID = SONGS[si].vid; UI.songSel(si); cueCurrentSong(); changed = true;
        }
        if (snap.act && act !== snap.act && calls.some(function (c) { return c.id === snap.act; })) {
          act = snap.act; applyAct(); changed = true;
        }
        render();
        if (playerReady() && snap.pos) playerSeek(snap.pos);
        if (changed) toast("作成の前に見ていたコールに戻りました");
      } catch (e) {}
    }
    function tick50() {
      var inMk = document.body.classList.contains("scr-mk");
      if (inMk && !session) {
        session = true; pvOn = true; lastSig = "__init__";
        var pos = 0; try { pos = playerReady() ? now() : 0; } catch (e) {}
        snapshot = {act: act, si: si, pos: pos};
      }
      if (session && !inMk && !mk.scenes.length && !finishOpen() && !mkFinishSaving) {
        restoreSnapshot();
        session = false; snapshot = null;
        try { paintPlaySceneList(); } catch (e) {}
        try { if (window.__p2Range && window.__p2Range.reset) window.__p2Range.reset(); } catch (e) {}
      }
      paintPvToggle();
      if (titleEl && origTitle != null && !(session && pvOn) && titleEl.textContent !== origTitle) titleEl.textContent = origTitle;
      if (screen === "play" && session) {
        var sig = pvOn + "|" + mk.scenes.map(function (s) { return s.t + "," + s.d + "," + s.k + "," + s.x; }).join("|");
        if (sig !== lastSig) { lastSig = sig; try { paintPlaySceneList(); } catch (e) {} }
      }
    }
    var mo = new MutationObserver(function () { tick50(); });
    mo.observe(document.body, {attributes: true, attributeFilter: ["class"]});
    setInterval(tick50, 500);
    tick50();

    /* 作りかけがあるままサイトを離れようとしたら確認(ブラウザ標準ダイアログ) */
    window.addEventListener("beforeunload", function (e) {
      if (mk.scenes && mk.scenes.length) { e.preventDefault(); e.returnValue = ""; }
    });

    window.__p2Uni = {version: 50};
    window.__p2Uni50 = { get session() { return session; }, get pvOn() { return pvOn; } };
  } catch (e) { try { console.warn("p2Uni50", e); } catch (err) {} }
})();

UI.songSel(si);
loadSongs();
checkSpHash();
$("dots").innerHTML = PEN.map((p, i) => `<button aria-label="${p[0]}" data-a="penColor" data-i="${i}" class="${i === 4 ? "sel" : ""}"><i style="background:${p[1]}"></i></button>`).join("");

/* ---------- 認証・登録 ---------- */
onAuthStateChanged(auth, async u => {
  me = u; prof = null;
  if (u) {
    const d = await getDoc(doc(db, "users", u.uid));
    if (d.exists()) prof = d.data(); else openSheet();   // 最初のログイン = ユーザー登録(推しはここで一度だけ決める)
  }
  authStateReady = true;
  if (pendingMkFinishOpen) { pendingMkFinishOpen = false; openMkFinish(); }
  paintLogin(); await loadCalls();
});
function paintLogin() {
  const b = $("login") || $("me");
  if (me && prof) b.outerHTML = `<button id="me" style="border-color:${colorOf(prof.oshi)}" aria-label="${esc(prof.nick)}" data-a="whoami">${UI.mic(prof.icon)}</button>`;
  else b.outerHTML = `<button class="pill" id="login" data-a="login">ログイン</button>`;
  $("mkbtn").style.display = "block";   // build 62: ゲスト(非ログイン)でも推しコールを作れる
  $("oshibtn").style.display = $("logout").style.display = me && prof ? "block" : "none";   // マイページ系はログイン時のみ
  const gn = $("mkGuestName"); if (gn) gn.style.display = me ? "none" : "block";   // ゲストの時だけ、保存時の名前入力欄を出す
  const tb = $("trybtn"); if (tb) tb.style.display = me ? "none" : "block";   // ゲスト/初めての訪問者だけ「作ってみる」入口を出す
  paintReviewBtn();
}
function openSheet(edit) {
  const sh = $("sheet").firstElementChild;
  sh.querySelectorAll("button").forEach(b => b.remove());
  sh.querySelector("h2").textContent = edit ? "推し・アイコンの変更" : "はじめての登録";
  $("nick").value = edit && prof ? prof.nick : "";
  $("mailNotify").checked = !(edit && prof && prof.mailNotify === false);
  $("pfPr").value = edit && prof ? (prof.pr || "") : "";
  pickI = edit && prof ? (prof.icon || 0) : 0; UI.sheetIcons(pickI);
  sh.insertAdjacentHTML("beforeend", OSHI.map((o, i) => `<button style="border-color:${o[1]}" data-a="register" data-i="${i}">${o[0]}</button>`).join("")
    + (edit ? '<button data-a="closeSheet" style="grid-column:1/3;border:2px solid #8e91b8">キャンセル</button>' : ""));
  $("sheet").style.display = "flex";
}

/* ---------- データ ---------- */
async function loadCalls() {
  try {
    const m = new Map();
    (await getDocs(query(collection(db, "calls"), where("videoId", "==", VID), where("public", "==", true)))).forEach(d => m.set(d.id, {id: d.id, ...d.data()}));
    liked = new Set();
    if (me) {
      (await getDocs(query(collection(db, "calls"), where("ownerUid", "==", me.uid)))).forEach(d => { if (d.data().videoId === VID) m.set(d.id, {id: d.id, ...d.data()}); });
      await Promise.all([...m.keys()].map(async id => { if ((await getDoc(doc(db, "calls", id, "hearts", me.uid))).exists()) liked.add(id); }));
    }
    calls = [...m.values()].sort((a, b) => (b.hearts || 0) - (a.hearts || 0));
  } catch (e) { toast("読み込めませんでした。通信を確認してください"); }
  let refApplied = false;
  if (!act && !randPlay) {   // 初期表示: その曲の参考コールがあれば、それを最初に表示する
    try {
      const snap = await getDocs(query(collection(db, "refs"), where("videoId", "==", VID)));
      if (!snap.empty) {
        const rs = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.draft !== true);
        rs.sort((a, b) => ((a.createdAt && a.createdAt.seconds) || 0) - ((b.createdAt && b.createdAt.seconds) || 0));
        if (rs.length) {
          refCalls = rs;
          /* プロトタイプ2 v51: 作成レイヤー表示中に曲を変えた時は、参考コールを自動適用しない
             (applyRef は作成画面を抜けてしまうため、作成の中で曲を選ぶと再生画面へ移ってしまう不具合の修正)。
             参考コールの一覧(refCalls)だけは従来どおり保持する */
          if (screen !== "mk") { applyRef(rs[0]); refApplied = true; }
        }
      }
    } catch (e) {}
  }
  if (!refApplied) {
    if (!calls.some(c => c.id === act)) act = calls[0] ? calls[0].id : null;
    applyAct();
  }
  render(); checkPending(true);
}
function applyRef(c) {
  if (screen === "mk") exitMk();   // プロトタイプ2: 作成画面から参考コール再生へ移る時は、作成画面を正しく抜ける(制作終了ボタンが残るバグ対策)
  wakuHold = null;
  refPlay = true; randPlay = false; act = null; curRef = c; sess = null; paintApply();
  EV = mkPlaybackScenes(c.scenes).map(x => ({...x})).sort((a, b) => a.t - b.t);
  $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">参考コール' + (c.versionName ? "<i>" + esc(c.versionName) + "</i>" : "") + "</div>";
  $("info").textContent = "";
  $("panelbody").innerHTML = "参考コールで再生中です";
  renderPEv();
  paintKanran();   // build 63: 参考コール表示でも観覧モードの状態表示を合わせる
}
function applyAct() {
  wakuHold = null;
  curRef = null;
  const c = calls.find(x => x.id === act);
  EV = c ? mkPlaybackScenes(c.scenes).map(x => ({...x, mine: !!me && c.ownerUid === me.uid})).sort((a, b) => a.t - b.t) : [];
  UI.who(SONGS[si].title, c ? c.ownerName : "", c ? c.versionName : "", isAuthorLinkable(c));   // build 63: ゲスト作のときは「この作者の他の推しコール」ボタンを出さない
  $("info").textContent = c ? "" : "まだ推しコールがありません。ログインして作ってみましょう";
  UI.total(calls.filter(x => x.public).reduce((n, x) => n + (x.used || 0), 0)); $("panelbody").innerHTML = UI.panel(c);
  if (act && act !== evFor) { evFor = act; if (!cmts[act]) loadCmts(act).then(() => renderPEv()); }
  renderPEv();
  /* build 63: 観覧モードはコールを切り替えても効き続ける。推しパートで未設定のコールに移ったら一度だけ知らせる */
  if (kanranMode && kanranMode.type === "oshi" && !randPlay) {
    if (c && !c.oshiPart && kanranOshiNotifiedFor !== c.id) { kanranOshiNotifiedFor = c.id; toast("このコールには推しパートが設定されていません"); }
    if (c && c.oshiPart) kanranOshiNotifiedFor = null;
  }
  paintKanran();
}

/* ---------- 一覧(一番上のレイヤー) ---------- */
function render() { $("list").innerHTML = UI.list(calls, {me, liked: me ? liked : guestLiked, openId, cmts, myNick: prof ? prof.nick : "", mySession}); renderPEv(); }
let pEvOpen = false, evFor = null;
/* プロトタイプ2 移植10: 再生画面のコールカード一覧。再生対象(EV)を時刻つきで並べ、タップで開始6秒前へシーク */
function paintPlaySceneList() {
  const box = $("playSceneList"), items = $("playSceneItems");
  if (!box || !items) return;
  if (window.__p2UniPreviewList && window.__p2UniPreviewList(box, items)) return;   /* プロトタイプ2 v50: 作成中は作りかけプレビュー */
  if (screen !== "play" || !Array.isArray(EV) || !EV.length) { box.classList.remove("on"); items.innerHTML = ""; return; }
  items.innerHTML = EV.map((sc, i) => {
    const label = String(sc.x || LAB[sc.k] || "コール").trim();
    return '<button type="button" class="psl-item" data-a="playSceneJump" data-i="' + i + '"><span class="psl-time">' + esc(fmt(Math.max(0, +sc.t || 0))) + '</span><span class="psl-text">' + esc(label) + '</span></button>';
  }).join("");
  box.classList.add("on");
}
function renderPEv() { paintPlaySceneList(); const el = $("pEv"); if (!el) return; const c = calls.find(x => x.id === act); if (c) { el.innerHTML = UI.evHtml(c, {me, liked: me ? liked : guestLiked, cmts, myNick: prof ? prof.nick : "", open: pEvOpen, mySession}); return; } if (refPlay && curRef) { el.innerHTML = '<div class="evBox"><div class="evBody"><button class="w" style="width:100%;height:44px;border-radius:12px" data-a="spOpenRef" data-i="' + curRef.id + '">シェアポイントを作る</button></div></div>'; return; } el.innerHTML = ""; }
/* ---------- 感想(承認制) ---------- */
async function loadCmts(id) {
  const c = calls.find(x => x.id === id); if (!c) return;
  try {
    const ap = (await getDocs(query(collection(db, "calls", id, "comments"), where("status", "==", "approved")))).docs.map(d => ({id: d.id, ...d.data()}));
    let pd = [];
    if (me && c.ownerUid === me.uid) pd = (await getDocs(query(collection(db, "calls", id, "comments"), where("ownerUid", "==", me.uid)))).docs.map(d => ({id: d.id, ...d.data()})).filter(m => m.status === "pending");
    ap.sort((a, b) => ((a.at && a.at.seconds) || 0) - ((b.at && b.at.seconds) || 0));
    cmts[id] = {approved: ap, pending: pd};
  } catch (e) {}
}
async function checkPending(openPopup) {
  if (!me || !prof) { pendAll = []; paintReviewBtn(); return; }
  const mine = calls.filter(c => c.ownerUid === me.uid);
  const all = [];
  for (const c of mine) {
    try {
      const snap = await getDocs(query(collection(db, "calls", c.id, "comments"), where("ownerUid", "==", me.uid)));
      snap.forEach(d => { const m = {id: d.id, callId: c.id, ver: c.versionName || "", songTitle: SONGS[si].title, ...d.data()}; if (m.status === "pending") all.push(m); });
    } catch (e) {}
  }
  pendAll = all; paintReviewBtn();
  const ids = new Set(all.map(m => m.callId + "|" + m.id));
  const hasNew = [...ids].some(x => !pendKnown.has(x));
  pendKnown = ids;
  if (openPopup && hasNew && all.length) { renderReview(); $("cmov").style.display = "block"; }
}
let myPend = [];
async function openUserPage(uid) {
  const rep = calls.find(c => c.ownerUid === uid);
  if (!rep) return;
  let p = {nick: rep.ownerName, oshi: rep.oshi, icon: rep.ownerIcon || 0, pr: ""};
  $("upBody").innerHTML = '<div class="cmtNone">読み込み中…</div>';
  $("userpage").style.display = "block";
  if (me) { try { const d = await getDoc(doc(db, "users", uid)); if (d.exists()) { const u = d.data(); p = {nick: u.nick, oshi: u.oshi, icon: u.icon || 0, pr: u.pr || ""}; } } catch (e) {} }
  let mine = [];
  try {
    const snap = await getDocs(query(collection(db, "calls"), where("ownerUid", "==", uid), where("public", "==", true)));
    snap.forEach(d => { const c = {id: d.id, ...d.data()}; const s = SONGS.find(x => x.vid === c.videoId); c.songTitle = s ? s.title : ""; mine.push(c); });
  } catch (e) {}
  mine.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  $("upBody").innerHTML = UI.userPage({prof: p, calls: mine});
}

async function loadMyPage() {
  const el = $("myBody"); if (!el || !me || !prof) return;
  el.innerHTML = '<div class="cmtNone">読み込み中…</div>';
  let mine = [];
  try { mine = (await getDocs(query(collection(db, "calls"), where("ownerUid", "==", me.uid)))).docs.map(d => ({id: d.id, ...d.data()})); } catch (e) {}
  mine.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  myPend = [];
  for (const c of mine) {
    try { const cs = await getDocs(query(collection(db, "calls", c.id, "comments"), where("ownerUid", "==", me.uid))); cs.forEach(d => { const m = {id: d.id, callId: c.id, ...d.data()}; if (m.status === "pending") myPend.push(m); }); } catch (e) {}
  }
  const sTitle = vid => { const s2 = SONGS.find(x => x.vid === vid); return s2 ? s2.title : "不明な曲"; };
  let msgs = [];
  try { msgs = (await getDocs(query(collection(db, "messages"), where("toUid", "==", me.uid)))).docs.map(d => ({id: d.id, ...d.data()})); } catch (e) {}
  msgs.sort((x, y) => ((y.at && y.at.seconds) || 0) - ((x.at && x.at.seconds) || 0));
  let notes = [];
  try { notes = (await getDocs(query(collection(db, "bbsNotes"), where("toUid", "==", me.uid)))).docs.map(d => ({id: d.id, ...d.data()})); } catch (e) {}
  notes.sort((x, y) => ((y.at && y.at.seconds) || 0) - ((x.at && x.at.seconds) || 0));
  let sps = [];
  try { sps = (await getDocs(query(collection(db, "spPoints"), where("uid", "==", me.uid)))).docs.map(d => ({id: d.id, ...d.data()})); } catch (e) {}
  sps.sort((x, y) => ((y.at && y.at.seconds) || 0) - ((x.at && x.at.seconds) || 0));
  mySps = sps;
  el.innerHTML = UI.myPage({prof: prof, calls: mine.map(c => ({...c, songTitle: sTitle(c.videoId)})), pend: myPend, msgs: msgs, notes: notes, sps: sps});
}
function paintReviewBtn() { const b = $("reviewBtn"); if (!b) return; const show = !!(me && prof && pendAll.length); b.style.display = show ? "block" : "none"; b.textContent = "感想の承認待ち(" + pendAll.length + "件)"; }
function renderReview() {
  const el = $("cmList"); if (!el) return;
  el.innerHTML = pendAll.map(m => '<div class="cmt"><b>' + esc(m.name) + '</b><span>' + esc(m.text) + '</span><span class="cmtSub">' + esc(m.songTitle) + (m.ver ? " 「" + esc(m.ver) + "」" : "") + '</span><span class="cmtBtns"><button data-a="cmtOk" data-i="' + m.callId + '|' + m.id + '">公開する</button><button data-a="cmtNg" data-i="' + m.callId + '|' + m.id + '">公開しない</button></span></div>').join("") || '<div class="cmtNone">承認待ちの感想はありません</div>';
}
setInterval(() => { if (me && prof) checkPending(true); }, 60000);


/* ---------- 作成(build 58: 再生画面のまま切り替える制作モード) ---------- */
/* ---------- 作成(build 59: 画面切り替え式の作成画面。プレイヤーは移動しない) ---------- */
/* プロトタイプ2 移植1: 未配置カード(placed:false / t:null)。再生系には出さず、一覧では配置済みと分けて出す */
function mkIsPlaced(sc) { return !!sc && sc.placed !== false && sc.t !== null && sc.t !== undefined && Number.isFinite(Number(sc.t)); }
function mkPlaybackScenes(scenes) { return (scenes || []).filter(mkIsPlaced); }
function mkSortScenes() {
  mk.scenes.sort((a, b) => {
    const ap = mkIsPlaced(a), bp = mkIsPlaced(b);
    if (ap !== bp) return ap ? -1 : 1;
    if (!ap) return 0;
    return Number(a.t) - Number(b.t);
  });
}
function mkCardsHtml(scenes, sel) {
  if (window.__p2UniCards) return window.__p2UniCards(scenes, sel);   // プロトタイプ2 v48: 統合UIのカード一覧描画へ委譲
  if (!scenes.length) return '<div style="font-size:12px;color:var(--mut);padding:8px 2px">まだカードがありません。カード作成ボタンから内容を作成できます。</div>';
  const entries = scenes.map((e, i) => ({e, i}));
  const placed = entries.filter(o => mkIsPlaced(o.e));
  const unplaced = entries.filter(o => !mkIsPlaced(o.e));
  const card = o => {
    const e = o.e, i = o.i, isPlaced = mkIsPlaced(e);
    return '<div class="mkcard' + (i === sel ? " sel" : "") + (!isPlaced ? " mkcard-unplaced" : "") + '">'
      + '<button class="mkpick" data-a="mkPick" data-i="' + i + '">'
      + '<span class="mkt">' + (isPlaced ? fmt(e.t) : "未配置") + '</span><span class="mkk">' + LAB[e.k] + '</span><span class="mkx">' + esc(e.x) + '</span><span class="mkd">' + (isPlaced ? e.d + "秒" : "まだ置いていません") + '</span></button>'
      + '<button class="mkdel" aria-label="削除" data-a="delScene" data-i="' + i + '">×</button></div>';
  };
  return (placed.length ? '<div style="font-size:11px;color:var(--mut);padding:5px 2px 2px">配置済み（曲時間順）</div>' + placed.map(card).join("") : "")
    + (unplaced.length ? '<div style="font-size:11px;color:var(--mut);padding:8px 2px 2px">未配置（作成順）</div>' + unplaced.map(card).join("") : "");
}
/* プロトタイプ2 移植2(見た目のみ): 共通パネルの開閉とステップ切替だけ。カードへの反映は次の段階でつなぐ */
let mkCpStep = 1, mkCpType = "call", mkCpTarget = null;
function paintMkContentPanel() {
  const t = $("mkContentTextStep"), y = $("mkContentTypeStep");
  if (t) t.style.display = mkCpStep === 1 ? "block" : "none";
  if (y) y.style.display = mkCpStep === 2 ? "block" : "none";
  document.querySelectorAll("#mkContentPanel [data-a='mkContentChoose']").forEach(b => b.classList.toggle("sel", b.dataset.i === mkCpType));
}
function openMkContentPanel(target) {
  const p = $("mkContentPanel"); if (!p) return;
  mkCpStep = 1;
  mkCpTarget = target || null;
  const inp = $("mkContentTextInput");
  if (inp) inp.value = mkCpTarget ? mkCpTarget.x : $("mkText").value;
  mkCpType = mkCpTarget ? mkCpTarget.k : mk.type;
  paintMkContentPanel();
  p.style.display = "flex";
}
function closeMkContentPanel() { const p = $("mkContentPanel"); if (p) p.style.display = "none"; }
/* プロトタイプ2 移植4: 制作を終了フロー。選択→4段階入力→A.save で保存し、再生画面へ戻る。保存失敗時は備考ステップへ戻して再試行可、保存は20秒で見切る */
const MK_FINISH_FIELDS = [
  {key:"name", prompt:"あなたのお名前は？", max:20, placeholder:"お名前"},
  {key:"title", prompt:"推しコールのタイトル？", max:40, placeholder:"推しコールのタイトル"},
  {key:"versionName", prompt:"バージョン名は？", max:20, placeholder:"バージョン名"},
  {key:"note", prompt:"備考は？", max:100, placeholder:"備考（任意）"}
];
let mkFinishDraft = null;
let mkFinishSaving = false;   // プロトタイプ2 移植4: 保存の二重実行防止
function setMkFinishError(msg) {
  const el = $("mkFinishError");
  if (!el) { if (msg) toast(msg, 4000); return; }
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}
function paintMkFinishStep() {
  if (!mkFinishDraft) return;
  const field = MK_FINISH_FIELDS[mkFinishDraft.step];
  const overlay = $("mkFinishOverlay"), prompt = $("mkFinishPrompt"), input = $("mkFinishInput");
  const actions = $("mkFinishActions"), choices = $("mkFinishChoices");
  if (!field || !overlay || !prompt || !input || !actions || !choices) return;
  setMkFinishError("");
  prompt.textContent = field.prompt;
  input.maxLength = field.max;
  input.placeholder = field.placeholder;
  input.value = String(mkFinishDraft[field.key] || "");
  input.style.display = "block";
  actions.style.display = "flex";
  choices.style.display = "none";
  overlay.style.display = "flex";
}
function paintMkFinishStart() {
  if (!mkFinishDraft) return;
  const overlay = $("mkFinishOverlay"), prompt = $("mkFinishPrompt"), input = $("mkFinishInput");
  const actions = $("mkFinishActions"), choices = $("mkFinishChoices");
  const draftButton = $("mkFinishDraftSave");
  if (!overlay || !prompt || !input || !actions || !choices) return;
  setMkFinishError("");
  prompt.textContent = "制作を終了しますか？";
  input.style.display = "none";
  actions.style.display = "none";
  choices.style.display = "flex";
  if (draftButton) draftButton.style.display = me ? "" : "none";
  overlay.style.display = "flex";
}
function openMkFinish() {
  if (screen !== "mk" || mkFinishSaving) return;
  if (!authStateReady) { pendingMkFinishOpen = true; return; }   // 認証状態が確定するまで開かない(下書きボタンの出し分けが誤らないように)
  mkFinishDraft = {step:-1, pub:null, name:"", title:"", versionName:"", note:""};
  paintMkFinishStart();
}
function chooseMkFinish(pub) {
  if (!mkFinishDraft || mkFinishSaving || (!me && !pub)) return;
  mkFinishDraft.pub = !!pub;
  mkFinishDraft.step = 0;
  paintMkFinishStep();
}
function cancelMkFinish() {
  if (mkFinishSaving) return;
  const overlay = $("mkFinishOverlay");
  if (overlay) overlay.style.display = "none";
  mkFinishDraft = null;
}
function finishMkWithoutSave() { guideEvent("cancel");
  if (!mkFinishDraft || mkFinishSaving) return;
  const overlay = $("mkFinishOverlay");
  if (overlay) overlay.style.display = "none";
  mkFinishDraft = null;
  exitMk();
}
function advanceMkFinish() {
  if (!mkFinishDraft || mkFinishSaving) return;
  try {
    if (mkFinishDraft.step >= MK_FINISH_FIELDS.length) { saveMkFinish(); return; }   // 終端で詰んでも「決定」で保存を再試行できる
    const field = MK_FINISH_FIELDS[mkFinishDraft.step], input = $("mkFinishInput");
    if (!field || !input) return;
    mkFinishDraft[field.key] = String(input.value == null ? "" : input.value).trim();
    if (field.key === "name" && !(me && prof) && !mkFinishDraft.name) { toast("お名前を入力してください"); setMkFinishError("お名前を入力してください"); return; }
    if (field.key === "versionName" && me && prof && calls.some(c => c.ownerUid === me.uid) && !mkFinishDraft.versionName) { toast("2つ目以降はバージョン名を入れてください"); setMkFinishError("2つ目以降はバージョン名を入れてください"); return; }
    if (mkFinishDraft.step < MK_FINISH_FIELDS.length - 1) { mkFinishDraft.step++; paintMkFinishStep(); return; }
    mkFinishDraft.step = MK_FINISH_FIELDS.length;
    saveMkFinish();
  } catch (e) {
    toast("入力を進められませんでした。もう一度お試しください");
    setMkFinishError("入力を進められませんでした。もう一度お試しください");
  }
}
function failMkFinish(msg) {
  // 保存に失敗したら終端(step=全項目数)のままにせず、最後の入力(備考)へ戻して再試行できるようにする。入力内容は保持する
  if (!mkFinishDraft) return;
  mkFinishDraft.step = MK_FINISH_FIELDS.length - 1;
  paintMkFinishStep();
  setMkFinishError(msg);
}
async function saveMkFinish() {
  if (!mkFinishDraft || mkFinishDraft.step !== MK_FINISH_FIELDS.length || typeof mkFinishDraft.pub !== "boolean" || mkFinishSaving) return;
  if (!mk.scenes.length) { toast("カードを作成してください"); failMkFinish("カードを作成してください"); return; }
  const publish = mkFinishDraft.pub;
  if (!me && !publish) { toast("ゲストは下書き保存できません"); failMkFinish("ゲストは下書き保存できません"); return; }
  const meta = {name:mkFinishDraft.name, title:mkFinishDraft.title, versionName:mkFinishDraft.versionName, note:mkFinishDraft.note};
  mkFinishSaving = true;
  const buttons = ["mkFinishDraftSave", "mkFinishRegister", "mkFinishNoSave", "mkFinishChoiceCancel"].map(id => $(id)).filter(Boolean);
  buttons.forEach(b => { b.disabled = true; });
  try {
    // 保存応答が返らないまま全操作が塞がり続けないよう、20秒で見切ってロックを解除する
    const saved = await Promise.race([
      A.save(publish ? "1" : "0", meta),
      new Promise((_, reject) => setTimeout(() => reject(new Error("mkFinishTimeout")), 20000))
    ]);
    if (!saved || saved === true) { failMkFinish("保存できませんでした。入力内容は残っています。「決定」でもう一度保存できます。"); return; }
    const overlay = $("mkFinishOverlay");
    if (overlay) overlay.style.display = "none";
    mkFinishDraft = null;
    exitMk();
    refPlay = false; randPlay = false; spRange = null; sess = null;
    act = saved.id;
    try { await loadCalls(); } catch (e) {}
    if (!calls.some(c => c.id === saved.id)) calls.unshift(saved.record);
    act = saved.id;
    try { applyAct(); render(); } catch (e) {}
    alert(publish ? "推しコールが登録されました" : "下書き保存されました");
  } catch (e) {
    if (e && e.message === "mkFinishTimeout") {
      toast("保存の確認ができませんでした。通信を確認してもう一度お試しください");
      failMkFinish("保存の確認ができませんでした。入力内容は残っています。通信を確認して「決定」でもう一度保存できます。");
    } else {
      toast("保存処理でエラーが発生しました。制作内容を確認して、もう一度お試しください");
      failMkFinish("保存処理でエラーが発生しました。入力内容は残っています。「決定」でもう一度保存できます。");
    }
  } finally {
    mkFinishSaving = false;
    if (mkFinishDraft) buttons.forEach(b => { b.disabled = false; });
  }
}
function renderMk() { $("mkList").innerHTML = mkCardsHtml(mk.scenes, mkSel); paintMkBtn(); paintPlaceBtn(); paintKnob(); paintPosEdit(); renderMkTl(); applyGuide(); }
function paintPvBtn() { const b = $("mkPvBtn"); if (b) b.textContent = mkPv ? "プレビューを止める" : "プレビュー"; }
/* 画面切替: プレイヤー(#mvwrap・iframe)はDOM上で一切動かさず、他のUIの表示/非表示だけで切り替える */
function setScreen(name) {
  screen = name;
  document.body.classList.toggle("scr-mk", name === "mk");
  document.body.classList.toggle("scr-sp", name === "sp");
  $("mk").style.display = name === "mk" ? "flex" : "none";
  $("spPanel").style.display = name === "sp" ? "flex" : "none";
  if (name !== "mk") paintKnob();
}
/* プロトタイプ2 移植3: お気に置きモードで未配置カードを選ぶと、大きな再生ボタンが「置きに行く」に変わって光る */
function paintPlaceBtn() {
  const b = $("play"); if (!b) return;
  const placing = screen === "mk" && mkMode === "oki";
  if (!placing) {
    b.dataset.a = "play"; b.disabled = false;
    b.classList.remove("place-ready", "place-idle");
    b.setAttribute("aria-label", "再生");
    return;
  }
  const sc = mkSel >= 0 ? mk.scenes[mkSel] : null;
  const ready = !!sc && !mkIsPlaced(sc);
  b.dataset.a = "place"; b.textContent = "置きに行く"; b.disabled = !ready; b.classList.remove("meas");
  b.classList.toggle("place-ready", ready); b.classList.toggle("place-idle", !ready);
  b.setAttribute("aria-label", ready ? "選択したカードをタイムラインに置く" : "未配置カードを選択してください");
}
function paintMkPub() { const b = $("mkPubBtn"); if (b) b.textContent = mkPub ? "公開で保存" : "下書きで保存"; }
/* プロトタイプ2: 大きなボタンは常に「カード作成」専用(長さは長押しの時間でのみ決まる) */
function paintMkBtn() {
  const b = $("mkCreate"); if (!b) return;
  const hint = $("mkHint");
  const ed = $("mkEdit"); if (ed) ed.style.display = (mkSel >= 0 && mk.scenes[mkSel]) ? "flex" : "none";
  b.classList.remove("go", "edit");
  b.textContent = "カード作成";
  if (hint) hint.textContent = "再生しながらタップすると5秒のカード、長押しすると押している長さのカードができます(0.5〜20秒)。止まっている時は今の位置にできます。できたカードをタップすると中身や長さを直せます。";
  paintMkPub();
}
/* 選択中カードの帯とつまみをシークバー上に描く(作成画面で選択中だけ表示) */
const MK_KCOL = {call: "#ff5c8a", sing: "#2ec4b6", koko: "#ff9f1c"};
function paintKnob() {
  const band = $("mkBand"), kn = $("mkKnob"); if (!band || !kn) return;
  const sc = (screen === "mk" && mkSel >= 0) ? mk.scenes[mkSel] : null;
  if (!sc) { band.style.display = "none"; kn.style.display = "none"; return; }
  const D = Math.max(dur() || 0, +($("bar").max || 0), 1);
  const col = MK_KCOL[sc.k] || "#ff5c8a";
  band.style.display = "block"; band.style.left = (sc.t / D * 100) + "%"; band.style.width = Math.max(sc.d / D * 100, 1.5) + "%"; band.style.background = col + "55";
  kn.style.display = "block"; kn.style.left = (sc.t / D * 100) + "%"; kn.style.background = col;
  const bub = $("mkBub"); if (bub) bub.textContent = fmt(sc.t);
}
/* プロトタイプ2 移植8: モード別7秒案内。案内カードを出し、対象を点滅させて7秒で消す */
let mkOnboardTimer = null;
function clearMkOnboard() {
  if (mkOnboardTimer !== null) { clearTimeout(mkOnboardTimer); mkOnboardTimer = null; }
  document.querySelectorAll(".mk-onboard-blink").forEach(el => el.classList.remove("mk-onboard-blink"));
  const hint = $("mkOnboardHint"); if (hint) { hint.textContent = ""; hint.style.display = "none"; }
}
function showMkOnboard(message, targetId) {
  if (guide) return;
  clearMkOnboard();
  const hint = $("mkOnboardHint"), target = $(targetId);
  if (!hint || !target) return;
  hint.textContent = message;
  hint.style.display = "block";
  target.classList.add("mk-onboard-blink");
  mkOnboardTimer = setTimeout(clearMkOnboard, 7000);
}
/* プロトタイプ2: 作り方の流れカード(計3枚)。入口の1枚は初めて作成画面を開いたときだけ、モード別の1枚はそのモードを初めて選んだときだけ自動で出す。閉じたら印を付けて次回からは出さない */
let mkFlowView = "intro", mkFlowAuto = null;
const MK_FLOW_KEYS = {intro: "momo_p2_flow_seen", nori: "momo_p2_flow_nori", oki: "momo_p2_flow_oki"};
function paintMkFlow() {
  document.querySelectorAll(".mkflow-page").forEach(el => { el.style.display = el.dataset.flow === mkFlowView ? "block" : "none"; });
}
function openMkFlow(view, auto) {
  const ov = $("mkFlowOverlay"); if (!ov) return;
  mkFlowView = view || "intro";
  mkFlowAuto = auto ? mkFlowView : null;
  clearMkOnboard();
  paintMkFlow();
  ov.classList.add("on");
}
function closeMkFlow() {
  const ov = $("mkFlowOverlay"); if (ov) ov.classList.remove("on");
  if (mkFlowAuto) { try { localStorage.setItem(MK_FLOW_KEYS[mkFlowAuto], "1"); } catch (e) {} mkFlowAuto = null; }
}
function mkFlowSeen(view) { try { return !!localStorage.getItem(MK_FLOW_KEYS[view]); } catch (e) { return false; } }
function maybeShowMkFlow() { if (!mkFlowSeen("intro")) openMkFlow("intro", true); }
function maybeShowModeFlow(m) { if (guide) return; if (!mkFlowSeen(m)) openMkFlow(m, true); }
function enterMk() {
  mkReturnScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  spStep = 0; paintSpStep();
  setScreen("mk");
  const mnIn = $("menu"); if (mnIn) { mnIn.style.display = "none"; document.body.classList.remove("menu-open"); }   // プロトタイプ2: 右上のサブメニューを閉じてから入る
  const drwIn = $("mkDrawer"); if (drwIn) drwIn.classList.remove("open");   // プロトタイプ2: 作成画面に入る時は引き出しも閉じた状態から始める
  const drwBarIn = $("mkDrawerBar"); if (drwBarIn) drwBarIn.setAttribute("aria-expanded", "false");
  showMkOnboard("作成モードを選択", "mkDrawerBar");
  maybeShowMkFlow();
  applyRate();
  paintMkMode();
  renderMk();
  loadPresets();
  const gn = $("mkGuestName"); if (gn) gn.style.display = me ? "none" : "block";
  $("mvwrap").scrollIntoView({behavior: "smooth"});
}
function exitMk() {
  clearMkOnboard();
  setScreen("play");
  const drw = $("mkDrawer"); if (drw) drw.classList.remove("open");
  mkSel = -1; mkLenPhase = null; mkSelOrigT = null; mkSetZoom(false);
  if (mkMeas !== null) { mkMeas = null; const b = $("mkMeas"); if (b) b.textContent = "▶ 再生して表示時間を測る"; }
  const pb = $("play"); if (pb) pb.classList.remove("meas");
  const restoreY = mkReturnScrollY; mkReturnScrollY = null;
  if (restoreY !== null) {
    // enterMk() のsmooth scrollが残っていても、プレイ画面の元位置を優先して復元する
    const root = document.documentElement;
    const prevScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, restoreY);
    requestAnimationFrame(() => {
      window.scrollTo(0, restoreY);
      root.style.scrollBehavior = prevScrollBehavior;
    });
  }
}
function enterSp() {
  setScreen("sp");
  spStep = 0; paintSpStep();
  applyRate();
  $("mvwrap").scrollIntoView({behavior: "smooth"});
}
/* 再生速度(1 → 0.5 → 0.25)を YouTube プレイヤーへ実際に効かせる */
function applyRate() { try { if (yt && yt.setPlaybackRate) yt.setPlaybackRate(mkRate); } catch (e) {} paintRate(); }
function paintRate() { document.querySelectorAll(".ratebtn").forEach(b => b.textContent = "速度 " + mkRate + "倍"); const rs = $("mkRateSelect"); if (rs) rs.value = String(mkRate); }

/* ---------- build 60: プリセットコール(作成画面下部の引き出しから、選択中カードへ種類+文言を適用) ---------- */
async function loadPresets() {
  try {
    const snap = await getDocs(collection(db, "presets"));
    PRESETS = snap.docs.map(d => ({id: d.id, ...d.data()}));
    PRESETS.sort((a, b) => ((a.order == null ? 1e9 : a.order) - (b.order == null ? 1e9 : b.order)) || (((a.at && a.at.seconds) || 0) - ((b.at && b.at.seconds) || 0)));
  } catch (e) { PRESETS = []; }
  psLoaded = true;
  paintPsList();
}
function paintPsList() { const el = $("psList"); if (el) el.innerHTML = UI.psChips(PRESETS); paintMkChips(); applyGuide(); }

/* ---------- build 64: 2モード制の表示切替 ---------- */
const MKMODE_DESC = {
  nori: "曲を聞きながら作るモードです。コールを口で言っている間だけ大きな丸ボタンを長押しすると、離した長さでカードが打てます。中身（種類・文言）は後から入れられます。",
  oki: "文言を先に用意してから置きに行くモードです。プリセットを選ぶか文字を書いておいて、掴んで左右に動かすと、その位置の音を頼りに置く場所を探れます。再生ボタンを押していなくても、掴んで動かし始めるとその位置の音が自動で流れます。指を止めると、その位置からの音が流れるので、聞いて確かめてから離してください。離した位置にカードが置けて、長さは後から変えられます。"
};
const MKMODE_TLNOTE = {
  nori: "長押ししている間だけ、タイムラインが2つ出ます。こちらは曲全体で、画面中央に出る拡大タイムライン（15秒・1秒ごとの目盛り）で細かい位置が分かります。打ったカードの開始〜終了も表示されます。",
  oki: "掴んで動かしている間だけ、タイムラインが2つ出ます。こちらは曲全体で、画面中央に出る拡大タイムライン（15秒・1秒ごとの目盛り）で細かい位置が分かります。指の横の位置が、そのまま曲の位置になります。"
};
function paintMkMode() {
  document.querySelectorAll("#mkModeTabs .mktab").forEach(b => b.classList.toggle("sel", b.dataset.mkmode === mkMode));
  const nori = mkMode === "nori";
  document.querySelectorAll("#mk .mknori").forEach(el => { el.style.display = nori ? "" : "none"; });
  document.querySelectorAll("#mk .mkoki").forEach(el => { el.style.display = nori ? "none" : ""; });
  const d = $("mkModeDesc"); if (d) d.textContent = MKMODE_DESC[mkMode];
  const n = $("mkTlNote"); if (n) n.textContent = MKMODE_TLNOTE[mkMode];
}
function setMkMode(m) {
  if (m !== "nori" && m !== "oki") return;
  mkMode = m;
  try { localStorage.setItem("momo_mkmode", m); } catch (e) {}
  paintMkMode(); paintPlaceBtn();
  const drw = $("mkDrawer"); if (drw) drw.classList.remove("open");
  const drwBar = $("mkDrawerBar"); if (drwBar) drwBar.setAttribute("aria-expanded", "false");
  showMkOnboard(m === "nori" ? "曲に合わせて叫ぶコールの間押す" : "まずはコールカードを作成", m === "nori" ? "play" : "mkCreate");
  guideEvent("mode");
  maybeShowModeFlow(m);
}

/* ---------- build 64: 選択中カードの位置編集パネルと、種類・文言の適用先の表示 ---------- */
function paintPosEdit() {
  const box = $("mkPosEdit"); if (!box) return;
  const sc = (mkSel >= 0 && mk.scenes[mkSel]) ? mk.scenes[mkSel] : null;
  const note = $("mkApplyNote");
  if (note) note.textContent = sc
    ? "いま選択中のカード「" + (sc.x || LAB[sc.k]) + "」を編集中です。種類ボタン・文言の入力・プリセットは、このカードに適用されます。"
    : "種類・文言は、次に作るカードのものになります。作ったカードを選ぶと、選んだカードの書き換えに使えます。";
  if (!sc) { box.style.display = "none"; return; }
  box.style.display = "flex";
  $("mkPosTitle").textContent = "選択中: " + LAB[sc.k] + "「" + sc.x + "」";
  $("mkPosTime").textContent = mkIsPlaced(sc) ? fmt(sc.t) + "〜" + fmt(sc.t + sc.d) : "未配置";
}

/* ---------- build 64: 作成画面のタイムライン(通常は曲全体。ドラッグ中/長押し中は現在位置を中心に約30秒へ拡大し、画面下部に浮かせて出し続ける。元の位置にはプレースホルダを残す) ---------- */
const MK_TL_KINDS = ["call", "sing", "koko"];
let mkTlZoom = false, mkTlCenter = 0, mkTlLastD = 0, mkTlPh = null;
function mkTlD() { return Math.max(1, dur() || 240); }
/* プロトタイプ2 v53: 制作タイムライン通常表示の主軸。表示(renderMkTl / mkTlApplyView / 打ち込みプレビュー)と
   操作変換(mkBandAbs / mkScrAbs / つまみドラッグ / お気に置くドラッグ)は、必ずこの同じ軸を使う。
   範囲を絞っている間は、絞った範囲 [a, b] を帯の横幅いっぱいに割り当てる(絞った幅の中で相対的に
   位置を選べるようにするため)。絞っていなければ曲全体 [0, D]。拡大表示(15秒窓)は別の軸で従来どおり */
let mkTlLastAxis = "";
function mkTlAxis() {
  const d = mkTlD();
  try {
    const R = window.__p2Range && window.__p2Range.get();
    if (R && R.depth > 0 && R.b > R.a) return { a: R.a, span: R.b - R.a, ranged: true };
  } catch (e) {}
  return { a: 0, span: d, ranged: false };
}
function mkTlWin() {
  const d = mkTlD();
  if (!mkTlZoom) return {a: 0, span: d};
  const span = Math.min(30, d);
  let a = mkTlCenter - span / 2;
  a = Math.max(0, Math.min(Math.max(0, d - span), a));
  return {a: a, span: span};
}
/* プロトタイプ2: 拡大タイムライン用の窓(15秒)。mkTlCenterを中心にし、端では寄せて収める */
function mkTlWin15() {
  const d = mkTlD();
  const span = Math.min(15, d);
  let a = mkTlCenter - span / 2;
  a = Math.max(0, Math.min(Math.max(0, d - span), a));
  return {a: a, span: span};
}
function renderMkTl() {
  const inner = $("mkTlInner"); if (!inner) return;
  const d = mkTlD();
  const ax = mkTlAxis();
  /* v53: バーは2つの軸で描く。通常表示(#mkTlInner)は主軸(絞り中は範囲を全幅)、
     拡大表示(#mkTlZoomInner)は曲全体軸のまま(15秒窓で切り取って見せるため) */
  const barsFor = (baseA, baseSpan) => {
    let h = "";
    MK_TL_KINDS.forEach(k => {
      const bars = mk.scenes.filter(s => mkIsPlaced(s) && s.k === k).map(s => {
        const l = (s.t - baseA) / baseSpan * 100, w = Math.max(0.8, s.d / baseSpan * 100), idx = mk.scenes.indexOf(s), sel2 = idx === mkSel;
        return '<div class="mktl-bar mb-' + k + (sel2 ? " selb2" : "") + '" data-mksel="' + idx + '" style="left:' + l + '%;width:' + w + '%" title="' + fmt(s.t) + "〜" + fmt(s.t + s.d) + " " + LAB[k] + " " + esc(s.x) + '"><span>' + fmt(s.t) + "〜" + fmt(s.t + s.d) + " " + esc(s.x) + "</span></div>";
      }).join("");
      h += '<div class="mktl-lane">' + bars + "</div>";
    });
    return h;
  };
  const barsHtml = barsFor(0, d);
  const barsMain = barsFor(ax.a, ax.span);
  let ticksFull = "";
  const steps = [5, 10, 15, 20, 30, 60]; let step = 60;
  for (let si2 = 0; si2 < steps.length; si2++) { if (ax.span / steps[si2] <= 14) { step = steps[si2]; break; } }
  for (let t2 = Math.ceil(ax.a / step) * step; t2 <= ax.a + ax.span + 0.001; t2 += step) {
    const l3 = (t2 - ax.a) / ax.span * 100;
    ticksFull += '<div class="mktl-tick big" style="left:' + l3 + '%"></div><span class="mktl-tlab" style="left:' + l3 + '%">' + fmt(t2) + "</span>";
  }
  let ticksZoom = "";
  for (let t = 0; t <= d; t += 1) {
    const big = t % 5 === 0, l2 = t / d * 100;
    ticksZoom += '<div class="mktl-tick' + (big ? " big" : "") + '" style="left:' + l2 + '%"></div>' + (big ? '<span class="mktl-tlab" style="left:' + l2 + '%">' + fmt(t) + "</span>" : "");
  }
  inner.innerHTML = barsMain + '<div class="mktl-ticks">' + ticksFull + "</div>";
  const zinner = $("mkTlZoomInner");
  if (zinner) zinner.innerHTML = barsHtml + '<div class="mktl-ticks">' + ticksZoom + "</div>";
  const md = $("mkTlMode"); if (md) md.textContent = ax.ranged ? "範囲表示" : "全体表示";
  mkTlApplyView();
}
function mkTlApplyView() {
  const inner = $("mkTlInner"); if (!inner) return;
  const d = mkTlD();
  const t = now() || 0;
  inner.style.width = "100%";
  inner.style.transform = "translateX(0%)";
  const ax = mkTlAxis();   /* v53: 再生線・つまみの位置も主軸で描く(表示と変換を一致させる) */
  const pl = $("mkTlPlay");
  if (pl) { const p = (t - ax.a) / ax.span * 100; if (p >= 0 && p <= 100) { pl.style.display = "block"; pl.style.left = p + "%"; } else pl.style.display = "none"; }
  const pos = $("mkTlPos"); if (pos) pos.textContent = "現在 " + fmt(t);
  const kn = $("mkTlKnob");
  if (kn) {
    const sc = (mkSel >= 0 && mk.scenes[mkSel]) ? mk.scenes[mkSel] : null;
    if (sc && mkIsPlaced(sc)) {
      const kp = (sc.t - ax.a) / ax.span * 100;
      if (kp >= 0 && kp <= 100) { kn.style.display = "block"; kn.style.left = kp + "%"; kn.setAttribute("aria-valuenow", Math.round(sc.t)); } else kn.style.display = "none";
    } else kn.style.display = "none";
  }
  const zinner = $("mkTlZoomInner");
  if (zinner) {
    const w = mkTlWin15();
    zinner.style.width = (d / w.span * 100) + "%";
    zinner.style.transform = "translateX(" + (-(w.a / d * 100)) + "%)";
    const zp = $("mkTlZoomPlay");
    if (zp) { const p2 = (t - w.a) / w.span * 100; if (p2 >= 0 && p2 <= 100) { zp.style.display = "block"; zp.style.left = p2 + "%"; } else zp.style.display = "none"; }
    const zpos = $("mkTlZoomPos"); if (zpos) zpos.textContent = "表示範囲 " + fmt(w.a) + "〜" + fmt(w.a + w.span);
  }
}
function mkTlSetFloat(on) {
  const box = $("mkTlBox"); if (!box) return;
  if (on) {
    if (!mkTlPh) { mkTlPh = document.createElement("div"); mkTlPh.setAttribute("aria-hidden", "true"); mkTlPh.style.height = box.offsetHeight + "px"; box.parentNode.insertBefore(mkTlPh, box); }
    box.classList.add("tlfloat");
  } else {
    box.classList.remove("tlfloat");
    if (mkTlPh) { mkTlPh.remove(); mkTlPh = null; }
  }
}
function mkSetZoom(on, c) {
  if (c != null) mkTlCenter = c;
  if (on === mkTlZoom) { if (on) mkTlApplyView(); return; }
  mkTlZoom = on;
  document.body.classList.toggle("mk-tl-on", on);
  renderMkTl();
}

/* ---------- build 64: シーク連動スクラブ(お気に置きにいっちゃうモードの「置きに行く」操作と、選択中カードの位置探りで共用)。
   指の絶対位置対応: 画面幅より少し狭い帯に曲全体を割り当て、指の横位置そのものが曲の位置になる。
   デッドゾーン(手ブレ抑制: 小さい動きは無視)と、反応の鈍さ(絶対位置への追従速度)で操作感を調整できる ---------- */
/* プロトタイプ2 v47: 制作範囲を絞っている間は、ドラッグスクラブや打ち込みで決まる位置も
   v44の範囲内に閉じる(絞っていない時は素通しで従来通り)。本体は v44 ブロックの __p2Range が持つ */
function p2RangeClamp(t, tail) {
  try { const R = window.__p2Range; if (R && R.clamp) return R.clamp(t, tail); } catch (e) {}
  return t;
}
function p2RangeSpan(t, d) {
  try { const R = window.__p2Range; if (R && R.span) return R.span(t, d); } catch (e) {}
  return d;
}
function mkBandAbs(clientX) {
  const W = window.innerWidth || 360;
  const m = Math.max(10, Math.round(W * 0.04));
  const width = Math.max(50, W - m * 2);
  let r = (clientX - m) / width;
  r = Math.max(0, Math.min(1, r));
  const ax = mkTlAxis();   /* v53: 割り当てる区間を表示と同じ主軸にする(絞り中は範囲) */
  return ax.a + r * ax.span;
}
/* プロトタイプ2: 置きに行くドラッグ専用の指位置→時刻。タイムラインの帯の左端=主軸の始点、右端=主軸の終点として、指の横位置そのままを時刻にする */
function mkScrAbs(clientX, src) {
  if (src && src.fromPlaceButton) {
    const vw = $("mkTlSlide");   /* v53: バーが実際に描かれる帯そのものを使う(従来はラベル列52pxを含む mkTlView で、その分だけずれていた) */
    if (vw) { const rc = vw.getBoundingClientRect(); if (rc.width > 10) { const ax = mkTlAxis(); return ax.a + Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * ax.span; } }
  }
  return mkBandAbs(clientX);
}
let mkGhost = null;
function mkGhostEl() { if (!mkGhost) { mkGhost = document.createElement("div"); mkGhost.id = "dragGhost"; document.body.appendChild(mkGhost); } return mkGhost; }
function mkShowGhost(e, src, t) {
  const g = mkGhostEl();
  g.innerHTML = "";
  g.appendChild(document.createTextNode(src.x || LAB[src.k]));
  const sm = document.createElement("small");
  sm.textContent = fmt(t) + " に置く";
  g.appendChild(sm);
  g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px";
  g.classList.add("on");
}
function mkMoveGhost(e, t) { const g = mkGhost; if (!g) return; g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px"; const sm = g.querySelector("small"); if (sm) sm.textContent = fmt(t) + " に置く"; }
function mkScrStart(e, src, el) {
  e.preventDefault();
  try { el.setPointerCapture(e.pointerId); } catch (err) {}
  mkScrSt = {pid: e.pointerId, x0: e.clientX, anchorX: e.clientX, seek0: now() || 0, target: now() || 0, lastSeek: null, active: false, src: src, settle: null, lastX: e.clientX, lastY: e.clientY};
}
function mkScrMove(e) {
  const scr = mkScrSt; if (!scr || e.pointerId !== scr.pid) return;
  const dead = mkTune.dead;
  if (!scr.active) {
    if (Math.abs(e.clientX - scr.x0) <= dead) return;
    scr.active = true; scr.anchorX = e.clientX;
    mkSetZoom(true, scr.seek0);
    mkShowGhost(e, scr.src, scr.seek0);
    if (playerReady()) playerPlay();   // 再生を押していなくても、掴んで動かし始めるとその位置の音がプレビューで流れる
  } else if (Math.abs(e.clientX - scr.anchorX) <= dead) { return; }   // 手ブレ抑制: 前回位置を更新した地点から dead(px) 未満の動きは無視
  else { scr.anchorX = e.clientX; if (scr.src.fromPlaceButton) scr.moved = true; }   // プロトタイプ2 移植3: 置きに行くは「動かした」ことの記録
  const absT = mkScrAbs(e.clientX, scr.src);
  const g = mkTune.gain;
  let target = scr.src.fromPlaceButton ? absT : (g >= 1 ? absT : scr.target + (absT - scr.target) * g);   // 置きに行くは指と1対1。それ以外は反応の鈍さ: gain が小さいほど、再生位置は指の絶対位置へゆっくり近づく
  target = Math.max(0, Math.min(mkTlD(), target));
  target = p2RangeClamp(target);   // v47: 絞った範囲の外へはドラッグで動かさない
  scr.target = target; mkTlCenter = target; mkTlApplyView();
  mkMoveGhost(e, target);
  if (scr.lastSeek === null || Math.abs(target - scr.lastSeek) >= 0.15) { scr.lastSeek = target; playerSeek(Math.round(target * 10) / 10); if (playerReady() && playerState() !== 1) playerPlay(); }   // プロトタイプ2: ドラッグ中に何かの理由で止まっても、指の動きで再開する
  scr.lastX = e.clientX; scr.lastY = e.clientY;
  if (scr.settle) clearTimeout(scr.settle);
  scr.settle = setTimeout(() => {   // 指を止めたら(約320ms)、指の絶対位置から再生して聞き直せる
    if (!mkScrSt || !mkScrSt.active) return;
    const t = p2RangeClamp(Math.max(0, Math.min(mkTlD(), Math.round(mkScrAbs(mkScrSt.lastX, mkScrSt.src) * 10) / 10)));
    mkScrSt.target = t; mkScrSt.lastSeek = t; mkTlCenter = t; mkTlApplyView();
    mkMoveGhost({clientX: mkScrSt.lastX, clientY: mkScrSt.lastY}, t);
    playerSeek(t); if (playerReady()) playerPlay();
  }, 320);
}
function mkScrEnd(commit, upX) {
  const sc = mkScrSt; if (!sc) return;
  mkScrSt = null;
  if (sc.settle) clearTimeout(sc.settle);
  if (mkGhost) mkGhost.classList.remove("on", "round");
  if (sc.active) {
    mkSetZoom(false);
    if (sc.src.fromPlaceButton && !sc.moved) return;   // プロトタイプ2 移植3: ただのタップでは配置しない
    if (commit) {
      if (upX != null) sc.target = mkScrAbs(upX, sc.src);
      const t = p2RangeClamp(Math.max(0, Math.min(mkTlD() - 0.5, Math.round(sc.target * 10) / 10)), 0.5);   // v47: 配置位置も範囲内に閉じる
      if (sc.src.scene && mk.scenes.includes(sc.src.scene)) {   // プロトタイプ2 移植3: 未配置カードそのものを配置する
        const target = sc.src.scene;
        target.t = t; target.placed = true;
        mkSortScenes(); mkSel = mk.scenes.indexOf(target); mkSelOrigT = target.t;
        renderMk();
        if (playerReady()) { playerSeek(t); playerPlay(); }
        toast("「" + (target.x || LAB[target.k]) + "」を " + fmt(t) + " に配置しました");
      } else {
      const nc = {t: t, d: 5, placed: true, k: sc.src.k, x: sc.src.x};   // 置いたカードの長さは仮の5秒(本番の作り方に合わせる。後から長さ指定で直せる)
      mk.scenes.push(nc); mkSortScenes();
      if (sc.src.grip) $("mkText").value = "";
      renderMk();
      toast("「" + (nc.x || LAB[nc.k]) + "」を " + fmt(t) + " に置きました");
      }
      guideEvent("drop");
    }
    return;
  }
  if (commit && sc.src.chip) {   // チップのただのタップ(ドラッグしなかった)
    if (mkSel >= 0 && mk.scenes[mkSel]) {
      const sel = mk.scenes[mkSel];
      sel.k = sc.src.k; sel.x = sc.src.x; mk.type = sc.src.k;
      document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === sc.src.k));
      $("mkText").value = sc.src.x;
      renderMk();
      toast("選択中のカードにプリセット「" + sc.src.x + "」を適用しました");
      guideEvent("text");
      return;
    }
    $("mkText").value = sc.src.x;
    if (mk.type !== sc.src.k) { mk.type = sc.src.k; document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === sc.src.k)); }
    toast("プリセット「" + sc.src.x + "」を入力しました。チップを押さえて左右に動かすと、その位置に置けます");
    guideEvent("text");
  }
}
function mkBindScr(el, srcFn, isChip) {
  el.addEventListener("pointerdown", e => mkScrStart(e, srcFn(), el));
  el.addEventListener("pointermove", mkScrMove);
  el.addEventListener("pointerup", e => mkScrEnd(true, e.clientX));
  el.addEventListener("pointercancel", () => mkScrEnd(false));
  el.addEventListener("contextmenu", e => e.preventDefault());
  if (isChip) el.dataset.chip = "1";
}
/* お気に置きにいっちゃうモードのプリセットチップ(引き出しの psChips とは別に、掴んでドラッグできるチップを描く) */
function paintMkChips() {
  const box = $("mkChips"); if (!box) return;
  box.innerHTML = "";
  if (!PRESETS.length) { box.innerHTML = '<div class="psNone">プリセットはまだ登録されていません（管理画面で登録できます）</div>'; return; }
  PRESETS.forEach(p => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pchip"; b.textContent = p.x;
    b.setAttribute("aria-label", "プリセット " + p.x + "（押さえて左右に動かすと、その位置に置けます）");
    box.appendChild(b);
    mkBindScr(b, () => ({k: p.k, x: p.x, chip: true}), true);
  });
}
/* 操作感の調整パネルの表示(手ブレ抑制は言葉のみで出し、px値は利用者に出さない) */
function paintTune() {
  const g = $("tuneGain"), d = $("tuneDead"); if (!g || !d) return;
  g.value = mkTune.gain; d.value = mkTune.dead;
  $("tuneGainVal").textContent = mkTune.gain.toFixed(2) + "倍";
  $("tuneDeadVal").textContent = mkTune.dead <= 8 ? "弱い" : mkTune.dead <= 14 ? "やや弱い" : mkTune.dead <= 20 ? "ふつう" : mkTune.dead <= 26 ? "やや強い" : "強い";
}

/* ---------- build 50: 湧きリアクション演出(画面の振動・再生中コール連動のはみ出しバッジ・紙吹雪) ---------- */
let impactTm = null;
/* build 59: 激湧きモード(ONの間だけ、湧くたびに画面全体へ放射状の光。状態はメモリのみで保存しない) */
let gekiOn = false, gekiTm = null;
function paintGekiBtn() {
  const b = $("gekibtn"); if (!b) return;
  b.classList.toggle("on", gekiOn);
  b.setAttribute("aria-pressed", gekiOn ? "true" : "false");
  const s = b.querySelector(".gkstate"); if (s) s.textContent = gekiOn ? "ON" : "OFF";
}
function gekiFx() {
  const w = $("mvwrap"), g = $("geki"); if (!w || !g) return;
  const r = w.getBoundingClientRect();
  g.style.setProperty("--gx", Math.round(r.left + r.width / 2) + "px");
  g.style.setProperty("--gy", Math.round(r.top + r.height / 2) + "px");
  g.querySelectorAll(".gspk").forEach(x => x.remove());
  const emo = ["✨", "⭐", "🌟", "💫"];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "gspk"; s.textContent = emo[i % emo.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.top = Math.random() * 100 + "vh";
    s.style.fontSize = (14 + Math.random() * 16) + "px";
    s.style.animationDelay = (Math.random() * 0.3) + "s";
    g.appendChild(s);
  }
  g.style.display = "block"; g.classList.remove("on"); void g.offsetWidth; g.classList.add("on");
  clearTimeout(gekiTm); gekiTm = setTimeout(() => { g.style.display = "none"; g.classList.remove("on"); }, 1450);
}
function wakuFx(text) {
  const mv = $("mv");
  mv.classList.remove("shake-anim"); void mv.offsetWidth; mv.classList.add("shake-anim");
  const im = $("impact");
  im.textContent = text || "＼ 湧く! ／";
  im.style.display = "block"; im.classList.remove("pop"); void im.offsetWidth; im.classList.add("pop");
  clearTimeout(impactTm); impactTm = setTimeout(() => { im.style.display = "none"; }, 950);
  const fx = $("wfx"), emo = ["✨", "⭐", "🎉", "🌸", "💖"], cols = ["#ff7ab8", "#ffd23f", "#4dc9ff", "#ff8c42", "#9dff57"];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.className = "cfetti";
    const paper = i % 3 === 2;
    if (paper) { s.style.width = s.style.height = (6 + Math.random() * 6) + "px"; s.style.background = cols[i % cols.length]; s.style.borderRadius = "2px"; }
    else { s.textContent = emo[i % emo.length]; s.style.fontSize = (14 + Math.random() * 12) + "px"; }
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDelay = (Math.random() * 0.35) + "s";
    fx.appendChild(s);
    setTimeout(() => s.remove(), 2700);
  }
  if (gekiOn) gekiFx();   // build 59: 激湧きモードONの時だけ追加演出
}

/* ---------- 湧きのスコア(再生を始めてから10分だけ数える。反映は今回の数で上書き。初回は自動で反映) ---------- */
const isMine = () => { const c = calls.find(x => x.id === act); return !!c && !!me && c.ownerUid === me.uid; };
function sessFor() { if (!sess || sess.id !== act) sess = {id: act, t0: 0, n: 0, prev: null, first: true, ready: null, tm: 0}; return sess; }
async function loadPrev(q) {
  if (!me || !prof) return;
  try { const d = await getDoc(doc(db, "calls", q.id, "waku", me.uid)); if (d.exists()) { q.prev = d.data().n; q.first = false; } } catch (e) {}
}
function paintApply() {
  const q = sess, b = $("applybtn"), show = !!q && q.n > 0 && !q.first && q.n !== q.prev;
  b.style.display = show ? "block" : "none";
  if (show) b.textContent = `今回の湧き ${q.n}回を反映(過去の記録: ${q.prev}回)`;
}
async function saveWaku(q) {
  if (!me || !prof) return;
  const old = q.prev || 0, c = calls.find(x => x.id === q.id);
  try {
    const b = writeBatch(db);
    b.set(doc(db, "calls", q.id, "waku", me.uid), {n: q.n, at: serverTimestamp()});
    b.update(doc(db, "calls", q.id), {used: increment(q.n - old)});
    await b.commit();
    if (c) c.used = (c.used || 0) + q.n - old;
    q.prev = q.n; paintApply(); applyAct(); render();
    toast("今回の湧きを反映しました");
  } catch (e) { toast("反映できませんでした"); }
}

/* ---------- 操作 ---------- */
const guard = () => (me && prof) || (toast("ログインすると使えます"), false);
async function writeCmt(id, np, tp) {
  const c = calls.find(x => x.id === id); if (!c) return;
  const nEl = $(np + id), tEl = $(tp + id); if (!nEl || !tEl) return;
  const name = (nEl.value || "").trim(), text = (tEl.value || "").trim();
  if (!name) return toast("ニックネームを入れてください");
  if (!text) return toast("感想を書いてください");
  try {
    const cref = await addDoc(collection(db, "calls", id, "comments"), {name: name.slice(0, 20), text: text.slice(0, 200), status: "pending", uid: me ? me.uid : null, ownerUid: c.ownerUid, at: serverTimestamp()});
    try { await addDoc(collection(db, "notifications"), {callId: id, ownerUid: c.ownerUid, kind: "comment", at: serverTimestamp()}); } catch (e) {}
    tEl.value = "";
    if (c.ownerUid == null) {
      /* build 62: ゲストのコールは承認者がいないため、そのまま公開する(ルール側で guest コールの status 変更だけ開放) */
      try { await updateDoc(cref, {status: "approved"}); } catch (e) {}
      await loadCmts(id); render();
      toast("感想を投稿しました");
    } else {
      toast("感想を送りました。作者の承認後に公開されます");
      if (me && c.ownerUid === me.uid) { await loadCmts(id); await checkPending(false); render(); }
    }
  } catch (e) { toast("感想を送れませんでした"); }
}

let introTm = [];
function clearIntroTm() { introTm.forEach(clearTimeout); introTm = []; }
function runIntro() {
  const el = $("intro"), cnt = $("inCount"), fl = $("inFlash"), im = $("inImg");
  clearIntroTm();
  el.classList.remove("whiteout"); el.style.transition = ""; el.style.opacity = "1"; el.style.display = "block";
  fl.style.opacity = "0"; cnt.style.display = "flex";
  ["3", "2", "1"].forEach((n, i) => introTm.push(setTimeout(() => { cnt.textContent = n; cnt.classList.remove("tick"); void cnt.offsetWidth; cnt.classList.add("tick"); }, i * 1000)));
  introTm.push(setTimeout(() => { cnt.style.display = "none"; el.classList.add("whiteout"); }, 3000));
  introTm.push(setTimeout(() => { playerPlay(); el.style.transition = "opacity .35s"; el.style.opacity = "0"; }, 6900));
  introTm.push(setTimeout(() => { el.style.display = "none"; el.classList.remove("whiteout"); el.style.transition = ""; clearIntroTm(); }, 7300));
}
function skipIntro() { clearIntroTm(); const el = $("intro"); el.style.display = "none"; el.classList.remove("whiteout"); playerPlay(); }
/* ---------- build 63: 観覧モード(指定パート / 推しパート) ----------
   指定パート: 観る人が決めた1つの範囲を全コール共通で効かせる(メモリのみで持ち、コールを切り替えても解除するまで効き続ける)。
   推しパート: コールごとの oshiPart {a,b} を効かせる(作成側の指定は今後の機能。今は読み取りだけ)。
   範囲の効かせ方は共通で kanranRange() が返す。Firestoreの変更は要らない(oshiPart は calls の既存フィールドとして読むだけ)。 */
let kanranMode = null;   // null=通常観覧 / {type:"spec", a, b} / {type:"oshi"}
let ksEdit = {a: 0, b: 30};   // 指定パートの範囲指定(シート内での編集中の値)
let kanranEndAt = 0, kanranOshiNotifiedFor = null;
function kanranRange() {
  if (!kanranMode || randPlay) return null;
  if (kanranMode.type === "spec") return {a: kanranMode.a, b: kanranMode.b};
  const c = calls.find(x => x.id === act);
  if (c && c.oshiPart && c.oshiPart.b > c.oshiPart.a) return {a: +c.oshiPart.a || 0, b: +c.oshiPart.b || 0};
  return null;
}
function paintKsSpecVals() { $("ksStartVal").textContent = fmt(+$("ksStart").value); $("ksEndVal").textContent = fmt(+$("ksEnd").value); }
function renderKsSpec() {
  const D = Math.max(10, Math.ceil(dur() || 240));
  const sEl = $("ksStart"), eEl = $("ksEnd");
  if (!sEl || !eEl) return;
  sEl.max = D; eEl.max = D; sEl.value = ksEdit.a; eEl.value = ksEdit.b;
  paintKsSpecVals();
}
$("ksStart").addEventListener("input", () => { ksEdit.a = +$("ksStart").value; if (ksEdit.b <= ksEdit.a) { ksEdit.b = ksEdit.a + 1; $("ksEnd").value = ksEdit.b; } paintKsSpecVals(); });
$("ksEnd").addEventListener("input", () => { ksEdit.b = +$("ksEnd").value; if (ksEdit.b <= ksEdit.a) { ksEdit.a = Math.max(0, ksEdit.b - 1); $("ksStart").value = ksEdit.a; } paintKsSpecVals(); });
function paintKanran() {
  const b = $("kanranbtn"); if (!b) return;
  const st = $("ksStatus");
  b.classList.toggle("on", !!kanranMode);
  const si2 = $("ksSpecItem"), oi = $("ksOshiItem");
  if (si2) si2.classList.toggle("sel", !!kanranMode && kanranMode.type === "spec");
  if (oi) oi.classList.toggle("sel", !!kanranMode && kanranMode.type === "oshi");
  if (!kanranMode) {
    b.innerHTML = "観覧<br>モード";
    if (st) st.innerHTML = "いまは<b>通常観覧</b>です";
    return;
  }
  if (kanranMode.type === "spec") {
    b.innerHTML = "指定パート<br>観覧中";
    if (st) st.innerHTML = "<b>指定パート</b>で観覧中: " + fmt(kanranMode.a) + " 〜 " + fmt(kanranMode.b) + "（どのコールでもこの範囲だけ観ます）";
    return;
  }
  b.innerHTML = "推しパート<br>観覧中";
  const kr = kanranRange(), c = calls.find(x => x.id === act);
  if (st) st.innerHTML = kr
    ? "<b>推しパート</b>で観覧中: このコールは " + fmt(kr.a) + " 〜 " + fmt(kr.b) + " だけ観ます"
    : "<b>推しパート</b>で観覧中: " + (c ? "このコールには推しパートが設定されていません" : "コールを選ぶと、そのコールの推しパートだけ観ます");
}
/* 観覧モードの範囲の始点から再生する(オープニング演出が出ているときは先に飛ばす) */
function kanranPlayFrom(a) {
  if ($("intro").style.display === "block") skipIntro();
  playerSeek(a); playerPlay();
}
/* ---------- build 63: この作者の他の推しコール ---------- */
const isGuestCall = c => !c || !c.ownerUid;   // ゲストのコールは ownerUid が null で紐づけできないため対象外
const isAuthorLinkable = c => !isGuestCall(c);
let authorTargetUid = null, authorListCache = [];
async function authorCallsOf(uid) {
  if (!uid) return [];
  let rows = [];
  try { rows = (await getDocs(query(collection(db, "calls"), where("ownerUid", "==", uid), where("public", "==", true)))).docs.map(d => ({id: d.id, ...d.data()})); }
  catch (e) { return []; }
  if (me && me.uid === uid) {   // 自分の下書きも一覧に出す(openUserPage と同じ扱い)
    try { (await getDocs(query(collection(db, "calls"), where("ownerUid", "==", uid)))).forEach(d => { if (!rows.some(r => r.id === d.id)) rows.push({id: d.id, ...d.data()}); }); } catch (e) {}
  }
  const order = c => { const i = SONGS.findIndex(x => x.vid === c.videoId); return i < 0 ? 99 : i; };
  return rows.sort((a, b) => (order(a) - order(b)) || ((b.hearts || 0) - (a.hearts || 0)));
}
async function renderAuthorSheet() {
  const head = $("authorHead"), box = $("authorList"); if (!head || !box) return;
  const list = authorListCache;
  const name = list.length ? list[0].ownerName : "";
  head.innerHTML = list.length
    ? "<b>" + esc(name) + "さんの推しコール</b><br>今の曲だけでなく、全ての曲から " + list.length + " 件あります。選ぶと、そのコールに切り替えて再生できます。"
    : "この作者の公開コールは、他にまだありません。";
  box.innerHTML = list.length ? list.map(c => {
    const cur = c.id === act, song = SONGS.find(s => s.vid === c.videoId);
    return '<div class="authorItem' + (cur ? " cur" : "") + '">'
      + '<div class="asong">♪ ' + esc(song ? song.title : "曲名不明") + "</div>"
      + '<div class="atitle">' + esc(c.ownerName) + "さんの推しコール" + (c.versionName ? '<span class="tag">' + esc(c.versionName) + "</span>" : "") + (c.public ? "" : '<span class="tag">下書き</span>') + "</div>"
      + '<div class="ameta">♥ ' + (c.hearts || 0) + " / 湧き " + (c.used || 0) + "回 ・ 場面 " + ((c.scenes || []).length) + "個" + (cur ? " ・ 再生中" : "") + "</div>"
      + (cur
        ? '<button class="aplay curbtn" data-a="authorClose">再生中です</button>'
        : '<button class="aplay" data-a="authorPlay" data-i="' + c.id + '">これで再生</button>')
      + "</div>";
  }).join("") : '<div class="authorEmpty">この作者の公開コールは、他にまだありません。</div>';
}
async function openAuthorSheet() {
  const c = calls.find(x => x.id === act);
  if (!c) return toast("まず推しコールを選んでください");
  if (isGuestCall(c)) return toast("ゲストが作ったコールは、作者の一覧を表示できません");
  authorTargetUid = c.ownerUid;
  $("authorHead").innerHTML = "読み込み中…"; $("authorList").innerHTML = "";
  $("authorSheet").classList.add("on");
  authorListCache = await authorCallsOf(authorTargetUid);
  renderAuthorSheet();
}
/* ---------- build 63: シェアの一本化 ----------
   入口は既存の「シェアポイントを作る」ボタンに一本化し、押すと範囲設定へ直行せず、今の観覧状態に応じた選択肢シートをまず出す。
   ガイド中は選択肢を出さず従来どおり直行する(モックと同じ扱い)。 */
let shChoiceTarget = null;   // {id, ref}
function openShareChoice(target) { shChoiceTarget = target; paintShareChoice(); $("shareChoiceSheet").classList.add("on"); }
function paintShareChoice() {
  const note = $("shChoiceNote"), btns = $("shChoiceBtns"); if (!note || !btns) return;
  const t = shChoiceTarget; if (!t) return;
  const c = t.ref ? (refCalls.find(x => x.id === t.id) || (curRef && curRef.id === t.id ? curRef : null)) : calls.find(x => x.id === t.id);
  const nm = t.ref ? ("参考コール" + (c && c.versionName ? "「" + esc(c.versionName) + "」" : "")) : (c ? esc(c.ownerName) + "さんの推しコール" : "推しコール");
  if (kanranMode && kanranMode.type === "spec") {
    note.innerHTML = "<b>指定パート</b>で観覧中（" + fmt(kanranMode.a) + " 〜 " + fmt(kanranMode.b) + "）です。" + nm + "をどうシェアしますか?";
    btns.innerHTML = '<button class="ksitem" data-a="shChoiceWhole">この指定パート全体をシェア<span aria-hidden="true">›</span></button>'
      + '<button class="ksitem" data-a="shChoiceRange">さらに絞る<span aria-hidden="true">›</span></button>';
  } else if (kanranMode && kanranMode.type === "oshi") {
    const op = c && c.oshiPart && c.oshiPart.b > c.oshiPart.a ? c.oshiPart : null;
    note.innerHTML = op
      ? "<b>推しパート</b>で観覧中（" + fmt(op.a) + " 〜 " + fmt(op.b) + "）です。" + nm + "をどうシェアしますか?"
      : "<b>推しパート</b>で観覧中ですが、このコールには推しパートが設定されていません。";
    btns.innerHTML = '<button class="ksitem" data-a="shChoiceWhole">この推しパートをシェア<span aria-hidden="true">›</span></button>'
      + '<button class="ksitem" data-a="shChoiceRange">さらに絞る<span aria-hidden="true">›</span></button>';
  } else {
    note.innerHTML = nm + "をどうシェアしますか?";
    btns.innerHTML = '<button class="ksitem" data-a="shChoiceFull">フルでシェア<span aria-hidden="true">›</span></button>'
      + '<button class="ksitem" data-a="shChoiceRange">シェアポイント範囲を設定<span aria-hidden="true">›</span></button>';
  }
}
/* ---------- シェアポイント ---------- */
const SPBASE = "https://go-apsp.github.io/momoclo-call/";
function spLink(id, a, b) { return SPBASE + "#sp=" + id + "&a=" + (+a).toFixed(1) + "&b=" + (+b).toFixed(1); }
function srLink(id, a, b) { return SPBASE + "#sr=" + id + "&a=" + (+a).toFixed(1) + "&b=" + (+b).toFixed(1); }
function spLinkFor(s) { return String(s.callId || "").indexOf("ref:") === 0 ? srLink(s.callId.slice(4), s.a, s.b) : spLink(s.callId, s.a, s.b); }
function spVals() { return {a: +$("spA").value, b: +$("spB").value}; }
/* build 58: シェアポイント作成モードの細長いボタンの段階表示(始点 → 終点 → 作成) */
function paintSpStep() { const b = $("spStep"); if (b) b.textContent = ["ここを始点にする", "ここを終点にする", "シェアポイントを作成"][spStep] || "ここを始点にする"; }
function paintSpVals() { const v = spVals(); $("spAv").textContent = fmt(v.a); $("spBv").textContent = fmt(v.b); }
function openSpPanel(id, preset, autoCreate) {
  spRef = null;
  const c = calls.find(x => x.id === id); if (!c) return;
  if (act !== id) { act = id; refPlay = false; randPlay = false; spRange = null; sess = null; paintApply(); applyAct(); render(); }
  A.closeOv();
  spEdit = id;
  $("spFor").textContent = "♪ " + SONGS[si].title + " / " + c.ownerName + "さんの推しコール" + (c.versionName ? " 「" + c.versionName + "」" : "");
  const D = Math.max(dur(), 1), t0 = Math.min(now() || rangeStart(), D);
  const A0 = Math.max(rangeStart(), Math.floor(t0));
  $("spA").max = D; $("spB").max = D;
  $("spA").value = A0; $("spB").value = Math.min(D, A0 + 30);
  paintSpVals();
  if (preset) {   // build 63: シェアの選択肢シートから渡された範囲を初期値にする
    $("spA").value = Math.max(0, Math.min(preset.a, D)); $("spB").value = Math.max(+$("spA").value + 0.5, Math.min(preset.b, D)); paintSpVals();
  }
  $("spResult").innerHTML = (me && prof) ? "" : '<div class="spLink">ログインしていないため、このシェアポイントは保存されません（リンクのコピーとシェアはできます）</div>';
  enterSp();
  if (autoCreate) createSp();   // build 63: 「フルでシェア」「この指定パート全体をシェア」は、そのままリンク作成まで進む
}
function openSpPanelRef(id, preset, autoCreate) {
  const c = refCalls.find(x => x.id === id) || (curRef && curRef.id === id ? curRef : null);
  if (!c) return toast("参考コールが見つかりませんでした");
  applyRef(c);
  A.closeRef(); A.closeOv();
  spEdit = null; spRef = c;
  $("spFor").textContent = "♪ " + SONGS[si].title + " / 参考コール" + (c.versionName ? " 「" + c.versionName + "」" : "");
  const D = Math.max(dur(), 1), t0 = Math.min(now() || rangeStart(), D);
  const A0 = Math.max(rangeStart(), Math.floor(t0));
  $("spA").max = D; $("spB").max = D;
  $("spA").value = A0; $("spB").value = Math.min(D, A0 + 30);
  paintSpVals();
  if (preset) {   // build 63: シェアの選択肢シートから渡された範囲を初期値にする
    $("spA").value = Math.max(0, Math.min(preset.a, D)); $("spB").value = Math.max(+$("spA").value + 0.5, Math.min(preset.b, D)); paintSpVals();
  }
  $("spResult").innerHTML = (me && prof) ? "" : '<div class="spLink">ログインしていないため、このシェアポイントは保存されません（リンクのコピーとシェアはできます）</div>';
  enterSp();
  if (autoCreate) createSp();   // build 63: 「フルでシェア」「この指定パート全体をシェア」は、そのままリンク作成まで進む
}
async function createSp() {
  const v = spVals(), a = v.a, b = v.b;
  if (!(b > a + 0.4)) return toast("終点は始点より後にしてください");
  let link, saveDoc, shareLabel;
  if (spRef) {
    link = srLink(spRef.id, a, b);
    saveDoc = {callId: "ref:" + spRef.id, title: SONGS[si].title, ver: "参考コール" + (spRef.versionName ? " 「" + spRef.versionName + "」" : "")};
    shareLabel = "の参考コール";
  } else {
    const c = calls.find(x => x.id === spEdit); if (!c) return;
    link = spLink(c.id, a, b);
    saveDoc = {callId: c.id, title: SONGS[si].title, ver: c.versionName || ""};
    shareLabel = "の推しコール";
  }
  let saved = false;
  if (me && prof) {
    try { await addDoc(collection(db, "spPoints"), {uid: me.uid, callId: saveDoc.callId, title: saveDoc.title, ver: saveDoc.ver, a: a, b: b, at: serverTimestamp()}); saved = true; } catch (e) {}
  }
  const txt = encodeURIComponent("♪ " + SONGS[si].title + " " + shareLabel + " " + fmt(a) + "〜" + fmt(b) + " | ももクロコール共有");
  $("spResult").innerHTML = '<div class="spLink">' + esc(link) + "</div>"
    + '<div class="spShare"><button class="spCopy" data-a="spCopy" data-i="' + esc(link) + '">リンクをコピー</button>'
    + '<a class="spX" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + txt + "&url=" + encodeURIComponent(link) + '">Xでシェア</a>'
    + '<a class="spLine" target="_blank" rel="noopener" href="https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(link) + '">LINEでシェア</a></div>'
    + '<div class="ogpPrev"><img src="ogp.jpg" alt=""><div class="og"><b>未完成なコールウェブアプリ</b><span>見る…？</span></div></div>'
    + (saved ? '<div class="spFor">マイページに保存しました</div>' : "");
  toast("シェアポイントを作成しました");
  guideEvent("spCreated");
}
async function openSpPage(id, a, b) {
  const el = $("spPage"); el.style.display = "block";
  const body = $("spPageBody");
  body.innerHTML = '<div class="cmtNone">読み込み中…</div>';
  let c = null;
  try { const d = await getDoc(doc(db, "calls", id)); if (d.exists()) c = {id: d.id, ...d.data()}; } catch (e) {}
  if (!c || (c.public !== true && !(me && c.ownerUid === me.uid))) {
    body.innerHTML = '<div class="spPgT">このシェアポイントは表示できませんでした</div><div class="spPgMeta">コールが非公開か、削除された可能性があります。</div>';
    return;
  }
  const sg = SONGS.find(s => s.vid === c.videoId);
  const sc = (c.scenes || []).filter(s => s.t + s.d > a && s.t < b).sort((x, y) => x.t - y.t);
  body.innerHTML = '<div class="spPgT">♪ ' + esc(sg ? sg.title : "") + "</div>"
    + '<div class="spPgMeta">' + esc(c.ownerName) + "さんの推しコール" + (c.versionName ? " 「" + esc(c.versionName) + "」" : "") + "<br>範囲: " + fmt(a) + " 〜 " + fmt(b) + "</div>"
    + '<div id="spAutoNote" class="spPgMeta" style="display:none">自動再生中です。音が出ない場合は、画面をどこかタップしてください</div>'
    + '<button class="spPlayBtn" data-a="spPlay" data-i="' + c.id + "|" + a + "|" + b + '">この範囲を再生</button>'
    + (sc.length ? sc.map(s => '<div class="spPgScene">' + fmt(s.t) + " " + LAB[s.k] + " 「" + esc(s.x) + "」</div>").join("") : '<div class="spPgMeta">この範囲に場面はありません</div>');
  tryAutoSp("call", c.id, a, b);
}
async function openSrPage(id, a, b) {
  const el = $("spPage"); el.style.display = "block";
  const body = $("spPageBody");
  body.innerHTML = '<div class="cmtNone">読み込み中…</div>';
  let c = null;
  try { const d = await getDoc(doc(db, "refs", id)); if (d.exists()) c = {id: d.id, ...d.data()}; } catch (e) {}
  if (!c) {
    body.innerHTML = '<div class="spPgT">このシェアポイントは表示できませんでした</div><div class="spPgMeta">参考コールが削除された可能性があります。</div>';
    return;
  }
  const sg = SONGS.find(s => s.vid === c.videoId);
  const sc = (c.scenes || []).filter(s => s.t + s.d > a && s.t < b).sort((x, y) => x.t - y.t);
  body.innerHTML = '<div class="spPgT">♪ ' + esc(sg ? sg.title : "") + "</div>"
    + '<div class="spPgMeta">参考コール' + (c.versionName ? " 「" + esc(c.versionName) + "」" : "") + "<br>範囲: " + fmt(a) + " 〜 " + fmt(b) + "</div>"
    + '<div id="spAutoNote" class="spPgMeta" style="display:none">自動再生中です。音が出ない場合は、画面をどこかタップしてください</div>'
    + '<button class="spPlayBtn" data-a="spPlayRef" data-i="' + c.id + "|" + a + "|" + b + '">この範囲を再生</button>'
    + (sc.length ? sc.map(s => '<div class="spPgScene">' + fmt(s.t) + " " + LAB[s.k] + " 「" + esc(s.x) + "」</div>").join("") : '<div class="spPgMeta">この範囲に場面はありません</div>');
  tryAutoSp("ref", c.id, a, b);
}
async function startSpCall(id, a, b) {
  let c = calls.find(x => x.id === id);
  if (!c) {
    try { const d = await getDoc(doc(db, "calls", id)); if (d.exists()) c = {id: d.id, ...d.data()}; } catch (e) {}
    if (!c) { toast("コールが見つかりませんでした"); return; }
    const idx0 = SONGS.findIndex(s => s.vid === c.videoId);
    if (idx0 >= 0 && idx0 !== si) { si = idx0; VID = SONGS[si].vid; try { localStorage.setItem("momo_song", si); } catch (e) {} UI.songSel(si); cueCurrentSong(); }
    await loadCalls();
    if (!calls.some(x => x.id === id)) { toast("コールが見つかりませんでした"); return; }
  } else {
    const idx = SONGS.findIndex(s => s.vid === c.videoId);
    if (idx >= 0 && idx !== si) { si = idx; VID = SONGS[si].vid; try { localStorage.setItem("momo_song", si); } catch (e) {} UI.songSel(si); cueCurrentSong(); await loadCalls(); }
  }
  act = id; refPlay = false; randPlay = false; sess = null; paintApply(); applyAct(); render();
  spRange = {a: a, b: b};
  if (playerReady()) { playerSeek(a); playerPlay(); }
}
async function startSpRef(id, a, b) {
  let c = refCalls.find(x => x.id === id) || (curRef && curRef.id === id ? curRef : null);
  if (!c) { try { const d = await getDoc(doc(db, "refs", id)); if (d.exists()) c = {id: d.id, ...d.data()}; } catch (e) {} }
  if (!c) { toast("参考コールが見つかりませんでした"); return; }
  const idx = SONGS.findIndex(s => s.vid === c.videoId);
  if (idx >= 0 && idx !== si) { si = idx; VID = SONGS[si].vid; try { localStorage.setItem("momo_song", si); } catch (e) {} UI.songSel(si); cueCurrentSong(); await loadCalls(); }
  applyRef(c);
  spRange = {a: a, b: b};
  if (playerReady()) { playerSeek(a); playerPlay(); }
}
async function tryAutoSp(kind, id, a, b) {
  let n = 0;
  while (!ytReady && n < 25) { await new Promise(r => setTimeout(r, 400)); n++; }
  if (!ytReady) return;
  if (kind === "ref") await startSpRef(id, a, b); else await startSpCall(id, a, b);
  setTimeout(() => {
    try {
      if (yt.getPlayerState() !== 1) {
        yt.mute(); yt.playVideo();
        const note = $("spAutoNote"); if (note) note.style.display = "block";
        const un = () => { try { yt.unMute(); } catch (e) {} document.removeEventListener("pointerdown", un); };
        document.addEventListener("pointerdown", un);
      }
    } catch (e) {}
  }, 1600);
}
function checkSpHash() {
  const h = location.hash || "";
  const mr = h.match(/sr=([^&]+)&a=([\d.]+)&b=([\d.]+)/);
  if (mr) { openSrPage(mr[1], +mr[2], +mr[3]); return; }
  const m = h.match(/sp=([^&]+)&a=([\d.]+)&b=([\d.]+)/);
  if (m) openSpPage(m[1], +m[2], +m[3]);
}
$("spA").addEventListener("input", paintSpVals);
$("spB").addEventListener("input", paintSpVals);

const A = {
  login: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { toast("ログインできませんでした"); } },
  logout: async () => { await signOut(auth); A.menu(); toast("ログアウトしました"); },
  copyLink: async () => {
    const u = "https://go-apsp.github.io/momoclo-call/";
    try { await navigator.clipboard.writeText(u); toast("リンクをコピーしました"); }
    catch { const ta = document.createElement("textarea"); ta.value = u; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("リンクをコピーしました"); }
  },
  spMode: () => {
    spMode = !spMode;
    if (spMode) {
      if (ytReady && yt && yt.pauseVideo) { try { yt.pauseVideo(); } catch (e) {} }
      if (!spCtrl) initSpController();
      else if (SONGS[si] && SONGS[si].tid && spLoadedTid !== SONGS[si].tid) {
        spLoadedTid = SONGS[si].tid;
        try { spCtrl.loadUri("spotify:track:" + spLoadedTid); } catch (e) {}
      }
    } else {
      if (spCtrl) { try { spCtrl.pause(); } catch (e) {} }
      spAnchor.paused = true;
    }
    paintSpMode();
    toast(spMode ? "Spotifyモードに切り替えました" : "YouTubeモードに戻しました");
  },
  spGo: () => A.spMode(),
  bigCall: () => {
    bigCall = !bigCall;
    const w = $("mvwrap"), b = $("bigCallBtn");
    if (w) w.classList.toggle("big-call", bigCall);
    if (b) b.classList.toggle("on", bigCall);
    toast(bigCall ? "コール表示を大きくしました" : "コール表示を標準に戻しました");
  },
  tlNow: () => {
    if (act && calls.some(x => x.id === act)) { A.tl(act); return; }
    const sc = mkPv ? mkPv.scenes : EV;
    if (sc && sc.length) {
      const pseudo = {id: "__cur__", ownerName: refPlay ? "参考コール" : randPlay ? "ランダム再生" : "プレビュー", versionName: (curRef && curRef.versionName) || "", scenes: sc};
      tlId = "__cur__"; tlZoom = false;
      tlD = Math.max(dur() || 0, sc.reduce((m, s2) => Math.max(m, s2.t + s2.d), 0), 1);
      $("tlBody").innerHTML = UI.timeline(pseudo, tlD, false);
      $("tlov").style.display = "block";
      return;
    }
    if (calls[0]) { A.tl(calls[0].id); return; }
    toast("表示できるコールがまだありません");
  },
  whoami: () => { if (!me || !prof) return; $("mypage").style.display = "block"; loadMyPage(); },
  closeMy: () => { $("mypage").style.display = "none"; },
  userPage: uid => { if (me && uid === me.uid) return A.whoami(); openUserPage(uid); },
  closeUser: () => { $("userpage").style.display = "none"; },
  mypOpen: async key => {
    const p = key.split("|"), idx = SONGS.findIndex(s => s.vid === p[0]);
    $("mypage").style.display = "none";
    $("userpage").style.display = "none";
    if (idx >= 0 && idx !== si) { si = idx; VID = SONGS[si].vid; try { localStorage.setItem("momo_song", si); } catch (e) {} UI.songSel(si); cueCurrentSong(); }
    openId = p[1];
    await loadCalls();
    if (calls.some(c => c.id === p[1])) { act = p[1]; applyAct(); render(); }
    A.openOv();
  },
  mypCmtOk: async key => { const p = key.split("|"); try { await updateDoc(doc(db, "calls", p[0], "comments", p[1]), {status: "approved"}); toast("感想を公開しました"); } catch (e) { toast("公開できませんでした"); } await checkPending(false); loadMyPage(); },
  mypCmtNg: async key => { const p = key.split("|"); try { await deleteDoc(doc(db, "calls", p[0], "comments", p[1])); toast("感想を公開しませんでした"); } catch (e) { toast("処理できませんでした"); } await checkPending(false); loadMyPage(); },
  song: i => {
    si = +i; VID = SONGS[si].vid; act = null; EV = [];
    try { localStorage.setItem("momo_song", String(si)); } catch (e) {}
    cueCurrentSong();
    mkPv = null; refPlay = false; randPlay = false; spRange = null;
    /* プロトタイプ2 v48: 作りかけは再生側で曲を変えても保持する。作成中の曲の切替は作成レイヤー内での操作のときだけ下書きをリセットする */
    if (screen === "mk") { mk = {scenes: [], type: "call", from: null, base: ""}; mkSel = -1; mkLenPhase = null; }
    renderMk(); UI.songSel(si); sess = null; paintApply(); applyAct(); loadCalls();
  },
  menu: () => { const m = $("menu"); m.style.display = m.style.display === "block" ? "none" : "block"; document.body.classList.toggle("menu-open", m.style.display === "block"); },
  openOv: () => { $("menu").style.display = "none"; document.body.classList.remove("menu-open"); document.body.classList.add("ov-open"); $("ov").style.display = "block"; render(); },
  closeOv: () => { $("ov").style.display = "none"; document.body.classList.remove("ov-open"); },
  play: () => {
    if (spMode && !spHasTrack()) return toast("この曲はSpotifyでは再生できません");
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備中です" : "動画の準備中です");
    if (sess && sess.t0 && Date.now() - sess.t0 > LIMIT) { sess = null; paintApply(); }
    if ($("intro").style.display === "block") { skipIntro(); return; }
    if (playerState() === 1) { playerPause(); return; }
    const R = curRange();
    const krP = kanranRange();   // build 63: 観覧モード中は、再生を始める時点で範囲の外なら始点へ寄せる(曲の再生範囲があるときはそちらが優先)
    if (R) { const t = now(); if (t < R.s - 0.05 || t >= R.e - 0.3) playerSeek(R.s); }
    else if (krP) { const t = now(); if (t < krP.a - 0.05 || t >= krP.b - 0.05) playerSeek(krP.a); }
    else if (spMode && spOff() < 0 && spRawNow() < -spOff() - 0.1) { playerSeek(0); }
    if (playerState() === 2 && now() > 1) { playerPlay(); return; }
    runIntro();
  },
  pen: () => $("pen").classList.toggle("on"),
  penColor: (i, b) => { $("pen").style.color = PEN[i][1]; document.documentElement.style.setProperty("--pc", PEN[i][1]); document.querySelectorAll("#dots button").forEach(x => x.classList.toggle("sel", x === b)); },
  help: () => toast("このタイミングで一緒にコールやシンガロンができます"),
  waku: async () => {
    /* build 62: いつでも押せる(再生中・カード表示中かどうかは問わない)。この訪問中に作ったコールには押せない */
    if (act && mySession.has(act)) return toast("自分のコールには押せないよ");
    /* 押した瞬間に場面カードが出ていれば、そのカードを押した時点から設定時間(d)いっぱい出し直す。カードが出ていなければ演出だけ */
    if (cur) wakuHold = {e: cur, until: performance.now() + cur.d * 1000};
    if (!cur) { wakuFx(null); return toast("一緒に湧いた!"); }
    if (refPlay || randPlay) { wakuFx(cur.x); return toast("一緒に湧いた!"); }
    if (isMine()) { wakuFx(cur.x); return toast("一緒に湧いた! ※自分の推しコールなのでスコアは反映されません"); }
    const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); }
    if (Date.now() - q.t0 > LIMIT) return toast("タイム制限がかかりました。これ以上は反映されません。次回再生時にリセットされます", 4500);
    await q.ready; q.n++; wakuFx(cur.x);
    toast(me && prof ? "一緒に湧いた! 今回 " + q.n + " 回" : "一緒に湧いた! ※ログインすると、スコアに反映されます");
    if (q.first) { clearTimeout(q.tm); q.tm = setTimeout(() => saveWaku(q), 2500); } else paintApply();
  },
  geki: () => { gekiOn = !gekiOn; paintGekiBtn(); toast(gekiOn ? "激湧きモード ON! 「湧く!」のたびに画面全体に光が出ます" : "激湧きモード OFF"); },
  /* build 63: 観覧モード。ガイドモードの手順には組み込まない(ロック対象にもしない) */
  kanran: () => { paintKanran(); $("kanranSheet").classList.add("on"); },
  kanranClose: () => { $("kanranSheet").classList.remove("on"); },
  kanranSpec: () => {   // 指定パート: シートの中で範囲指定の欄を開く(既に開いていれば閉じる)
    const box = $("ksSpecBox");
    const willOpen = !box.classList.contains("on");
    if (willOpen) {
      if (kanranMode && kanranMode.type === "spec") ksEdit = {a: kanranMode.a, b: kanranMode.b};
      else { const a = Math.max(0, Math.floor(now())); ksEdit = {a: a, b: Math.min(Math.max(10, Math.ceil(dur() || 240)), a + 30)}; if (ksEdit.b <= ksEdit.a) ksEdit.b = ksEdit.a + 1; }
      renderKsSpec();
    }
    box.classList.toggle("on", willOpen);
  },
  kanranHereStart: () => { ksEdit.a = Math.round(now() * 10) / 10; if (ksEdit.b <= ksEdit.a) ksEdit.b = ksEdit.a + 1; renderKsSpec(); },
  kanranHereEnd: () => { ksEdit.b = Math.round(now() * 10) / 10; if (ksEdit.b <= ksEdit.a) ksEdit.a = Math.max(0, ksEdit.b - 1); renderKsSpec(); },
  kanranApplySpec: () => {   // 「この範囲で観る」: 指定パートモードを開始する。以後どのコールでも同じ範囲が効く
    if (!(ksEdit.b > ksEdit.a)) return toast("終点は始点より後にしてください");
    kanranMode = {type: "spec", a: Math.round(ksEdit.a * 10) / 10, b: Math.round(ksEdit.b * 10) / 10};
    $("ksSpecBox").classList.remove("on");
    $("kanranSheet").classList.remove("on");
    paintKanran();
    kanranPlayFrom(kanranMode.a);
    toast("指定パートで観覧中: " + fmt(kanranMode.a) + " 〜 " + fmt(kanranMode.b));
  },
  kanranOshi: () => {   // 推しパートモードを開始する。範囲は再生中のコールの oshiPart から取る
    kanranMode = {type: "oshi"};
    $("ksSpecBox").classList.remove("on");
    $("kanranSheet").classList.remove("on");
    paintKanran();
    const kr = kanranRange();
    if (kr) { kanranPlayFrom(kr.a); toast("推しパートで観覧中: " + fmt(kr.a) + " 〜 " + fmt(kr.b)); }
    else { kanranOshiNotifiedFor = act; toast("このコールには推しパートが設定されていません"); }
  },
  kanranNormal: () => {   // 通常観覧に戻す
    kanranMode = null; kanranOshiNotifiedFor = null;
    $("ksSpecBox").classList.remove("on");
    $("kanranSheet").classList.remove("on");
    paintKanran();
    toast("通常観覧に戻しました");
  },
  /* build 63: この作者の他の推しコール。どの観覧モードでも使える。ガイドモードの対象にはしない */
  authorOther: () => { openAuthorSheet(); },
  authorClose: () => { $("authorSheet").classList.remove("on"); },
  authorPlay: async id => {   // 一覧で選んだコールへ切り替える。別の曲のコールなら曲(動画)ごと切り替える
    const target = authorListCache.find(x => x.id === id); if (!target) return;
    if (isGuestCall(target)) return toast("ゲストが作ったコールは、作者の一覧を表示できません");
    $("authorSheet").classList.remove("on");
    A.closeOv();
    refPlay = false; randPlay = false; spRange = null; mkPv = null;
    sess = null; paintApply();
    const idx = SONGS.findIndex(x => x.vid === target.videoId);
    const songChanged = idx >= 0 && idx !== si;
    if (songChanged) {
      si = idx; VID = SONGS[si].vid;
      try { localStorage.setItem("momo_song", String(si)); } catch (e) {}
      UI.songSel(si);
      cueCurrentSong();
    }
    act = id;
    await loadCalls();   // 切り替え先の曲のコール一覧を読み直す(act は先に決めてあるので参考コールの自動適用は入らない)
    if (calls.some(x => x.id === id)) { act = id; applyAct(); render(); }
    const kr = kanranRange();   // 観覧モード中は、範囲の始点から再生する
    if (kr) kanranPlayFrom(kr.a);
    else if (playerReady()) playerSeek(rangeStart());
    $("mvwrap").scrollIntoView({behavior: "smooth"});
    toast(target.ownerName + "さんの推しコールに切り替えました" + (songChanged ? "(♪ " + (SONGS[idx] ? SONGS[idx].title : "") + ")" : ""));
  },
  /* build 63: シェアの選択肢シート */
  shChoiceClose: () => { $("shareChoiceSheet").classList.remove("on"); },
  shChoiceFull: () => {   // 通常観覧: 曲全体(0〜曲の終わり)を範囲にして、そのままシェア結果まで進む
    const t = shChoiceTarget; if (!t) return;
    $("shareChoiceSheet").classList.remove("on");
    const D = Math.max(10, Math.ceil(dur() || 240));
    if (t.ref) openSpPanelRef(t.id, {a: 0, b: D}, true);
    else openSpPanel(t.id, {a: 0, b: D}, true);
  },
  shChoiceWhole: () => {   // 指定パート全体 / 推しパートを、そのままシェア範囲にしてシェア結果まで進む
    const t = shChoiceTarget; if (!t) return;
    let range = null;
    if (kanranMode && kanranMode.type === "spec") range = {a: kanranMode.a, b: kanranMode.b};
    else if (kanranMode && kanranMode.type === "oshi") {
      const c = t.ref ? (refCalls.find(x => x.id === t.id) || (curRef && curRef.id === t.id ? curRef : null)) : calls.find(x => x.id === t.id);
      if (c && c.oshiPart && c.oshiPart.b > c.oshiPart.a) range = {a: +c.oshiPart.a || 0, b: +c.oshiPart.b || 0};
    }
    if (!range) return toast("このコールには推しパートが設定されていません");   // 案内だけ出して、範囲設定へは進まない(シートは開いたまま)
    $("shareChoiceSheet").classList.remove("on");
    if (t.ref) openSpPanelRef(t.id, range, true);
    else openSpPanel(t.id, range, true);
  },
  shChoiceRange: () => {   // 範囲設定画面へ進む。本番の作成画面は3段階ボタン式でスライダーが無いため、初期値の持ち込みはせず通常の流れで決める
    const t = shChoiceTarget; if (!t) return;
    $("shareChoiceSheet").classList.remove("on");
    if (t.ref) openSpPanelRef(t.id);
    else openSpPanel(t.id);
  },
  apply: () => { if (sess) saveWaku(sess); },
  pickIcon: i => { pickI = +i; UI.sheetIcons(pickI); },
  tl: id => { const raw = calls.find(x => x.id === id); if (!raw) return; const c = {...raw, scenes: mkPlaybackScenes(raw.scenes)}; if (!c.scenes.length) return toast("この推しコールには配置済みカードがありません"); tlId = id; tlZoom = false; tlD = Math.max(dur() || 0, c.scenes.reduce((m, s) => Math.max(m, s.t + s.d), 0), 1); $("tlBody").innerHTML = UI.timeline(c, tlD, false); $("tlov").style.display = "block"; },
  tlZoom: () => { const sc = mkPv ? mkPv.scenes : EV; const c = tlId === "__cur__" ? {id: "__cur__", ownerName: refPlay ? "参考コール" : randPlay ? "ランダム再生" : "プレビュー", versionName: (curRef && curRef.versionName) || "", scenes: sc} : calls.find(x => x.id === tlId); if (!c) return; tlZoom = !tlZoom; $("tlBody").innerHTML = UI.timeline(c, tlD, tlZoom); },
  closeTl: () => { $("tlov").style.display = "none"; tlId = null; tlZoom = false; },
  tlMark: i => { const sc = mkPv ? mkPv.scenes : EV; const c = tlId === "__cur__" ? {scenes: sc} : calls.find(x => x.id === tlId); if (!c || !c.scenes) return; const s2 = c.scenes[+i]; if (s2) $("tlInfo").textContent = fmt(s2.t) + " " + LAB[s2.k] + " 「" + s2.x + "」"; },
  refcall: async () => {
    A.closeOv();
    try { const snap = await getDocs(query(collection(db, "refs"), where("videoId", "==", VID))); refCalls = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.draft !== true); }
    catch (e) { refCalls = []; }
    $("refList").innerHTML = UI.refs(refCalls);
    document.body.classList.add("ref-open");
    $("refov").style.display = "block";
  },
  closeRef: () => { $("refov").style.display = "none"; document.body.classList.remove("ref-open"); },
  useRef: id => {
    const c = refCalls.find(x => x.id === id); if (!c) return;
    applyRef(c);
    A.closeRef();
    if (playerReady()) playerSeek(rangeStart());
    toast("参考コールで再生します");
  },
  randomPlay: () => {
    if (screen === "mk") exitMk();   // プロトタイプ2: 作成画面からランダム再生へ移る時も、作成画面を正しく抜ける
    const pubs = calls.filter(c => c.public);
    if (!pubs.length) return toast("公開中の推しコールがまだありません");
    const byT = new Map();
    pubs.forEach(c => (c.scenes || []).forEach(sc => { if (!mkIsPlaced(sc)) return; const k = Math.round(sc.t); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(sc); }));
    const scenes = [...byT.keys()].sort((a, b) => a - b).map(t => { const arr = byT.get(t); return {...arr[Math.floor(Math.random() * arr.length)], t}; });
    if (!scenes.length) return toast("場面がまだありません");
    randPlay = true; refPlay = false; act = null; curRef = null; sess = null; paintApply();
    EV = scenes.sort((a, b) => a.t - b.t);
    $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">コールランダム再生モード</div>';
    $("info").textContent = "";
    $("panelbody").innerHTML = "コールランダム再生モードです。みんなの推しコールから、場面ごとに選んで再生しています";
    renderPEv();
    paintKanran();   // build 63: ランダム再生では観覧モードは効かない(kanranRange が null を返す)が、状態表示だけ合わせる
    A.closeOv();
    if (playerReady()) playerSeek(rangeStart());
    toast("コールランダム再生モードで再生します");
  },
  mkv: () => { $("mkvWarn").style.display = "flex"; },
  mkvCancel: () => { $("mkvWarn").style.display = "none"; },
  mkvOk: () => { $("mkvWarn").style.display = "none"; $("mkvPage").style.display = "block"; },
  closeMkv: () => { $("mkvPage").style.display = "none"; },
  spOpen: id => { if (guide) { openSpPanel(id); return; } openShareChoice({id: id, ref: false}); },   // build 63: まず観覧状態に応じた選択肢シートを出す(ガイド中は直行)
  spClose: () => { guideEvent("cancel"); setScreen("play"); spStep = 0; paintSpStep(); },
  spSetA: () => { $("spA").value = Math.floor(now()); paintSpVals(); if (spStep === 0) { spStep = 1; paintSpStep(); } },
  spSetB: () => { $("spB").value = Math.ceil(now()); paintSpVals(); if (spStep === 1) { spStep = 2; paintSpStep(); } },
  /* build 58: 細長いボタン1つで 始点 → 終点 → 作成 と進める */
  spStep: () => {
    if (spStep === 0) { A.spSetA(); toast("始点を " + fmt(spVals().a) + " にしました"); guideEvent("spA"); return; }
    if (spStep === 1) {
      A.spSetB();
      if (!(spVals().b > spVals().a + 0.4)) { spStep = 1; paintSpStep(); return toast("終点は始点より後にしてください"); }
      toast("終点を " + fmt(spVals().b) + " にしました");
      guideEvent("spB");
      return;
    }
    const v = spVals();
    if (!(v.b > v.a + 0.4)) { spStep = 1; paintSpStep(); return toast("終点は始点より後にしてください"); }
    createSp();
    spStep = 0; paintSpStep();
  },
  spPreview: () => { const v = spVals(); if (!(v.b > v.a + 0.4)) return toast("終点は始点より後にしてください"); spRange = {a: v.a, b: v.b}; if (playerReady()) { playerSeek(v.a); playerPlay(); } },
  spCreate: () => createSp(),
  spCopy: async url => {
    try { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); }
    catch { const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("リンクをコピーしました"); }
  },
  spPageClose: () => { $("spPage").style.display = "none"; try { history.replaceState(null, "", location.pathname); } catch (e) {} },
  spPlay: key => { const p = key.split("|"); A.spPageClose(); startSpCall(p[0], +p[1], +p[2]).then(() => toast("シェアポイントの範囲を再生します")); },
  spOpenRef: id => { if (guide) { openSpPanelRef(id); return; } openShareChoice({id: id, ref: true}); },   // build 63: まず観覧状態に応じた選択肢シートを出す(ガイド中は直行)
  spPlayRef: key => { const p = key.split("|"); A.spPageClose(); startSpRef(p[0], +p[1], +p[2]).then(() => toast("シェアポイントの範囲を再生します")); },
  mypSpOpen: id => { const s = mySps.find(x => x.id === id); if (!s) return; $("mypage").style.display = "none"; if (String(s.callId || "").indexOf("ref:") === 0) openSrPage(s.callId.slice(4), s.a, s.b); else openSpPage(s.callId, s.a, s.b); },
  mypSpShare: id => { const s = mySps.find(x => x.id === id); if (s) A.spCopy(spLinkFor(s)); },
  mypSpDel: async id => { try { await deleteDoc(doc(db, "spPoints", id)); toast("シェアポイントを削除しました"); } catch (e) { toast("削除できませんでした"); } loadMyPage(); },
  panel: () => { const p = $("panel"); p.style.display = p.style.display === "block" ? "none" : "block"; },
  fs: () => {   // アプリ専用の全画面。端末の全画面機能が使えれば使い、使えなければ画面いっぱいに広げる
    const m = $("mv"), on = !m.classList.contains("fs"), el = document.documentElement;
    m.classList.toggle("fs", on); document.body.classList.toggle("nofs", on); $("panel").style.display = "none";
    if (on) {
      const f = el.requestFullscreen || el.webkitRequestFullscreen; native = !!f;
      if (f) { try { const p = f.call(el); if (p && p.catch) p.catch(() => { native = false; }); } catch (e) { native = false; } }
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      native = false;
    }
  },
  toggle: async id => { openId = openId === id ? null : id; render(); if (openId === id) { await loadCmts(id); render(); } },
  cmtWrite: async id => { await writeCmt(id, "cn-", "ct-"); },
  cmtWriteP: async id => { await writeCmt(id, "pn-", "pt-"); },
  cmtOk: async key => {
    const p = key.split("|");
    try { await updateDoc(doc(db, "calls", p[0], "comments", p[1]), {status: "approved"}); await loadCmts(p[0]); await checkPending(false); render(); renderReview(); toast("感想を公開しました"); }
    catch (e) { toast("公開できませんでした"); }
  },
  cmtNg: async key => {
    const p = key.split("|");
    try { await deleteDoc(doc(db, "calls", p[0], "comments", p[1])); await loadCmts(p[0]); await checkPending(false); render(); renderReview(); toast("感想を公開しませんでした"); }
    catch (e) { toast("処理できませんでした"); }
  },
  review: () => { $("menu").style.display = "none"; document.body.classList.remove("menu-open"); document.body.classList.add("cm-open"); renderReview(); $("cmov").style.display = "block"; },
  evToggle: () => { pEvOpen = !pEvOpen; renderPEv(); },
  edit: id => {
    if (!guard()) return;
    const c = calls.find(x => x.id === id); if (!c) return;
    if (!confirm("編集はできますが、今までのスコア(♥と湧き)はリセットされ、付いた感想も削除されます。よろしいですか?")) return;
    mk = {scenes: c.scenes.map(x => ({...x})), type: "call", from: null, base: "", editId: id};
    mkSel = -1; mkLenPhase = null;
    $("mkVer").value = c.versionName || ""; $("mkNote").value = c.note || ""; $("mkRef").checked = !!c.allowRef; $("mkCmt").checked = c.allowComments !== false;
    A.closeOv(); enterMk();
    toast("編集モード: 保存するとスコアと感想はリセットされます");
  },
  closeReview: () => { $("cmov").style.display = "none"; document.body.classList.remove("cm-open"); },
  use: id => { if (screen === "mk") exitMk(); act = id; refPlay = false; randPlay = false; spRange = null; sess = null; paintApply(); applyAct(); A.closeOv(); },   // プロトタイプ2 移植11: 作成画面で選んだら再生画面へ戻す
  heart: async id => {
    /* build 62: この訪問中に作ったコールには押せない(ログイン/ゲスト共通) */
    if (mySession.has(id)) return toast("自分のコールには押せないよ");
    const own = calls.find(x => x.id === id); if (!own) return;
    if (!me) {
      /* ゲストも押せる。押した分は総数に加算されて残るが、誰が押したかの記録は残さない(開いている間の二重押し防止だけ) */
      if (guestLiked.has(id)) return toast("ハートしました");
      guestLiked.add(id); own.hearts = (own.hearts || 0) + 1; render();
      try { await updateDoc(doc(db, "calls", id), {hearts: increment(1)}); }
      catch (e) { toast("ハートを反映できませんでした"); loadCalls(); }
      return;
    }
    if (!prof) return toast("ログインすると使えます");
    if (own.ownerUid === me.uid) return toast("自分の推しコールには、ハートは付けられません");   // 作った本人は変化なし
    const c = own, hr = doc(db, "calls", id, "hearts", me.uid), b = writeBatch(db), was = liked.has(id);
    if (was) { b.delete(hr); b.update(doc(db, "calls", id), {hearts: increment(-1)}); liked.delete(id); c.hearts--; }
    else { b.set(hr, {at: serverTimestamp()}); b.update(doc(db, "calls", id), {hearts: increment(1)}); liked.add(id); c.hearts = (c.hearts || 0) + 1; }
    render();
    try { await b.commit(); } catch (e) { toast("ハートを反映できませんでした"); loadCalls(); }
  },
  register: async i => {
    const nick = $("nick").value.trim();
    if (!nick) return toast("ニックネームを入れてください");
    const before = prof, next = {nick, oshi: +i, icon: pickI, mailNotify: $("mailNotify").checked, pr: $("pfPr").value.trim().slice(0, 100)};
    try {
      await setDoc(doc(db, "users", me.uid), before ? next : {...next, createdAt: serverTimestamp()}, {merge: true});
      if (before && (before.oshi !== next.oshi || before.nick !== nick || (before.icon || 0) !== pickI)) {   // 推し・名前を変えたら、自分の推しコールも合わせる
        const b = writeBatch(db);   // 全ての曲の、自分の推しコールを合わせる
        (await getDocs(query(collection(db, "calls"), where("ownerUid", "==", me.uid)))).forEach(d => b.update(d.ref, {oshi: next.oshi, ownerName: nick, ownerIcon: pickI}));
        await b.commit();
      }
    } catch (e) { return toast("保存できませんでした"); }
    prof = next; $("sheet").style.display = "none"; paintLogin();
    toast(before ? "変更しました" : nick + "さん、登録しました"); loadCalls();
  },
  editProf: () => { A.menu(); $("mypage").style.display = "none"; openSheet(true); },
  closeSheet: () => { $("sheet").style.display = "none"; },
  startMk: () => { mk.editId = null; mkSel = -1; mkLenPhase = null; mkSelOrigT = null; const mn = $("menu"); if (mn) mn.style.display = "none"; enterMk(); },   // build 62: ゲストでも作成画面に入れる。プロトタイプ2: 右上のサブメニューは開閉切替でなく必ず閉じる(閉じた状態から入ると開いてしまうバグがあった)
  endMk: () => { guideEvent("cancel"); exitMk(); },
  /* build 58: 作成ボタン。状態で働きが変わる(カード作成 → 長さを決める / 再編集=長さ測り直しの開始) */
  /* build 59: 大きなボタン。状態で働きが変わる(カード作成 → 長さ指定 → ここで終わり) */
  mkMain: () => {
    if (Date.now() - mkHoldClickAt < 500) return;   // 長押しで処理済みのクリックは握りつぶす
    if (mkMode === "oki") { openMkContentPanel(null); return; }
    // カード作成だけ: 再生中でも停止中でも、今の位置に仮の長さ5秒で1枚作る
    const t = p2RangeClamp(Math.round(clampT(now())));   // v47: 絞った範囲の外には作らない(停止中に範囲外へシークしていた場合も)
    const sc = {t: t, d: 5, placed: true, k: mk.type, x: $("mkText").value.trim()};
    mk.scenes.push(sc);
    mkSortScenes();
    if (sc.x) $("mkText").value = "";
    renderMk();
    const L = $("mkList"); if (L) L.scrollTop = L.scrollHeight;
    toast(fmt(t) + " にカードを作りました");
    guideEvent("card");
  },
  /* build 59: 速度切替(1倍 → 0.5倍 → 0.25倍) */
  rate: () => { const R = [1, 0.5, 0.25]; mkRate = R[(R.indexOf(mkRate) + 1) % R.length]; applyRate(); toast("再生速度を " + mkRate + "倍にしました"); },
  /* プロトタイプ2 移植9: 作成画面の速度セレクト(0.25/0.5/0.75/1倍) */
  rateSelect: v => { const n = Number(v); if (![0.25, 0.5, 0.75, 1].includes(n)) return; mkRate = n; applyRate(); toast("再生速度を " + mkRate + "倍にしました"); },
  /* build 59: 保存先の切替(公開/下書き)と、保存の確定ボタン「保存して戻る」 */
  mkPubTgl: () => { mkPub = !mkPub; paintMkPub(); },
  mkSaveBack: async () => { const ok = await A.save(mkPub ? "1" : "0"); if (ok) exitMk(); },
  playSceneJump: i => { const sc = EV[+i]; if (!sc) return; playerSeek(Math.max(0, (+sc.t || 0) - 6)); },   // プロトタイプ2 移植10
  mkDelSel: () => { if (mkSel >= 0 && mk.scenes[mkSel]) A.delScene(mkSel); },
  /* build 60: 作成画面下部の引き出し(バーで開閉 / プリセット一覧の表示 / 選択中カードへ適用) */
  psDrawer: (i, b) => { const d = $("mkDrawer"); if (!d) return; d.classList.toggle("open"); if (b) b.setAttribute("aria-expanded", d.classList.contains("open") ? "true" : "false"); },
  psOpen: () => {
    const el = $("psList"); if (!el) return;
    psListShown = !psListShown;
    el.style.display = psListShown ? "flex" : "none";
    if (psListShown && !psLoaded) loadPresets();
  },
  psApply: (i) => {
    const p = PRESETS[+i]; if (!p) return;
    if (!(mkSel >= 0 && mk.scenes[mkSel])) { toast("先にカードを選んでください"); return; }
    const sc = mk.scenes[mkSel];
    sc.k = p.k; sc.x = p.x; mk.type = p.k;
    document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === p.k));
    $("mkText").value = p.x;
    renderMk();
    const d = $("mkDrawer"); if (d) d.classList.remove("open");
    toast("プリセットを適用しました");
    guideEvent("text");
  },

  /* build 58: 埋め込みパネルのカードをタップ → そのカードの中身を編集(もう一度タップで終了) */
  mkPick: i => {
    i = +i;
    if (mkSel === i) { openMkContentPanel(mk.scenes[i]); return; }   // プロトタイプ2 移植2: 選択中のカードをもう一度タップで内容パネルを開く
    const sc = mk.scenes[i]; if (!sc) return;
    mkSel = i; mkLenPhase = null; mkSelOrigT = sc.t;   // build 64: 「戻す」用に、選んだときの位置を覚える
    mk.type = sc.k;
    document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === sc.k));
    $("mkText").value = sc.x;
    renderMk();
    if (mkIsPlaced(sc) && playerReady()) { playerSeek(sc.t); playerPlay(); }   // build 64: 選んだカードの位置から再生して、どの部分か音で確かめられる
    const pe = $("mkPosEdit"); if (pe) pe.scrollIntoView({behavior: "smooth", block: "nearest"});
    guideEvent("picked");
  },
  /* build 64: 作成の2モード切替と、選択中カードの位置編集(今の再生位置へ / 戻す / 選択解除) */
  mkMode: m => setMkMode(m),
  posHere: () => {
    const sc = mk.scenes[mkSel]; if (!sc) return toast("先にカードを選んでください");
    if (!mkIsPlaced(sc)) return toast("未配置のカードです。配置の操作は次の移植で入ります");
    const D = Math.max(dur() || 0, 1);
    let v = Math.round(now() * 10) / 10;
    v = p2RangeClamp(Math.max(0, Math.min(Math.max(0, D - sc.d), v)), sc.d);   // v47: 範囲内に閉じる
    if (v !== sc.t) { sc.t = v; mkSortScenes(); mkSel = mk.scenes.indexOf(sc); renderMk(); }
    toast("「" + (sc.x || LAB[sc.k]) + "」を今の再生位置(" + fmt(sc.t) + ")へ持ってきました");
    guideEvent("tweak");
  },
  posRestore: () => {
    const sc = mk.scenes[mkSel]; if (!sc || mkSelOrigT == null) return;
    const D = Math.max(dur() || 0, 1);
    let v = Math.max(0, Math.min(Math.max(0, D - sc.d), mkSelOrigT));
    if (v !== sc.t) { sc.t = v; mkSortScenes(); mkSel = mk.scenes.indexOf(sc); renderMk(); }
    if (playerReady()) { playerSeek(sc.t); playerPlay(); }
    toast("選んだときの位置(" + fmt(mkSelOrigT) + ")に戻しました");
    guideEvent("tweak");
  },
  selClear: () => { mkSel = -1; mkLenPhase = null; mkSelOrigT = null; renderMk(); },
  seek: (d) => { if (playerReady()) playerSeek(clampT(now() + +d)); },
  pseek: (d) => { if (playerReady()) playerSeek(clampT(now() + +d)); },
  type: (k) => { mk.type = k; document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === k)); if (mkSel >= 0 && mk.scenes[mkSel]) { mk.scenes[mkSel].k = k; renderMk(); } guideEvent("type"); },
  durAdj: d => {   // 旧UIの表示時間スライダー用(build 58で要素は廃止。互換のため残す)
    const el = $("mkDur"); if (!el) return;
    const c = Math.max(1, Math.min(20, Math.round((parseFloat(el.value) + parseFloat(d)) * 10) / 10));
    el.value = c; const v = $("mkDurVal"); if (v) v.textContent = c + "秒";
  },
  durAdjRow: key => {
    const p = String(key).split("|"), sc = mk.scenes[+p[0]]; if (!sc) return;
    sc.d = Math.max(1, Math.min(20, Math.round((sc.d + parseFloat(p[1])) * 10) / 10));
    renderMk();
  },
  durMeas: () => {   // 旧UIの計測ボタン用(build 58で要素は廃止。再編集の測り直しは 長さ指定ボタンが担当。互換のため残す)
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    const b = $("mkMeas"); if (!b) return;
    if (mkMeas === null) {
      mkMeas = now();
      if (playerState() !== 1) playerPlay();
      b.textContent = "■ ストップ(計測中…)";
      toast("再生中です。表示を止めたいところでストップを押してください");
    } else {
      const d = Math.round((now() - mkMeas) * 10) / 10;
      mkMeas = null;
      playerPause();
      const c = Math.max(1, Math.min(20, d));
      $("mkDur").value = c; $("mkDurVal").textContent = c + "秒";
      b.textContent = "▶ 再生して表示時間を測る";
      toast("表示時間を " + c + " 秒にしました");
    }
  },
  /* プロトタイプ2 移植1: お気に置きモードで、文言と種類だけ決めて未配置カードを作る(配置は移植3で入れる) */
  mkContentCancel: () => { mkCpTarget = null; closeMkContentPanel(); },
  place: () => { if (screen === "mk" && mkMode === "oki" && mkSel >= 0 && !mkIsPlaced(mk.scenes[mkSel])) toast("置きに行くボタンを押さえたまま、左右へ動かしてから離してください"); },   // プロトタイプ2 移植3: 配置はドラッグ側で処理。タップだけの時は案内
  mkContentTextNext: () => { if (!$("mkContentTextInput").value.trim()) return toast("コールの内容を入力してください"); mkCpStep = 2; paintMkContentPanel(); },
  mkContentBack: () => { mkCpStep = 1; paintMkContentPanel(); },
  mkContentChoose: i => { mkCpType = i; paintMkContentPanel(); },
  mkContentConfirm: () => {
    const x = $("mkContentTextInput").value.trim();
    if (!x) { mkCpStep = 1; paintMkContentPanel(); return toast("コールの内容を入力してください"); }
    const k = mkCpType, target = mkCpTarget;
    mkCpTarget = null;
    closeMkContentPanel();
    if (target) {
      target.x = x; target.k = k;
      mk.type = k; $("mkText").value = x;
      document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === k));
      renderMk();
      toast("カードの内容を変更しました");
      guideEvent("contentEdit");
    } else {
      const sc = {t: null, d: 5, placed: false, k: k, x: x};
      mk.scenes.push(sc); mkSortScenes();
      mkSel = -1; mkSelOrigT = null;
      $("mkText").value = "";
      renderMk();
      const L = $("mkList"); if (L) L.scrollTop = L.scrollHeight;
      toast("未配置カードを作成しました");
      guideEvent("contentDone");
    }
  },
  mkAddUnplaced: () => { openMkContentPanel(null); },   // プロトタイプ2 移植2: 未配置カードの新規作成は共通パネルから
  flowClose: () => closeMkFlow(),
  flowShow: () => openMkFlow("intro"),
  flowView: v => { if (v === "nori" || v === "oki" || v === "intro") { mkFlowView = v; paintMkFlow(); } },
  addScene: () => {   // 旧UIの「この位置に追加」用(build 58で要素は廃止。新方式は mkMain。互換のため残す)
    const durEl = $("mkDur");
    mk.scenes.push({t: Math.round(clampT(now())), d: (durEl ? parseFloat(durEl.value) : NaN) || 6, placed: true, k: mk.type, x: $("mkText").value.trim() || LAB[mk.type]});
    mkSortScenes(); $("mkText").value = ""; renderMk();
  },
  pvScene: i => {
    const sc = mk.scenes[+i]; if (!sc) return;
    if (!mkIsPlaced(sc)) return toast("未配置カードは、タイムラインに配置してからプレビューできます");
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    mkPv = {scenes: mkPlaybackScenes(mk.scenes).map(x => ({...x})), until: sc.t + sc.d + 3};
    playerSeek(sc.t); playerPlay();
    $("mv").scrollIntoView({behavior: "smooth"});
    toast("場面のプレビュー中(" + fmt(sc.t) + "〜" + fmt(sc.t + sc.d + 3) + ")");
  },
  pvAll: () => {
    if (!mk.scenes.length) return toast("場面を追加してください");
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    const sorted = mkPlaybackScenes(mk.scenes).map(x => ({...x})).sort((a, b) => a.t - b.t);
    if (!sorted.length) return toast("配置済みの場面がありません");
    const first = sorted[0], lastS = sorted[sorted.length - 1];
    mkPv = {scenes: sorted, until: lastS.t + lastS.d + 3};
    playerSeek(first.t); playerPlay();
    $("mv").scrollIntoView({behavior: "smooth"});
    toast("作成中の推しコールをプレビュー中");
  },
  delScene: i => { i = +i; mk.scenes.splice(i, 1); if (mkSel === i) { mkSel = -1; mkLenPhase = null; mkSelOrigT = null; $("mkText").value = ""; } else if (mkSel > i) mkSel--; renderMk(); },
  /* build 62: 選択中カードの位置 ±0.1秒(refmakeと同じ。つまみのドラッグと同じ更新処理: 位置を変えて並べ替え、一覧・つまみ・帯を同期) */
  mkFine: dt => {
    const sc = mk.scenes[mkSel]; if (!sc) return toast("先にカードを選んでください");
    if (!mkIsPlaced(sc)) return toast("未配置のカードは位置を直せません");
    const D = Math.max(dur() || 0, 1);
    let t = Math.round((sc.t + parseFloat(dt)) * 10) / 10;
    t = p2RangeClamp(Math.max(0, Math.min(Math.max(0, D - sc.d), t)), sc.d);   // v47: 微調整でも範囲外へ出さない
    if (t !== sc.t) { sc.t = t; mkSortScenes(); mkSel = mk.scenes.indexOf(sc); renderMk(); }
    guideEvent("fine");
  },
  /* build 62: プレビュー(トグル式)。作りかけのカード群を再生画面と同じ見え方で通し再生し、止めても編集状態は保持される */
  pvToggle: () => {
    if (mkPv) { mkPv = null; playerPause(); paintPvBtn(); return toast("プレビューを止めました(編集内容はそのまま残っています)"); }
    A.pvAll(); paintPvBtn();
  },
  /* ---------- build 62: ウェルカムカード ---------- */
  wcClose: () => { try { if ($("wcHide").checked) localStorage.setItem("momo_welcome_hide", "1"); } catch (e) {} $("welcome").classList.remove("on"); },
  wcShow: () => { try { localStorage.removeItem("momo_welcome_hide"); } catch (e) {} $("wcHide").checked = false; $("welcome").classList.add("on"); },
  /* ---------- build 62: 制作ガイドモード ---------- */
  guideStart: () => { if (guide) { endGuide(); return; } mk.editId = null; enterMk(); startGuide("mk"); },
  guideStartSp: () => { if (guide) { endGuide(); return; } if (screen !== "sp") return; startGuide("sp"); },
  guideOff: () => endGuide(),
  guideNext: () => { if (guide && guide.step === "s9") { mkSel = -1; mkLenPhase = null; $("mkText").value = ""; renderMk(); setGuideStep("s9b"); } },
  guideToSave: () => { if (guide && guide.step === "s9") setGuideStep("s10"); },
  save: async (pub, finishMeta = null) => {
    /* build 62: ゲスト(非ログイン)でも保存できる。ゲストは保存時の名前入力が作者名になり、ownerUid は null で紐づける */
    /* プロトタイプ2 移植4: 終了フローから呼ばれた時は finishMeta(名前/タイトル/バージョン名/備考)を使い、保存結果を返す */
    if (!mk.scenes.length) return toast("場面を追加してください");
    if (!me && !+pub) return toast("ゲストは下書き保存できません");   // プロトタイプ2: ゲスト下書きは廃止(祐治の決定 2026-11-16)。ゲストの保存は公開のみ
    const ver = finishMeta ? String(finishMeta.versionName || "").trim() : $("mkVer").value.trim();
    if (me && prof && calls.some(c => c.ownerUid === me.uid) && !ver) return toast("2つ目以降はバージョン名を入れてください");
    if (+pub && mk.from && JSON.stringify(mk.scenes) === mk.base) return toast("参考にした推しコールと全く同じなので公開できません。少し変えてください");
    let nid = null, savedRecord = null;
    try {
      const editId = mk.editId || null;
      let owner;
      if (me && prof) {
        owner = {ownerUid: me.uid, ownerName: (finishMeta && String(finishMeta.name || "").trim()) || prof.nick, oshi: prof.oshi, ownerIcon: prof.icon || 0};
      } else {
        const gn = (finishMeta && String(finishMeta.name || "").trim()) || $("mkGuestName").value.trim();
        if (!gn) return toast("名前を入れてください(作者として表示されます)");
        owner = {ownerUid: null, ownerName: gn.slice(0, 20), oshi: 5, ownerIcon: 0};
      }
      const record = {...owner, videoId: VID, ...(finishMeta ? {title: String(finishMeta.title || "").trim()} : {}), versionName: ver, note: finishMeta ? String(finishMeta.note || "").trim() : $("mkNote").value.trim(), allowRef: $("mkRef").checked, allowComments: $("mkCmt").checked, scenes: mk.scenes, public: !!+pub, hearts: 0, used: 0, createdAt: serverTimestamp()};
      const added = await addDoc(collection(db, "calls"), record);
      nid = added.id;
      savedRecord = {id: nid, ...record};
      if (editId) {
        try { const cs = await getDocs(query(collection(db, "calls", editId, "comments"), where("ownerUid", "==", me.uid))); await Promise.all(cs.docs.map(d => deleteDoc(d.ref))); } catch (e) {}
        try { await deleteDoc(doc(db, "calls", editId)); } catch (e) {}
      }
    } catch (e) { return toast("保存できませんでした"); }
    if (nid) { mySession.add(nid); sessSet("momo_my_calls", [...mySession]); }   // この訪問中に作ったコールとして覚える(自押し制限用)
    if (!finishMeta) toast(+pub ? "公開しました" : "下書きを保存しました");
    mk = {scenes: [], type: "call", from: null, base: ""}; mkSel = -1; mkLenPhase = null; mkSelOrigT = null; $("mkVer").value = $("mkNote").value = ""; $("mkText").value = ""; $("mkGuestName").value = ""; renderMk(); loadCalls();
    guideEvent("saved");
    return finishMeta ? {id: nid, record: savedRecord} : true;
  },
  ref: id => {
    const c = calls.find(x => x.id === id); if (!c) return;
    mk = {scenes: c.scenes.map(x => ({...x})), type: "call", from: id, base: JSON.stringify(c.scenes)};
    mkSel = -1; mkLenPhase = null; mkSelOrigT = null;
    A.closeOv(); enterMk();
    toast("中身を読み込みました。自分用に変えてください");
  },
  pub: async id => { const c = calls.find(x => x.id === id); try { await updateDoc(doc(db, "calls", id), {public: !c.public}); loadCalls(); } catch (e) { toast("変更できませんでした"); } },
  del: async id => { if (!confirm("この推しコールを削除しますか?")) return; try { await deleteDoc(doc(db, "calls", id)); loadCalls(); } catch (e) { toast("削除できませんでした"); } }
};

/* ---------- build 62: 制作ガイドモード(refmake build 61のガイドが原型) ----------
   手順どおりにしか進めないロック方式。次に操作する要素が点滅し、バナーに案内文と手順番号が出る。
   「ガイドモードを解除」ボタンはバナーに常時表示。最後の保存/キャンセルは作った人が選ぶ。
   build 64: 推しコール作成のガイドは2モード制に合わせて作り替え。
    - 共通の最初: モード選び(m0)
    - ノリノリながら版=全8手順: モード選び→再生してよく聞く→長押しでカード作成を繰り返す(この手順は長押しでは進まず、一時停止で次へ)→カード選択(その位置から再生)→位置の修正→長さの変更(もう一度長押し)→種類・文言の変更→保存。
    - お気に置きにいっちゃう版=全6手順: モード選び→文言を用意→ドラッグで位置を探る(指を止めると音が流れる。再生を押す手順はなし)→離してカード作成→長さは後で変えられる案内(位置の再編集)→保存。
   シェアポイント作成は 再生→始点→終点→リンク作成→完了 の全5手順(build 62のまま)。 */
let guide = null;   // {mode: "mk"|"sp", step: "m0"/"n2"〜"n8"/"nd"/"o2"〜"o6"/"od" / "sp1"〜"sp5"}
const GMSG = {
  m0: "作り方を選びます。下の「作成モード」のバーを開いて、どちらか1つを押してください。「♪ ノリノリながらモード」は曲を聞きながら長押しでカードを打つ作り方、「お気に置きにいっちゃうモード」は文言を先に作ってから置きに行く作り方です（あとから切り替えることもできます）",
  n2: "再生ボタンを押して、曲を再生します。まずはよく聞いて、コールの入るところを耳でつかみましょう",
  n3: "コールのところが来たら、口で言っている間だけ大きな「カード作成」ボタンを長押しします。押している間はタイムラインが2つ出て（全体と拡大）、カードが伸びていきます。離すと、その長さでカードが1つできます（短いタップだと5秒の仮カード）。そのまま聞き続けて、次のコールのところでも長押し→離す、を繰り返してください。カード作成を止めたいところで「一時停止」ボタンを押すと、次に進みます",
  n4: "作ったカードを直してみましょう。下の一覧で、直したいカードをタップして選択してください。選ぶと、そのカードの位置から再生が始まるので、どの部分のカードか音で確かめられます",
  n5: "選択中のカードを、もう一度タップしてください。内容のパネルが開くので、文言を書き換えたり種類を選び直したりして「決定」を押すと、その場で直ります",
  n6: "仕上げです。右上の「制作を終了」を押して、「登録する」（ログイン中は「下書きする」も選べます）を選んでください。名前・タイトルなどを入れて、最後の「決定」を押すと保存されて再生画面に戻ります。保存しない場合は「どちらもせずに終了」でも大丈夫です",
  nd: "できあがり！おつかれさまでした。ガイドモードは、再生画面の「ガイドモードで作成」ボタンでいつでも始められます",
  o2: "まずカードの中身を作ります。大きな「カード作成」ボタンを押してください。パネルが開くので、叫ぶコールを書いて「決定」、種類を選んでもう一度「決定」を押すと、未配置のカードができます",
  o3: "作ったカードを、下の一覧でタップして選択してください。選ぶと、真ん中のボタンが黄色く光る「置きに行く」に変わります",
  o4: "「置きに行く」ボタンを押さえたまま、左右に動かしてください。押している間はタイムラインが2つ出ます（元の位置に全体、画面中央に15秒の拡大）。音を聞きながら位置を探って、置きたい場所で指を離すと、そこにカードが置かれます",
  o5: "仕上げです。右上の「制作を終了」を押して、「登録する」（ログイン中は「下書きする」も選べます）を選んでください。名前・タイトルなどを入れて、最後の「決定」を押すと保存されて再生画面に戻ります。保存しない場合は「どちらもせずに終了」でも大丈夫です",
  od: "できあがり！おつかれさまでした。ガイドモードは、再生画面の「ガイドモードで作成」ボタンでいつでも始められます",
  sp1: "まず「再生」を押してください",
  sp2: "始点にしたい場所で『ここを始点にする』を押してください",
  sp3: "終点にしたい場所で『ここを終点にする』を押してください",
  sp4: "『シェアポイントを作成』を押すと、リンクが作られます",
  sp5: "できあがり！おつかれさまでした。ガイドモードは上のボタンでいつでもやめられます"
};
const GNUM = {m0: 1, n2: 2, n3: 3, n4: 4, n5: 5, n6: 6, nd: 6, o2: 2, o3: 3, o4: 4, o5: 5, od: 5, sp1: 1, sp2: 2, sp3: 3, sp4: 4, sp5: 5};
const GTARGETS = {
  m0: ["#mkDrawerBar", "#mkModeTabs .mktab"],
  n2: ["#play"],
  n3: ["#mkCreate", "#play"],
  n4: ["#mkList .mkpick"],
  n5: ["#mkList .mkpick", "#mkContentPanel input", "#mkContentPanel button"],
  n6: ["#mkFinishBtn", "#mkFinishOverlay button", "#mkFinishOverlay input"],
  nd: [],
  o2: ["#mkCreate", "#mkContentPanel input", "#mkContentPanel button"],
  o3: ["#mkList .mkpick"],
  o4: ["#play"],
  o5: ["#mkFinishBtn", "#mkFinishOverlay button", "#mkFinishOverlay input"],
  od: [],
  sp1: ["#spPlayBtn", "#play"],
  sp2: ["#spStep"],
  sp3: ["#spStep"],
  sp4: ["#spStep"],
  sp5: []
};
const GSCROLL = {m0: "#mkDrawerBar", n2: "#play", n3: "#mkCreate", n4: "#mkList", n5: "#mkList", n6: "#mkFinishBtn", o2: "#mkCreate", o3: "#mkList", o4: "#play", o5: "#mkFinishBtn", sp1: "#spPlayBtn", sp2: "#spStep", sp3: "#spStep", sp4: "#spStep"};
const GLOCK_SEL = "#mkFinishBtn,#mkFinishOverlay button,#mkFinishOverlay input,#mkContentPanel input,#mkContentPanel button,#mkAddUnplaced,#songsel,#bar,.skb,#play,#spPlayBtn,.ratebtn,#mkRateSelect,#mkCreate,#mkTypes button,#mkText,#mkFineM,#mkFineP,#mkDelBtn,#mkList .mkpick,#mkList .mkdel,#mkKnob,#mkVer,#mkNote,#mkRef,#mkCmt,#mkGuestName,#mkPubBtn,#mkSaveBtn,#mkPvBtn,.mkyameru,#mkDrawerBar,.drwBtn,.psChip,#spStep,.switchbtn,#mkModeTabs .mktab,#mkGrip,#mkChips .pchip,#mkPosScrub,.posStepB,#mkPosHere,#mkPosRestore,#mkSelClear,#mkTuneBtn,#tuneGain,#tuneDead,#tuneReset,#mkTlKnob";
function applyGuide() {
  const all = document.querySelectorAll(GLOCK_SEL);
  if (!guide) { all.forEach(el => el.classList.remove("glocked", "gtarget")); return; }
  all.forEach(el => { el.classList.add("glocked"); el.classList.remove("gtarget"); });
  (GTARGETS[guide.step] || []).forEach(s => document.querySelectorAll(s).forEach(el => { el.classList.remove("glocked"); el.classList.add("gtarget"); }));
}
function paintGuide() {
  const bar = $("guideBar"); if (!bar) return;
  const gb = $("mkGuideBtn"); if (gb) gb.textContent = guide ? "ガイドモードをやめる" : "ガイドモードで作る";
  if (!guide) { bar.style.display = "none"; applyGuide(); return; }
  bar.style.display = "block";
  const done = guide.step === "nd" || guide.step === "od" || guide.step === "sp5";
  const tot = guide.mode === "sp" ? 5 : ((guide.step.charAt(0) === "o" || (guide.step === "m0" && mkMode === "oki")) ? 5 : 6);   // プロトタイプ2: ながら版6手順 / お気に版5手順
  $("guideProg").textContent = done ? "完了しました" : "手順 " + (GNUM[guide.step] || "") + " / " + tot;
  $("guideMsg").textContent = GMSG[guide.step] || "";
  $("guideBtns").style.display = "none";   // build 64: 旧ガイドの「次のカード/保存へ」ボタンは使わない(残りの手順は操作そのもので進む)
  applyGuide();
}
function setGuideStep(s) {
  if (!guide) return;
  guide.step = s;
  paintGuide();
  const sc = GSCROLL[s] ? document.querySelector(GSCROLL[s]) : null;
  if (sc) setTimeout(() => { try { sc.scrollIntoView({behavior: "smooth", block: "center"}); } catch (e) {} }, 90);
}
function startGuide(mode) {
  guide = {mode: mode, step: mode === "sp" ? "sp1" : "m0"};
  if (mode === "mk") {
    clearMkOnboard();
    const drw = $("mkDrawer"); if (drw) drw.classList.add("open");
    const bar = $("mkDrawerBar"); if (bar) bar.setAttribute("aria-expanded", "true");
  }
  paintGuide();
}
function endGuide() { guide = null; paintGuide(); const drw = $("mkDrawer"); if (drw) drw.classList.remove("open"); const drwBar = $("mkDrawerBar"); if (drwBar) drwBar.setAttribute("aria-expanded", "false"); }
function guideEvent(name) {
  if (!guide) return;
  const st = guide.step;
  if (guide.mode === "sp") {
    if (name === "play" && st === "sp1") setGuideStep("sp2");
    else if (name === "spA" && st === "sp2") setGuideStep("sp3");
    else if (name === "spB" && st === "sp3") setGuideStep("sp4");
    else if (name === "spCreated" && st === "sp4") setGuideStep("sp5");
    else if (name === "cancel") endGuide();
    return;
  }
  /* build 64: 2モード制ガイドの遷移。ながら版の作成ループ(n3)は長押し・カード作成では進まず、「一時停止」を押したときだけ次へ進む */
  if (name === "cancel") { endGuide(); if (st === "n6" || st === "o5") toast("保存せずに終わりました"); return; }
  if (st === "m0" && name === "mode") setGuideStep(mkMode === "oki" ? "o2" : "n2");
  else if (st === "n2" && name === "play") setGuideStep("n3");
  else if (st === "n3" && name === "pause") setGuideStep("n4");
  else if (st === "n4" && name === "picked") setGuideStep("n5");
  else if (st === "n5" && name === "contentEdit") setGuideStep("n6");
  else if (st === "n6" && name === "saved") setGuideStep("nd");
  else if (st === "o2" && name === "contentDone") setGuideStep("o3");
  else if (st === "o3" && name === "picked") setGuideStep("o4");
  else if (st === "o4" && name === "drop") setGuideStep("o5");
  else if (st === "o5" && name === "saved") setGuideStep("od");
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]");
  if (b && A[b.dataset.a]) A[b.dataset.a](b.dataset.i, b);
});
document.addEventListener("change", e => { const b = e.target.closest("[data-c]"); if (b && A[b.dataset.c]) A[b.dataset.c](b.value, b); });
$("intro").addEventListener("click", () => { if ($("intro").style.display === "block") skipIntro(); });
$("cpos").addEventListener("input", e => { $("cards").style.bottom = 10 + +e.target.value + "px"; });
const mkDurEl = $("mkDur");   // build 58: 旧UIの表示時間スライダーは廃止したので、要素がある時だけ(互換)
if (mkDurEl) mkDurEl.addEventListener("input", e => { const v = $("mkDurVal"); if (v) v.textContent = e.target.value + "秒"; });
$("mkText").addEventListener("input", e => {   // build 58: カード編集中は、内容の入力がその場面へそのまま反映される
  if (mkSel >= 0 && mk.scenes[mkSel]) {
    mk.scenes[mkSel].x = e.target.value;
    const rows = $("mkList").querySelectorAll(".mkcard .mkx");
    if (rows[mkSel]) rows[mkSel].textContent = e.target.value;
  }
  guideEvent("text");
});
document.addEventListener("input", e => {
  const sl = e.target.closest("[data-dur]");
  if (sl) { const sc = mk.scenes[+sl.dataset.dur]; if (sc) { sc.d = parseFloat(sl.value); const v = sl.closest(".mkrow").querySelector(".durval"); if (v) v.textContent = sl.value + "秒"; } }
});
/* build 59: シークバー上のカードつまみ(ドラッグで開始位置を0.1秒刻みで移動。長さは不変) */
(function () {
  const kn = $("mkKnob"), wrap = $("barin");
  if (!kn || !wrap) return;
  let dragK = false;
  const move = e => {
    if (!dragK) return;
    const sc = mk.scenes[mkSel]; if (!sc) return;
    const r = wrap.getBoundingClientRect(); if (!r.width) return;
    const D = Math.max(dur() || 0, 1);
    let t = Math.round(((e.clientX - r.left) / r.width * D) * 10) / 10;
    t = Math.max(0, Math.min(Math.max(0, D - sc.d), t));
    if (t === sc.t) return;
    sc.t = t;
    mkSortScenes();
    mkSel = mk.scenes.indexOf(sc);
    renderMk();
  };
  kn.addEventListener("pointerdown", e => { if (mkSel < 0 || screen !== "mk") return; dragK = true; try { kn.setPointerCapture(e.pointerId); } catch (err) {} kn.classList.add("drag"); e.preventDefault(); e.stopPropagation(); });
  kn.addEventListener("pointermove", move);
  const end = () => { const was = dragK; dragK = false; kn.classList.remove("drag"); if (was) guideEvent("knob"); };
  kn.addEventListener("pointerup", end);
  kn.addEventListener("pointercancel", end);
})();
/* build 64: 大きなボタンの長押し(ノリノリながらモードの打ち方 / 選択中カードの長さ決め直し)。
   短いタップ(0.25秒未満)は従来のクリック(mkMain: カード作成/長さ指定/ここで終わり)に任せ、長押しになった時だけこちらで処理し、続くクリックは mkHoldClickAt で握りつぶす。
   長さ指定の計測中(mkLenPhase==="run")は長押しを無効にして、従来の「ここで終わり」タップだけが効くようにする */
(function () {
  const btn = $("mkCreate"); if (!btn) return;
  const drawPrev = () => {
    const h = mkHoldSt; if (!h) return;
    const inner = $("mkTlInner"); if (!inner) return;
    let el = $("mkTlPrev");
    if (!el) { el = document.createElement("div"); el.id = "mkTlPrev"; inner.appendChild(el); }
    const d = mkTlD();
    const li = Math.max(0, MK_TL_KINDS.indexOf(h.rel ? h.rel.k : mk.type));
    const ax = mkTlAxis();   /* v53: 通常表示側のプレビューは主軸で、拡大表示側は曲全体軸で(それぞれの表示に合わせる) */
    el.style.left = ((h.t0 - ax.a) / ax.span * 100) + "%";
    el.style.width = Math.max(1.2, h.d / ax.span * 100) + "%";
    el.style.top = (li * 23 + 2) + "px";
    el.textContent = h.d.toFixed(1) + "秒";
    const zinner = $("mkTlZoomInner");
    if (zinner) {
      let zel = $("mkTlZoomPrev");
      if (!zel) { zel = document.createElement("div"); zel.id = "mkTlZoomPrev"; zinner.appendChild(zel); }
      zel.style.left = (h.t0 / d * 100) + "%"; zel.style.width = Math.max(1.2, h.d / d * 100) + "%"; zel.style.top = el.style.top;
      zel.textContent = el.textContent;
    }
  };
  const upd = () => {
    const h = mkHoldSt; if (!h) return;
    const el = (performance.now() - h.at) / 1000;
    h.d = Math.min(20, Math.max(0.5, Math.round(el * 10) / 10));   // 実際に押していた時間(壁時計)で測るので、再生のもたつきに左右されない
    drawPrev();
    mkTlCenter = h.t0 + h.d / 2; mkTlApplyView();
    if (h.rel) { const pt = $("mkPosTime"); if (pt) pt.textContent = fmt(h.rel.t) + "〜" + fmt(h.rel.t + h.d); }
  };
  const end = commit => {
    const h = mkHoldSt; if (!h) return;
    mkHoldSt = null;
    clearInterval(h.timer);
    const el = (performance.now() - h.at) / 1000;
    const pv = $("mkTlPrev"); if (pv) pv.remove();
    const zpv = $("mkTlZoomPrev"); if (zpv) zpv.remove();
    mkSetZoom(false);
    // 短いタップ: 従来の働き(カード作成/長さ指定の開始)をここで直接実行する(ブラウザによって pointerdown の preventDefault で click が来ない場合があるため)。実行後に印を付け、続きで来るネイティブクリックは握りつぶす
    if (el < 0.25) { if (commit) A.mkMain(); mkHoldClickAt = Date.now(); return; }
    mkHoldClickAt = Date.now();   // 長押しとして処理したので、続くクリックは握りつぶす
    if (h.rel) {   // 選択中カードの長さ決め直し: 0.3秒以上押した場合だけ確定(うっかり触れただけでは変えない)
      if (commit && el >= 0.3) { h.rel.d = p2RangeSpan(h.rel.t, h.d); renderMk(); toast("「" + (h.rel.x || LAB[h.rel.k]) + "」の長さを " + h.rel.d.toFixed(1) + " 秒に決め直しました"); guideEvent("lenDone"); }
      else renderMk();
      return;
    }
    if (!commit) return;
    // 新規カード: 押した位置から、押していた長さで作る。種類・文言は「次に作るカード」の設定を使う
    // v47: 長押し中に再生が範囲の終わりで止まっても壁時計で測り続けるため、長さが範囲を超える場合は範囲内に収める
    const sc = {t: h.t0, d: p2RangeSpan(h.t0, h.d), placed: true, k: mk.type, x: $("mkText").value.trim()};
    mk.scenes.push(sc); mkSortScenes();
    if (sc.x) $("mkText").value = "";
    renderMk();
    const L = $("mkList"); if (L) L.scrollTop = L.scrollHeight;
    toast(fmt(sc.t) + " にカードを作りました(" + sc.d.toFixed(1) + "秒)");
    guideEvent("card");
  };
  btn.addEventListener("pointerdown", e => {
    if (screen !== "mk" || mkLenPhase === "run") return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    if (mkMode === "oki") { mkHoldClickAt = Date.now(); openMkContentPanel(null); return; }
    let t0 = p2RangeClamp(Math.round(clampT(now()) * 10) / 10, 0.5);   // v47: 打ち込み開始位置も絞った範囲内に閉じる(末尾0.5秒は長さの最低分)
    mkHoldSt = {t0: t0, at: performance.now(), d: 0.5, rel: null, timer: null};
    mkSetZoom(true, t0);
    mkHoldSt.timer = setInterval(upd, 50);
    upd();
  });
  btn.addEventListener("pointerup", () => end(true));
  btn.addEventListener("pointercancel", () => end(false));
  btn.addEventListener("contextmenu", e => e.preventDefault());
})();
/* build 64: タイムラインのバーをタップ → そのカードを選択(選ぶと、その位置から再生が始まる)。すでに選択中のバーは、もう一度その位置から再生し直す */
$("mkTlInner").addEventListener("click", e => {
  const b = e.target && e.target.closest ? e.target.closest("[data-mksel]") : null;
  if (!b) return;
  const i = +b.getAttribute("data-mksel");
  if (mkSel !== i) { A.mkPick(i); return; }
  const sc = mk.scenes[i];
  if (sc && playerReady()) { playerSeek(sc.t); playerPlay(); }
});
/* build 64: タイムライン内のつまみ(選択中カードの位置)。ドラッグ中はタイムラインが拡大表示になり、再生位置もついてくる */
(function () {
  const kn = $("mkTlKnob"); if (!kn) return;
  let kd = null;
  kn.addEventListener("pointerdown", e => {
    const sc = mk.scenes[mkSel]; if (!sc) return;
    e.preventDefault(); e.stopPropagation();
    try { kn.setPointerCapture(e.pointerId); } catch (err) {}
    kd = {pid: e.pointerId, sc: sc, lastSeek: null};
    mkSetZoom(true, sc.t);
    if (playerReady()) playerPlay();
  });
  kn.addEventListener("pointermove", e => {
    if (!kd || e.pointerId !== kd.pid) return;
    const sc = kd.sc; if (mk.scenes.indexOf(sc) < 0) return;
    const slide = $("mkTlSlide"), r = slide.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
    const ax = mkTlAxis(), D = mkTlD();   /* v53: 表示と同じ主軸で変換する(従来は拡大表示の15秒窓とも通常表示の曲全体とも違う、30秒窓で変換していた) */
    let t = ax.a + ratio * ax.span;
    t = p2RangeClamp(Math.max(0, Math.min(Math.max(0, D - sc.d), Math.round(t * 10) / 10)), sc.d);   // v47: つまみドラッグも範囲内に閉じる
    sc.t = t; mkTlCenter = t; mkTlApplyView(); paintKnob();
    const pt = $("mkPosTime"); if (pt) pt.textContent = fmt(t) + "〜" + fmt(t + sc.d);
    if (kd.lastSeek === null || Math.abs(t - kd.lastSeek) >= 0.15) { kd.lastSeek = t; playerSeek(t); }
  });
  const end = () => {
    if (!kd) return;
    const sc = kd.sc; kd = null;
    mkSetZoom(false);
    if (mk.scenes.indexOf(sc) >= 0) { mkSortScenes(); mkSel = mk.scenes.indexOf(sc); }
    renderMk();
    guideEvent("knob");
  };
  kn.addEventListener("pointerup", end);
  kn.addEventListener("pointercancel", end);
  kn.addEventListener("contextmenu", e => e.preventDefault());
})();
/* build 64: 選択中カードの位置スクラブ(「押さえて左右に動かす」)。新規カードのスクラブと同じ絶対位置対応・デッドゾーン・追従・指止め再生で、選択中カードの開始位置を動かす */
(function () {
  const btn = $("mkPosScrub"); if (!btn) return;
  const end = e => {
    const st = mkPosScrSt; if (!st) return;
    if (st.settle) clearTimeout(st.settle);
    const was = st.active, sc = st.sc;
    mkPosScrSt = null;
    if (!was) return;
    if (e && e.clientX != null && mk.scenes.indexOf(sc) >= 0) sc.t = p2RangeClamp(Math.max(0, Math.min(Math.max(0, mkTlD() - sc.d), Math.round(mkBandAbs(e.clientX) * 10) / 10)), sc.d);   // v47: 範囲内に閉じる
    mkSetZoom(false);
    mkSortScenes(); mkSel = mk.scenes.indexOf(sc);
    renderMk();
    guideEvent("tweak");
  };
  btn.addEventListener("pointerdown", e => {
    const sc = mk.scenes[mkSel]; if (!sc) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    mkPosScrSt = {pid: e.pointerId, x0: e.clientX, anchorX: e.clientX, active: false, target: sc.t, lastSeek: null, sc: sc, settle: null, lastX: e.clientX};
  });
  btn.addEventListener("pointermove", e => {
    const st = mkPosScrSt; if (!st || e.pointerId !== st.pid) return;
    const sc = st.sc; if (mk.scenes.indexOf(sc) < 0) return;
    if (!st.active) {
      if (Math.abs(e.clientX - st.x0) <= mkTune.dead) return;
      st.active = true; st.anchorX = e.clientX;
      mkSetZoom(true, sc.t);
      if (playerReady()) playerPlay();
    } else if (Math.abs(e.clientX - st.anchorX) <= mkTune.dead) { return; }
    else { st.anchorX = e.clientX; }
    const absT = mkBandAbs(e.clientX), g = mkTune.gain;
    let target = g >= 1 ? absT : st.target + (absT - st.target) * g;
    target = p2RangeClamp(Math.max(0, Math.min(Math.max(0, mkTlD() - sc.d), Math.round(target * 10) / 10)), sc.d);   // v47: 範囲内に閉じる
    st.target = target; sc.t = target; mkTlCenter = target; mkTlApplyView(); paintKnob();
    const pt = $("mkPosTime"); if (pt) pt.textContent = fmt(target) + "〜" + fmt(target + sc.d);
    if (st.lastSeek === null || Math.abs(target - st.lastSeek) >= 0.15) { st.lastSeek = target; playerSeek(target); }
    st.lastX = e.clientX;
    if (st.settle) clearTimeout(st.settle);
    st.settle = setTimeout(() => {
      if (!mkPosScrSt || !mkPosScrSt.active) return;
      const sc2 = mkPosScrSt.sc; if (mk.scenes.indexOf(sc2) < 0) return;
      const t = p2RangeClamp(Math.max(0, Math.min(Math.max(0, mkTlD() - sc2.d), Math.round(mkBandAbs(mkPosScrSt.lastX) * 10) / 10)), sc2.d);   // v47: 範囲内に閉じる
      mkPosScrSt.target = t; mkPosScrSt.lastSeek = t; sc2.t = t; mkTlCenter = t; mkTlApplyView(); paintKnob();
      const pt2 = $("mkPosTime"); if (pt2) pt2.textContent = fmt(t) + "〜" + fmt(t + sc2.d);
      playerSeek(t); if (playerReady()) playerPlay();
    }, 320);
  });
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", () => end(null));
  btn.addEventListener("contextmenu", e => e.preventDefault());
})();
/* build 64: 手打ちテキストの「つかむ」にもスクラブを付ける(種類は現在の種類ボタン、文言は入力欄の内容) */
const mkGripEl = $("mkGrip");
if (mkGripEl) mkBindScr(mkGripEl, () => ({k: mk.type, x: $("mkText").value.trim() || LAB[mk.type], grip: true}), false);
/* プロトタイプ2 移植3: 置きに行くボタン。本番のスクラブ仕組み(mkScrStart/Move/End)をそのまま使い、押した瞬間からゴーストと拡大タイムラインを出す */
function bindMkPlaceButton() {
  const b = $("play"); if (!b || b.dataset.mkPlaceBound) return;
  b.dataset.mkPlaceBound = "1";
  b.addEventListener("pointerdown", e => {
    if (screen !== "mk" || mkMode !== "oki") return;
    const sc = mkSel >= 0 ? mk.scenes[mkSel] : null;
    if (!sc || mkIsPlaced(sc)) { e.preventDefault(); return; }
    mkScrStart(e, {k: sc.k, x: sc.x, scene: sc, fromPlaceButton: true}, b);
    mkScrSt.active = true;
    mkScrSt.moved = false;
    mkShowGhost(e, mkScrSt.src, mkScrSt.seek0);
    if (mkGhost) mkGhost.classList.add("round");
    mkSetZoom(true, mkScrSt.seek0);
    if (playerReady()) playerPlay();
  });
  b.addEventListener("pointermove", e => { if (mkScrSt && mkScrSt.src.fromPlaceButton) mkScrMove(e); });
  b.addEventListener("pointerup", e => { if (mkScrSt && mkScrSt.src.fromPlaceButton) mkScrEnd(true, e.clientX); });
  b.addEventListener("pointercancel", () => { if (mkScrSt && mkScrSt.src.fromPlaceButton) mkScrEnd(false); });
  b.addEventListener("contextmenu", e => { if (screen === "mk" && mkMode === "oki") e.preventDefault(); });
}
bindMkPlaceButton();
/* プロトタイプ2 移植4: 制作を終了フローのボタンは data-a 委譲から分離して直接結び付ける */
const finishStartBtn = $("mkFinishBtn");
const finishNextBtn = $("mkFinishNext");
const finishCancelBtn = $("mkFinishCancel");
const finishDraftBtn = $("mkFinishDraftSave");
const finishRegisterBtn = $("mkFinishRegister");
const finishNoSaveBtn = $("mkFinishNoSave");
const finishChoiceCancelBtn = $("mkFinishChoiceCancel");
if (finishStartBtn) finishStartBtn.addEventListener("click", openMkFinish);
if (finishNextBtn) finishNextBtn.addEventListener("click", e => { e.preventDefault(); advanceMkFinish(); });
if (finishCancelBtn) finishCancelBtn.addEventListener("click", e => { e.preventDefault(); cancelMkFinish(); });
if (finishDraftBtn) finishDraftBtn.addEventListener("click", e => { e.preventDefault(); chooseMkFinish(false); });
if (finishRegisterBtn) finishRegisterBtn.addEventListener("click", e => { e.preventDefault(); chooseMkFinish(true); });
if (finishNoSaveBtn) finishNoSaveBtn.addEventListener("click", e => { e.preventDefault(); finishMkWithoutSave(); });
if (finishChoiceCancelBtn) finishChoiceCancelBtn.addEventListener("click", e => { e.preventDefault(); cancelMkFinish(); });
const finishInput = $("mkFinishInput");
if (finishInput) finishInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); advanceMkFinish(); } });
/* build 64: 操作感の調整(即時反映・localStorage保存) */
const tuneGainEl = $("tuneGain"); if (tuneGainEl) tuneGainEl.addEventListener("input", e => { mkTune.gain = parseFloat(e.target.value) || 0.5; try { localStorage.setItem("momo_drag_gain", String(mkTune.gain)); } catch (err) {} paintTune(); });
const tuneDeadEl = $("tuneDead"); if (tuneDeadEl) tuneDeadEl.addEventListener("input", e => { mkTune.dead = Math.round(parseFloat(e.target.value) || 0); try { localStorage.setItem("momo_drag_dead", String(mkTune.dead)); } catch (err) {} paintTune(); });
const tuneResetEl = $("tuneReset"); if (tuneResetEl) tuneResetEl.addEventListener("click", () => { mkTune.gain = 0.5; mkTune.dead = 14; try { localStorage.setItem("momo_drag_gain", "0.5"); localStorage.setItem("momo_drag_dead", "14"); } catch (err) {} paintTune(); toast("操作感を最初の値に戻しました"); });
const mkTuneBtnEl = $("mkTuneBtn"); if (mkTuneBtnEl) mkTuneBtnEl.addEventListener("click", () => { const p = $("mkTunePanel"); const on = p.classList.toggle("on"); mkTuneBtnEl.setAttribute("aria-expanded", on ? "true" : "false"); });
paintTune();
/* build 64: 作成画面を開いている間だけ、タイムラインの再生ヘッドと拡大表示の追従を更新する */
setInterval(() => {
  if (screen !== "mk") return;
  if (Math.abs(mkTlD() - mkTlLastD) > 1) { mkTlLastD = mkTlD(); renderMkTl(); return; }
  const axNow = mkTlAxis(), akNow = axNow.a + "/" + axNow.span;   /* v53: 範囲の絞り/戻しで主軸が変わったら描き直す */
  if (akNow !== mkTlLastAxis) { mkTlLastAxis = akNow; renderMkTl(); return; }
  if (mkTlZoom && !mkScrSt && !mkPosScrSt && !mkHoldSt) mkTlCenter = now() || 0;
  mkTlApplyView();
}, 250);
document.addEventListener("fullscreenchange", () => { if (native && !document.fullscreenElement && $("mv").classList.contains("fs")) A.fs(); });
/* build 62: ウェルカムカード。「表示しない」にチェックして閉じた場合のみ、次回から出さない */
try { if (!localStorage.getItem("momo_welcome_hide")) $("welcome").classList.add("on"); } catch (e) {}

/* ================= プロトタイプ2 v51: 統合UIを承認済みイラストに一致させる作り直し =================
   祐治の実機確認で出た6件の指摘への対応:
   1. 作成レイヤーでも右の付箋(操作/一覧/タイムライン)を常時表示し、タップ/スライドで切り替えられるようにする
      → 作成パネル(#mk)の右端に、三層ステージと同じ見た目の付箋帯を置く。選ぶと再生側の
        該当シートが上に出る(作りかけは保持され、一覧/タイムラインはプレビューになる)
   2. 作成画面の下に残っていたイラストにない部品(プリセット/種類/文言入力/手ブレ抑制/作成モード
      引き出し等)を常時表示から外し、並び順をイラストどおりにする
      → 並び: 範囲絞りバー → シークバー → 曲全体タイムライン → 制作タイムライン → 再生の段
        → カード一覧 → 下書き保存/登録。シークバー等の共用部品は、作成画面に入る時に #mk の
        中へ物理的に移し、出る時に元の場所へ戻す(プレイヤー #mvwrap は従来どおり動かさない)。
        文言と種類は内容パネルで完結させ、プリセットも内容パネルの中から選べるようにする
   3. お気に置くドラッグ中、指を止めたら場所を問わずその位置で再生されるようにする(v49側で対応)
   4. 曲全体タイムラインが作成画面で消えていた問題(v48側の移動先がステージ内だった)を、
      この配置処理で #mk 内へ移すことで解消する。赤=範囲/白線=真ん中/再生位置の線は v44・v48 の描画をそのまま使う
   5. 作成中に曲を変えると再生画面へ移ってしまう問題(loadCalls の参考コール自動適用を、
      作成表示中は行わないよう本体側で対応)
   6. カードの時刻・文言・長さがそれぞれ単独で反応するようにする(v48のカード描画と v49の
      ハンドラで対応。カード全体を1つのボタンにしない) */
(function p2Uni51() {
  try {
    var st = document.createElement("style"); st.id = "p2Uni51Styles";
    st.textContent = [
      /* --- 2: イラストにない常時表示部品を外す(v48の強制表示を上書き) --- */
      "body.scr-mk.p2uni #mkPresets,body.scr-mk.p2uni #mkApplyNote,body.scr-mk.p2uni #mkTypes,body.scr-mk.p2uni .mkTextRow,body.scr-mk.p2uni #mkTuneBtn,body.scr-mk.p2uni #mkTunePanel{display:none!important}",
      "body.scr-mk.p2uni #mkDrawer{display:none!important}",
      "body.scr-mk.p2uni #mk>h2{display:none!important}",
      /* v48が付けた order は、DOM移動で並べる v51 では邪魔になるので全部 0 に戻す */
      "body.scr-mk.p2uni #mkTlBox,body.scr-mk.p2uni .mk-card-list,body.scr-mk.p2uni #mkPresets,body.scr-mk.p2uni #mkApplyNote,body.scr-mk.p2uni #mkTypes,body.scr-mk.p2uni .mkTextRow,body.scr-mk.p2uni #mkTuneBtn,body.scr-mk.p2uni #mkTunePanel{order:0}",
      /* --- 作成パネル: 右端に付箋帯の受け皿(32px)を確保 --- */
      "body.scr-mk.p2uni #mk{position:relative;padding-right:42px}",
      /* --- 1: 作成レイヤー右端の付箋帯(三層ステージの付箋と同じ見た目) --- */
      "#p2Uni51Tabs{display:none}",
      "body.scr-mk.p2uni #p2Uni51Tabs{display:flex;flex-direction:column;gap:6px;position:absolute;right:2px;top:6px;z-index:65}",
      "#p2Uni51Tabs .p2u51-tab{width:28px;padding:11px 0;border:0;border-radius:0 9px 9px 0;writing-mode:vertical-rl;font-size:12px;font-weight:900;letter-spacing:.14em;box-shadow:2px 3px 8px rgba(0,0,0,.45);cursor:pointer;font-family:inherit;touch-action:none}",
      "#p2Uni51Tabs .p2u51-tab-ctrl{background:#ff7ab8;color:#2a0c1c}",
      "#p2Uni51Tabs .p2u51-tab-list{background:#ffd23f;color:#2a2410}",
      "#p2Uni51Tabs .p2u51-tab-tl{background:#4dc9ff;color:#0b2233;font-size:11px;letter-spacing:.1em;padding:8px 0}",
      "#p2Uni51Tabs .p2u51-tab-hot{filter:brightness(1.22);box-shadow:0 0 0 2px #fff,2px 3px 10px rgba(0,0,0,.55)}",
      /* --- 6: ゾーンのボタンは指で押しやすい広さにする --- */
      "#mkList .p2uni-zone{padding-top:8px;padding-bottom:8px}",
      /* --- 2: 内容パネル内のプリセット --- */
      ".p2u51-cp-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}",
      ".p2u51-cp-presets:empty{display:none}",
      ".p2u51-cp-plab{width:100%;font-size:11px;font-weight:700;color:#9aa3c7}",
      "#mkContentPanel .p2u51-cp-chip{min-height:36px;padding:6px 10px;font-size:12px;border-radius:999px}"
    ].join("\n");
    document.head.appendChild(st);

    var mkSec = document.getElementById("mk");
    var tlBox = document.getElementById("mkTlBox");
    var mvBox = document.getElementById("mv");

    /* ---------- 2+4: 作成レイヤーの並び替え(共用部品の出し入れ) ---------- */
    var arranged = false;
    var homes = [];   /* {el, parent, next} 戻し先の記録 */
    function remember(el) {
      if (!el || !el.parentNode) return;
      for (var i = 0; i < homes.length; i++) if (homes[i].el === el) return;
      homes.push({el: el, parent: el.parentNode, next: el.nextSibling});
    }
    function arrange() {
      if (arranged || !mkSec || !tlBox) return;
      var stage = document.getElementById("p2LayerStage");
      if (stage && stage.classList.contains("p2lt-active")) return;   /* ステージ解除(v43)が先。次周期でやり直す */
      var barwrap = document.getElementById("barwrap");
      var songTl = document.getElementById("p2SongTl");
      var row1 = document.querySelector(".p2row1");
      var playrow = document.querySelector(".playrow");
      if (!barwrap || !row1 || !playrow) return;
      [barwrap, songTl, row1, playrow].forEach(remember);
      /* 範囲絞りバー(#p2RangeBar)は元々 #mvwrap の直下 = #mk より前にあるので動かさない。
         ここでは #mk の中を「シークバー → 全体タイムライン → 制作タイムライン → 再生の段
         → カード一覧 → 保存/登録」の順に組み立てる */
      mkSec.insertBefore(barwrap, tlBox);
      if (songTl) mkSec.insertBefore(songTl, tlBox);
      mkSec.insertBefore(row1, tlBox.nextSibling);
      mkSec.insertBefore(playrow, row1.nextSibling);
      arranged = true;
      try { if (window.__p2Range && window.__p2Range.reset) window.__p2Range.reset(); } catch (e) {}   /* 全体タイムラインの赤を現在の範囲で描き直す */
    }
    function restore() {
      if (!arranged) return;
      arranged = false;
      for (var i = homes.length - 1; i >= 0; i--) {
        var h = homes[i];
        if (h.el.parentNode === mkSec) {
          if (h.el.id === "p2SongTl" && mvBox) mvBox.appendChild(h.el);   /* 全体タイムラインの定位置は動画の中(v44) */
          else if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(h.el, h.next);
          else h.parent.appendChild(h.el);
        }
      }
      homes = [];
    }
    function syncArrange() {
      var inMk = document.body.classList.contains("scr-mk");
      if (inMk) arrange(); else restore();
    }

    /* ---------- 1: 作成レイヤー右端の付箋帯 ---------- */
    var pendingSheet = null, sheetTimer = null;
    function goToSheet(which) {
      pendingSheet = which;
      if (document.body.classList.contains("scr-mk")) { try { exitMk(); } catch (e) {} }
      if (sheetTimer) return;
      var started = Date.now();
      sheetTimer = setInterval(function () {
        if (!pendingSheet || Date.now() - started > 3000) {
          clearInterval(sheetTimer); sheetTimer = null; pendingSheet = null; return;
        }
        var stage = document.getElementById("p2LayerStage");
        if (stage && stage.classList.contains("p2lt-active")) {
          var btn = stage.querySelector(".p2lt-tab-" + pendingSheet);
          if (btn) { var t = pendingSheet; pendingSheet = null; clearInterval(sheetTimer); sheetTimer = null; btn.click(); }
        }
      }, 40);
    }
    var tabsBox = null;
    if (mkSec) {
      tabsBox = document.createElement("div"); tabsBox.id = "p2Uni51Tabs";
      tabsBox.setAttribute("aria-label", "再生側のレイヤーへ切り替え");
      [["ctrl", "操作"], ["list", "一覧"], ["tl", "タイムライン"]].forEach(function (pair) {
        var b = document.createElement("button"); b.type = "button";
        b.className = "p2u51-tab p2u51-tab-" + pair[0]; b.textContent = pair[1]; b.dataset.sheet = pair[0];
        b.setAttribute("aria-label", pair[1] + "を上に表示する(作りかけは残ります)");
        tabsBox.appendChild(b);
      });
      mkSec.appendChild(tabsBox);
    }
    var stripSlide = null;
    function stripTabAt(x, y) {
      if (!tabsBox) return null;
      var found = null;
      tabsBox.querySelectorAll(".p2u51-tab").forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.width > 0 && x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 4 && y <= r.bottom + 4) found = b.dataset.sheet;
      });
      return found;
    }
    function paintStripHot(which) {
      if (!tabsBox) return;
      tabsBox.querySelectorAll(".p2u51-tab").forEach(function (b) { b.classList.toggle("p2u51-tab-hot", b.dataset.sheet === which); });
    }
    if (tabsBox) {
      tabsBox.addEventListener("pointerdown", function (e) {
        var which = stripTabAt(e.clientX, e.clientY);
        if (!which) return;
        e.preventDefault();
        stripSlide = {id: e.pointerId, target: which};
        paintStripHot(which);
        goToSheet(which);
      });
      window.addEventListener("pointermove", function (e) {
        if (!stripSlide || e.pointerId !== stripSlide.id) return;
        var which = stripTabAt(e.clientX, e.clientY);
        if (which && which !== stripSlide.target) { stripSlide.target = which; paintStripHot(which); goToSheet(which); }
      });
      var endStrip = function (e) {
        if (!stripSlide || (e && e.pointerId !== stripSlide.id)) return;
        stripSlide = null; paintStripHot(null);
      };
      window.addEventListener("pointerup", endStrip);
      window.addEventListener("pointercancel", endStrip);
    }

    /* ---------- 2: プリセットを内容パネルの中で選べるようにする ---------- */
    var cpBox = null, cpSig = "__none__";
    function renderCpPresets() {
      var step = document.getElementById("mkContentTextStep");
      if (!step) return;
      if (!cpBox) {
        cpBox = document.createElement("div"); cpBox.className = "p2u51-cp-presets"; cpBox.id = "p2Uni51CpPresets";
        step.appendChild(cpBox);
        cpBox.addEventListener("click", function (e) {
          var b = e.target && e.target.closest ? e.target.closest("[data-cp]") : null;
          if (!b) return;
          var p = PRESETS[+b.dataset.cp]; if (!p) return;
          var inp = document.getElementById("mkContentTextInput");
          if (inp) inp.value = p.x;
          try { mkCpType = p.k; } catch (err) {}
          try { paintMkContentPanel(); } catch (err) {}
          toast("プリセット「" + p.x + "」を入れました。種類を確認して決定してください");
        });
      }
      var sig = PRESETS.map(function (p) { return p.x; }).join("|");
      if (sig === cpSig) return;
      cpSig = sig;
      if (!PRESETS.length) { cpBox.innerHTML = ""; return; }
      cpBox.innerHTML = '<span class="p2u51-cp-plab">プリセットから入れる</span>' + PRESETS.map(function (p, i) {
        return '<button type="button" class="p2u51-cp-chip" data-cp="' + i + '">' + esc(p.x) + '</button>';
      }).join("");
    }
    var panel = document.getElementById("mkContentPanel");
    if (panel) {
      var pmo = new MutationObserver(function () {
        if (panel.style.display === "flex") renderCpPresets();
      });
      pmo.observe(panel, {attributes: true, attributeFilter: ["style"]});
    }
    renderCpPresets();

    /* ---------- 同期 ---------- */
    var mo = new MutationObserver(syncArrange);
    mo.observe(document.body, {attributes: true, attributeFilter: ["class"]});
    setInterval(syncArrange, 400);
    syncArrange();

    window.__p2Uni = {version: 51};
    window.__p2Uni51 = {arrange: arrange, restore: restore, goToSheet: goToSheet,
      get arranged() { return arranged; }, tabsEl: tabsBox};
  } catch (e) { try { console.warn("p2Uni51", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v52: 実機フィードバック3件 =================
   1. 編集するカードは一番上に固定: 編集中(編集ボードが開いている / 内容パネルで編集中)の
      カードを、新規作成カードの直下へ出して上に固定する。描画の並べ替えは v48 の
      __p2UniCards 側で行い、ここでは固定表示(.p2uni-pinned)の見た目を持つ。
      固定は #mkList 内の position:sticky で、編集中に一覧をスクロールしてもカードと
      編集ボードが上に留まる。編集が終われば(ボードを閉じる/決定)通常の並びに戻る
   2. お気に置くボタンは付箋式に: 各カード中央の常時丸ボタンは、他の項目と混雑して
      押しにくいので廃止。選択中のカードにだけ、その上辺に付箋のようにピロッと
      飛び出したタブとして出す(描画は v48 側で選択中のカードにのみ生成し、見た目は
      ここで v49 の丸ボタン用スタイルを上書きする)。ドラッグの挙動は v49/v51 のまま
   3. プレビューで作りかけのカードが流れる: プレビューONの間は、再生側のカード演出
      (本体 loop の UI.cards / UI.nexts)の対象も作りかけのシーンにする(loop 側で対応)。
      ここでは __p2UniPreviewScenes にシグネチャキャッシュを付け、毎フレームの
      再計算と配列の作り直しを避ける(中身の決め方は v50 と同じ) */
(function p2Uni52() {
  try {
    var st = document.createElement("style"); st.id = "p2Uni52Styles";
    st.textContent = [
      /* --- 1: 編集中カードの固定表示 --- */
      ".p2uni-pinned{position:sticky;top:0;z-index:6;background:#14152b;padding:16px 0 6px;border-radius:0 0 12px 12px;box-shadow:0 12px 20px rgba(0,0,0,.5)}",
      ".p2uni-pinned .p2uni-card.sel{margin-top:0}",
      /* --- 2: お気に置く付箋タブ(v49の中央丸ボタンを上書き) --- */
      ".p2uni-place{top:-14px;transform:translateX(-50%);width:auto;height:25px;padding:0 14px;border-radius:10px 10px 0 0;border-bottom:0;background:rgba(77,201,255,.95);color:#07304a;font-size:11px;font-weight:900;font-family:inherit;line-height:1;box-shadow:0 -3px 9px rgba(0,0,0,.45);z-index:4}",
      ".p2uni-place:after{display:none}",
      "#mkList .p2uni-card.sel{margin-top:18px}"
    ].join("\n");
    document.head.appendChild(st);

    /* --- 1b: 内容パネルで編集中のカードも固定の対象にする ---
       パネルが開いている間は一覧が再描画されないため、開閉のタイミングで描き直して
       対象カードの固定/解除を反映する(パネル自体はモーダルなので一覧の再描画と干渉しない) */
    var cpPanel = document.getElementById("mkContentPanel");
    if (cpPanel) {
      var cpWasOpen = cpPanel.style.display === "flex";
      var cpMo = new MutationObserver(function () {
        var open = cpPanel.style.display === "flex";
        if (open === cpWasOpen) return;
        cpWasOpen = open;
        if (document.body.classList.contains("scr-mk")) { try { renderMk(); } catch (e) {} }
      });
      cpMo.observe(cpPanel, {attributes: true, attributeFilter: ["style"]});
    }

    /* --- 3: プレビューシーンのキャッシュ付き公開(v50の同名関数を置き換える) --- */
    var pvSig = "__none__", pvVal = null;
    window.__p2UniPreviewScenes = function () {
      var S = window.__p2Uni50;
      if (!S || !S.session || !S.pvOn) { pvSig = "__none__"; pvVal = null; return null; }
      var sig = mk.scenes.map(function (s) { return s.t + "," + s.d + "," + s.k + "," + s.x + "," + (s.placed ? 1 : 0); }).join("|");
      if (sig === pvSig) return pvVal;
      pvSig = sig;
      try { pvVal = mkPlaybackScenes(mk.scenes); } catch (e) { pvVal = null; }
      return pvVal;
    };

    window.__p2Uni = {version: 52};
    window.__p2Uni52 = { get pvSig() { return pvSig; } };
  } catch (e) { try { console.warn("p2Uni52", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v53: 座標軸の照合と修正 =================
   祐治の指示で、シークバーと各タイムラインとドラッグ操作について「表示の座標軸」と
   「操作の座標変換」を実物で全部照合し、ずれていた所だけを直した(修正は各所の本体側)。
   照合結果:
   - シークバー: 表示(bar.value=再生位置 / max=曲の長さ)と操作(change→その値へシーク)は
     同じ曲全体軸で一致していた。そのまま(絞り中もシークバーは曲全体、という従来仕様も維持)
   - シークバー上の選択カード帯(paintKnob): 曲全体軸で一致していた
   - 曲全体タイムラインの赤い範囲と真ん中の線(v44 paintTl): 登録範囲 or 曲全体の軸で一致していた
   - 曲全体タイムラインの再生位置の線: 【ずれ】絞った範囲を軸にしていたため、絞ると線だけが
     バーの端から端まで動き、赤の位置と合わなかった → paintTl と同じ軸に統一(uniBase)
   - 制作タイムライン通常表示: 曲全体軸だった。絞った幅の中で相対的に選べるようにするため、
     主軸 mkTlAxis() を新設(絞り中は範囲を全幅に割り当て)し、表示(renderMkTl / mkTlApplyView /
     打ち込みプレビュー)と変換の全てをその軸に統一した
   - お気に置くドラッグの通常帯変換: 【ずれ】拡大が入ると30秒窓(mkTlWin)で変換しており、
     通常表示とも拡大表示(15秒)とも合っていなかった → 主軸に統一(tlHit / absDragT)
   - つまみドラッグ: 【ずれ】同じく30秒窓で変換していた → 主軸に統一
   - 置きに行く変換(mkScrAbs): 【ずれ】ラベル列(52px)を含む mkTlView の幅で変換しており、
     バーが描かれる帯(mkTlSlide)とずれていた → mkTlSlide + 主軸に統一
   - スクラブ変換(mkBandAbs): 割り当て区間を主軸に統一(帯の取り方は build 64 の設計どおり)
   - 拡大タイムライン表示と拡大帯の変換: どちらも15秒窓(mkTlWin15)で一致していた
   - 拡大タイムラインの出方: 【ずれ】お気に置くではタイムラインに指が入って初めて拡大が
     出ていた → ドラッグ開始の瞬間に出す(startPlaceDrag) */
(function p2Uni53() {
  try {
    window.__p2Uni = {version: 53};
    window.__p2Uni53 = { axis: function () { try { return mkTlAxis(); } catch (e) { return null; } } };
  } catch (e) { try { console.warn("p2Uni53", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v54: お気に置くボタンの形の訂正 =================
   v52 で付けた四角い付箋タブ形が祐治のイメージと違ったための訂正。
   イメージは「元の丸いボタンの形のまま、選んだカードの上に付箋のようにつける」で、
   形は水玉(しずく): 下は丸く、上は尖っている。尖った部分は「今選んでいる再生位置」を
   指す印という意味合い。色味は元の丸ボタン(うっすら青・白フチ・影で浮いて見える)を
   踏襲し、中心の白い点も元のボタンと同じ。文字ラベルは元の丸ボタン同様に持たない
   (title / aria-label で補う)。付く場所と出る条件は v52 の付箋式のまま: 選択中の
   カードの上辺に、上へはみ出して付く。選択時だけ表示。ドラッグの挙動は一切変えない。
   形は SVG のしずく型パス(白フチ=stroke)で描き、影は drop-shadow で形に沿わせる */
(function p2Uni54() {
  try {
    var dropSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 52'%3E%3Cpath d='M20 3C24 12 37 21 37 33A17 17 0 1 1 3 33C3 21 16 12 20 3Z' fill='rgba(77,201,255,0.55)' stroke='%23ffffff' stroke-width='2.5'/%3E%3C/svg%3E";
    var st = document.createElement("style"); st.id = "p2Uni54Styles";
    st.textContent = [
      /* v52 の四角タブ指定を、水玉(しずく)形に上書きする */
      ".p2uni-place{top:-26px;transform:translateX(-50%);width:34px;height:44px;padding:0;border:0;border-radius:0;background:transparent url(\"" + dropSvg + "\") center/contain no-repeat;box-shadow:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5));font-size:0;line-height:0;z-index:4}",
      /* 元の丸ボタンと同じ、中心の白い点(しずくの丸い部分に置く) */
      ".p2uni-place:after{display:block;content:\"\";position:absolute;left:50%;top:63%;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.92);transform:translate(-50%,-50%)}",
      /* はみ出し(26px)が上のカードに重ならないよう、選択中カードの上余白を広げる */
      "#mkList .p2uni-card.sel{margin-top:30px}",
      ".p2uni-pinned .p2uni-card.sel{margin-top:0}"
    ].join("\n");
    document.head.appendChild(st);

    window.__p2Uni = {version: 54};
    window.__p2Uni54 = {};
  } catch (e) { try { console.warn("p2Uni54", e); } catch (err) {} }
})();

/* ================= プロトタイプ2 v55: 編集は「中央に浮かぶ大きなカード」で + ドラッグ中の再生停止の直し =================
   祐治が図で確認・承認した形:
   1. カードを選んで編集に入ったら、一覧の中の埋め込み編集(編集ボード)は廃止し、そのカードが
      中央に大きく浮かび上がって固定表示される(上のレイヤー。後ろの一覧は薄く見える)。
      時刻(位置)・長さ・文言/種類・コピーは全部このカードの中で決められる。位置と長さの
      操作は従来の編集ボードと同じ(大きめの −/＋、秒数の直接入力とホイール、決定)。
      カードの上には水玉形のお気に置く(v54の形そのまま)が付き、掴めばそのまま制作
      タイムラインへ持っていける。タイムラインのレイヤーはこの浮かぶカードより上にする
      (拡大タイムライン z-90 > 浮かぶカード z-80。ドラッグ中は通常タイムラインも
      body.p2uni-pop-on で z-85 に持ち上げ、見えて触れる状態を保つ)。
      閉じれば一覧に戻る。v52 の「選択カードを一覧の上に固定(sticky)」はこの方式に置き換え
      (一覧側の並べ替え・固定は v48 の描画側で廃止済み)。
      空カードも、選べば(「コールを指定」タップ)同じ大きなカードで内容を決められる。
   2. 置きに行く最中に音が止まる問題の直し(本体側で対応済みのものの要点):
      原因は2つ。(a) 本体 loop の「登録範囲の終わりで止める」と v44 範囲監視の
      「絞った範囲の終わりで止める」が、旧スクラブ(mkScrSt)しか例外にしておらず、
      お気に置くドラッグ中にも pause を呼んでいた。(b) ドラッグ中の追従シークが
      seek だけで play を再発行しないため、一度止まると指を止めるまで無音だった。
      → ドラッグ中は両方の監視を止め(loop / v44 watch に __p2PlaceDragActive の例外を追加)、
        追従シークの後に止まっていたら playerPlay() で再開するようにした(v49側)。 */
(function p2Uni55() {
  try {
    var st = document.createElement("style"); st.id = "p2Uni55Styles";
    st.textContent = [
      "#p2UniPop{display:none;position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:18px;box-sizing:border-box}",
      "#p2UniPop .p2uni-pop-card{position:relative;width:min(100%,430px);max-height:88vh;overflow-y:auto;box-sizing:border-box;background:#1d1f3d;border:1.5px solid #8e91b8;border-radius:16px;padding:34px 14px 14px;box-shadow:0 18px 44px rgba(0,0,0,.6);color:var(--ink)}",
      ".p2uni-pop-face{position:relative;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 10px;margin-bottom:6px}",
      ".p2uni-pop-time{font-size:24px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".p2uni-pop-kind{flex:none;font-size:11px;font-weight:900;color:#cfd2f2;background:rgba(255,255,255,.1);border-radius:999px;padding:3px 8px}",
      ".p2uni-pop-x{flex:1;min-width:0;font-size:17px;font-weight:800;overflow-wrap:anywhere}",
      ".p2uni-pop-xempty{color:#9aa0d8}",
      ".p2uni-pop-dur{font-size:15px;font-weight:900;white-space:nowrap}",
      ".p2uni-pop-xbtn{flex:none;width:36px;height:36px;border-radius:50%;border:1.5px solid #8e91b8;background:none;color:#cfd2f2;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;line-height:1}",
      ".p2uni-pop-sec{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 6px;border-top:1px solid rgba(255,255,255,.1)}",
      ".p2uni-pop-sec.focus{background:rgba(255,210,63,.09);border-radius:10px}",
      ".p2uni-pop-label{font-size:13px;font-weight:900;color:#cfd2f2;min-width:38px}",
      ".p2uni-pop-sec button{height:44px;min-width:44px;font-size:19px;font-weight:900;border-radius:12px;border:2px solid #8e91b8;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;padding:0 10px}",
      ".p2uni-pop-sec button.p2uni-pop-ok{background:#ffd23f;color:#2a2410;border-color:#ffd23f;font-size:14px}",
      ".p2uni-pop-in{width:86px;height:44px;text-align:center;font-size:16px;font-weight:900;border-radius:12px;border:2px solid #8e91b8;background:var(--bg);color:var(--ink);font-family:inherit;box-sizing:border-box}",
      ".p2uni-pop-unit{font-size:12px;color:var(--mut)}",
      ".p2uni-pop-text{flex:1;min-width:150px;height:44px;box-sizing:border-box;padding:0 12px;font-size:16px;font-weight:700;border-radius:12px;border:2px solid #8e91b8;background:var(--bg);color:var(--ink);font-family:inherit}",
      ".p2uni-pop-types{display:flex;gap:6px;flex-wrap:wrap}",
      ".p2uni-pop-types button{font-size:13px;min-height:44px;height:44px}",
      ".p2uni-pop-types button.sel{border-color:#ff8fc0;background:rgba(255,105,170,.28);color:#fff}",
      ".p2uni-pop-presets{display:flex;flex-wrap:wrap;gap:6px;width:100%}",
      ".p2uni-pop-presets:empty{display:none}",
      ".p2uni-pop-plab{width:100%;font-size:11px;font-weight:700;color:#9aa3c7}",
      ".p2uni-pop-presets button{min-height:36px;height:36px;padding:6px 10px;font-size:12px;border-radius:999px}",
      ".p2uni-pop-foot{display:flex;gap:10px;margin-top:8px}",
      ".p2uni-pop-foot button{flex:1;height:46px;border-radius:12px;border:2px solid #8e91b8;background:none;color:#cfd2f2;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit}",
      /* ドラッグ中は通常タイムラインも浮かぶカードより上に出す(拡大タイムライン z-90 は元々上) */
      "body.p2uni-pop-on #mkTlBox{position:relative;z-index:85}"
    ].join("\n");
    document.head.appendChild(st);

    var popEl = null, pop = null, popDrag = false, presetSig = "__none__";

    function popClampPos(v, sc) {
      var D = Math.max(dur() || 0, 1);
      v = Math.max(0, Math.min(Math.max(0, D - (sc ? sc.d : 0)), v));
      v = p2RangeClamp(v, sc ? sc.d : 0);
      return Math.round(v * 10) / 10;
    }
    function popClampDur(v) { return Math.round(Math.max(0.5, Math.min(20, v)) * 10) / 10; }

    function buildPop() {
      if (popEl) return popEl;
      popEl = document.createElement("div");
      popEl.id = "p2UniPop";
      popEl.setAttribute("role", "dialog");
      popEl.setAttribute("aria-modal", "true");
      popEl.setAttribute("aria-label", "カードの編集");
      popEl.innerHTML =
        '<div class="p2uni-pop-card">'
        + '<div class="p2uni-pop-face">'
        + '<button type="button" class="p2uni-place p2uni-pop-place" title="お気に置く: 押したままタイムラインへ動かして離すと位置が決まります" aria-label="お気に置く"></button>'
        + '<span class="p2uni-pop-time"></span>'
        + '<span class="p2uni-pop-kind"></span>'
        + '<span class="p2uni-pop-x"></span>'
        + '<span class="p2uni-pop-dur"></span>'
        + '<button type="button" class="p2uni-pop-xbtn" data-popclose aria-label="閉じる">×</button>'
        + '</div>'
        + '<div class="p2uni-pop-sec" data-sec="pos">'
        + '<span class="p2uni-pop-label">位置</span>'
        + '<button type="button" data-popadj="pos|-1" aria-label="位置を減らす">−</button>'
        + '<input class="p2uni-pop-in" data-popin="pos" type="text" inputmode="decimal" aria-label="位置(秒)">'
        + '<span class="p2uni-pop-unit">秒</span>'
        + '<button type="button" data-popadj="pos|1" aria-label="位置を増やす">＋</button>'
        + '<button type="button" class="p2uni-pop-ok" data-popok="pos">決定</button>'
        + '</div>'
        + '<div class="p2uni-pop-sec" data-sec="dur">'
        + '<span class="p2uni-pop-label">長さ</span>'
        + '<button type="button" data-popadj="dur|-1" aria-label="長さを減らす">−</button>'
        + '<input class="p2uni-pop-in" data-popin="dur" type="text" inputmode="decimal" aria-label="長さ(秒)">'
        + '<span class="p2uni-pop-unit">秒</span>'
        + '<button type="button" data-popadj="dur|1" aria-label="長さを増やす">＋</button>'
        + '<button type="button" class="p2uni-pop-ok" data-popok="dur">決定</button>'
        + '</div>'
        + '<div class="p2uni-pop-sec" data-sec="content">'
        + '<span class="p2uni-pop-label">内容</span>'
        + '<input class="p2uni-pop-text" type="text" maxlength="30" placeholder="例: ハイ!ハイ!" autocomplete="off" aria-label="コールの内容">'
        + '<div class="p2uni-pop-presets"></div>'
        + '<div class="p2uni-pop-types">'
        + '<button type="button" data-poptype="call">コール</button>'
        + '<button type="button" data-poptype="sing">シンガロン</button>'
        + '<button type="button" data-poptype="koko">ココ好き!</button>'
        + '</div>'
        + '<button type="button" class="p2uni-pop-ok" data-popok="content">内容を決定</button>'
        + '</div>'
        + '<div class="p2uni-pop-foot">'
        + '<button type="button" data-popcopy>コピー</button>'
        + '<button type="button" data-popclose>閉じる</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(popEl);

      popEl.addEventListener("click", function (e) {
        if (e.target === popEl) { closePop(); return; }
        var cl = e.target.closest ? e.target.closest("[data-popclose]") : null;
        if (cl) { closePop(); return; }
        var adj = e.target.closest ? e.target.closest("[data-popadj]") : null;
        if (adj && pop) {
          var p = adj.dataset.popadj.split("|");
          stepPop(p[0], +p[1]);
          return;
        }
        var ok = e.target.closest ? e.target.closest("[data-popok]") : null;
        if (ok && pop) {
          if (ok.dataset.popok === "pos") applyPopPos();
          else if (ok.dataset.popok === "dur") applyPopDur();
          else applyPopContent();
          return;
        }
        var tp = e.target.closest ? e.target.closest("[data-poptype]") : null;
        if (tp && pop) {
          pop.typeK = tp.dataset.poptype;
          paintPopTypes();
          return;
        }
        var cp = e.target.closest ? e.target.closest("[data-popcopy]") : null;
        if (cp && pop) { copyPop(); return; }
        var pr = e.target.closest ? e.target.closest("[data-poppreset]") : null;
        if (pr && pop) {
          var P = PRESETS[+pr.dataset.poppreset]; if (!P) return;
          var tin = popEl.querySelector(".p2uni-pop-text");
          if (tin) tin.value = P.x;
          pop.typeK = P.k;
          paintPopTypes();
          toast("プリセット「" + P.x + "」を入れました。種類を確認して「内容を決定」を押してください");
          return;
        }
      });
      popEl.addEventListener("input", function (e) {
        if (!pop) return;
        var inp = e.target.closest ? e.target.closest("[data-popin]") : null;
        if (inp) {
          var v = parseFloat(inp.value);
          if (!isNaN(v)) { if (inp.dataset.popin === "pos") pop.posVal = v; else pop.durVal = v; }
        }
      });
      popEl.addEventListener("wheel", function (e) {
        if (!pop) return;
        var inp = e.target.closest ? e.target.closest("[data-popin]") : null;
        if (!inp) return;
        e.preventDefault();
        var kind = inp.dataset.popin;
        var v = parseFloat(inp.value);
        if (isNaN(v)) v = kind === "pos" ? pop.posVal : pop.durVal;
        v = (kind === "pos" ? popClampPos(v + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : 0.1), pop.sc) : popClampDur(v + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : 0.1)));
        if (kind === "pos") pop.posVal = v; else pop.durVal = v;
        inp.value = v.toFixed(1);
      }, {passive: false});

      var placeBtn = popEl.querySelector(".p2uni-pop-place");
      placeBtn.addEventListener("pointerdown", function (e) {
        if (!pop) return;
        var idx = mk.scenes.indexOf(pop.sc); if (idx < 0) return;
        e.preventDefault();
        if (window.__p2Uni49 && window.__p2Uni49.startPlaceDrag) {
          window.__p2Uni49.startPlaceDrag(e, idx, placeBtn);
          popDrag = true;
        }
      });
      return popEl;
    }

    function paintPopTypes() {
      if (!popEl || !pop) return;
      popEl.querySelectorAll("[data-poptype]").forEach(function (b) { b.classList.toggle("sel", b.dataset.poptype === pop.typeK); });
    }
    function paintPopPresets() {
      if (!popEl) return;
      var box = popEl.querySelector(".p2uni-pop-presets");
      if (!box) return;
      var sig = PRESETS.map(function (p) { return p.x; }).join("|");
      if (sig === presetSig) return;
      presetSig = sig;
      if (!PRESETS.length) { box.innerHTML = ""; return; }
      box.innerHTML = '<span class="p2uni-pop-plab">プリセットから入れる</span>' + PRESETS.map(function (p, i) {
        return '<button type="button" data-poppreset="' + i + '">' + esc(p.x) + '</button>';
      }).join("");
    }
    function paintPop() {
      if (!popEl || !pop) return;
      var sc = pop.sc;
      popEl.querySelector(".p2uni-pop-time").textContent = mkIsPlaced(sc) ? fmt(sc.t) : "未配置";
      popEl.querySelector(".p2uni-pop-kind").textContent = LAB[sc.k];
      var xEl = popEl.querySelector(".p2uni-pop-x");
      xEl.textContent = sc.x ? sc.x : "コールを指定";
      xEl.classList.toggle("p2uni-pop-xempty", !sc.x);
      popEl.querySelector(".p2uni-pop-dur").textContent = sc.d + "秒";
      var pi = popEl.querySelector('[data-popin="pos"]'); if (pi) pi.value = pop.posVal.toFixed(1);
      var di = popEl.querySelector('[data-popin="dur"]'); if (di) di.value = pop.durVal.toFixed(1);
      var tin = popEl.querySelector(".p2uni-pop-text"); if (tin && tin.value !== (sc.x || "")) tin.value = sc.x || "";
      paintPopTypes();
      paintPopPresets();
    }
    function markFocus(kind) {
      if (!popEl) return;
      popEl.querySelectorAll(".p2uni-pop-sec").forEach(function (s) { s.classList.toggle("focus", s.dataset.sec === kind); });
    }

    function openPop(i, focus) {
      var sc = mk.scenes[i]; if (!sc) return;
      buildPop();
      mkSel = i; mkSelOrigT = sc.t;
      pop = {sc: sc, posVal: (sc.t || 0), durVal: sc.d, typeK: sc.k};
      popEl.style.display = "flex";
      document.body.classList.add("p2uni-pop-on");
      paintPop();
      markFocus(focus || "content");
      renderMk();
      if (mkIsPlaced(sc) && playerReady()) playerSeek(sc.t);
    }
    function closePop() {
      pop = null;
      if (popEl) popEl.style.display = "none";
      document.body.classList.remove("p2uni-pop-on");
    }
    function stepPop(kind, dir) {
      var inp = popEl.querySelector('[data-popin="' + kind + '"]');
      var v = inp ? parseFloat(inp.value) : NaN;
      if (isNaN(v)) v = kind === "pos" ? pop.posVal : pop.durVal;
      v = kind === "pos" ? popClampPos(v + dir * 0.1, pop.sc) : popClampDur(v + dir * 0.1);
      if (kind === "pos") pop.posVal = v; else pop.durVal = v;
      if (inp) inp.value = v.toFixed(1);
    }
    function applyPopPos() {
      var inp = popEl.querySelector('[data-popin="pos"]');
      var v = inp ? parseFloat(inp.value) : NaN;
      if (isNaN(v)) v = pop.posVal;
      pop.sc.t = popClampPos(v, pop.sc); pop.sc.placed = true; pop.posVal = pop.sc.t;
      mkSortScenes(); mkSel = mk.scenes.indexOf(pop.sc);
      paintPop(); renderMk();
      if (playerReady()) playerSeek(pop.sc.t);
      toast("位置を " + fmt(pop.sc.t) + " にしました");
    }
    function applyPopDur() {
      var inp = popEl.querySelector('[data-popin="dur"]');
      var v = inp ? parseFloat(inp.value) : NaN;
      if (isNaN(v)) v = pop.durVal;
      v = popClampDur(v);
      if (mkIsPlaced(pop.sc)) v = Math.round(Math.max(0.5, p2RangeSpan(pop.sc.t, v)) * 10) / 10;
      pop.sc.d = v; pop.durVal = v;
      paintPop(); renderMk();
      toast("長さを " + v + " 秒にしました");
    }
    function applyPopContent() {
      var tin = popEl.querySelector(".p2uni-pop-text");
      var x = tin ? tin.value.trim() : "";
      if (!x) { toast("コールの内容を入力してください"); return; }
      pop.sc.x = x; pop.sc.k = pop.typeK;
      mk.type = pop.typeK;
      var mt = document.getElementById("mkText"); if (mt) mt.value = x;
      document.querySelectorAll("#mkTypes button").forEach(function (b) { b.classList.toggle("sel", b.dataset.i === pop.typeK); });
      paintPop(); renderMk();
      toast("カードの内容を変更しました");
      try { guideEvent("contentEdit"); } catch (e) {}
    }
    function copyPop() {
      var idx = mk.scenes.indexOf(pop.sc); if (idx < 0) return;
      if (window.__p2Uni49 && window.__p2Uni49.copy) window.__p2Uni49.copy(idx);
      var nsc = mk.scenes[mkSel];
      if (nsc && nsc !== pop.sc) {
        pop.sc = nsc; pop.posVal = (nsc.t || 0); pop.durVal = nsc.d; pop.typeK = nsc.k;
        paintPop();
      }
    }

    /* ポップアップからのドラッグは、一覧の委譲ハンドラを通らないので window で中継する */
    window.addEventListener("pointermove", function (e) {
      if (popDrag && window.__p2Uni49) window.__p2Uni49.movePlaceDrag(e);
    });
    window.addEventListener("pointerup", function (e) {
      if (!popDrag) return;
      popDrag = false;
      if (window.__p2Uni49) window.__p2Uni49.endPlaceDrag(e);
      if (pop) { pop.posVal = (pop.sc.t || 0); paintPop(); }
    });
    window.addEventListener("pointercancel", function () {
      if (!popDrag) return;
      popDrag = false;
      if (window.__p2Uni49) window.__p2Uni49.cancelPlaceDrag();
      if (pop) { pop.posVal = (pop.sc.t || 0); paintPop(); }
    });

    /* 作成画面を離れたり、対象カードが無くなったら閉じる */
    setInterval(function () {
      if (!pop) return;
      if (!document.body.classList.contains("scr-mk")) { closePop(); return; }
      if (mk.scenes.indexOf(pop.sc) < 0) closePop();
    }, 400);

    window.__p2Uni55 = { open: openPop, close: closePop, get current() { return pop ? pop.sc : null; } };
    window.__p2Uni = {version: 55};
  } catch (e) { try { console.warn("p2Uni55", e); } catch (err) {} }
})();
})().catch(e => window.__show("起動エラー: " + (e && e.message)));
