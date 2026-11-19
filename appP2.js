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
  const R = curRange(); if (R && pl && !mkPv && !(mkScrSt && mkScrSt.active) && t >= R.e) playerPause();   // 再生範囲の終わりで止める(配置ドラッグ中は止めない: プロトタイプ2)
  if (spRange && pl && !mkPv && t >= spRange.b) { spRange = null; playerPause(); toast("シェアポイントの範囲が終わりました"); }   // シェアポイントの終点で止める
  const kr = mkPv ? null : kanranRange();   // build 63: 観覧モードの有効範囲(作成中プレビューでは効かせない)
  if (kr && pl) {   // 観覧モード: 指定範囲の外には出ない(手前なら始点へ寄せ、終点で止めて始点へ戻す)
    if (t < kr.a - 0.05) playerSeek(kr.a);
    else if (t >= kr.b && Date.now() - kanranEndAt > 800) { kanranEndAt = Date.now(); playerPause(); playerSeek(kr.a); toast("観覧モードの範囲の終わりまで再生しました"); }
  }
  if (pl && act && !isMine() && !mkPv) { const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); } }   // 再生を始めてから10分を数える
  if (!drag) { bar.max = dur(); bar.value = t; }
  $("tm").textContent = fmt(t); $("dur").textContent = fmt(dur());
  const SRC = mkPv ? mkPv.scenes : EV;
  let on = SRC.filter(x => t >= x.t && t < x.t + x.d);           // いま出ている場面(重なってもそれぞれ本来のタイミング)
  if (wakuHold && !mkPv) {   // build 62: 湧く!を押した場面は、再生位置に関係なく設定時間いっぱい表示し続ける
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
  cur = mkPv ? null : e;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- プロトタイプ2: カード表示スタイル切り替え(まずバブル) ---------- */
/* P2CS-BEGIN */
(function () {
  var origCards = UI.cards.bind(UI);
  var STYLES = ["stream", "stack", "bubble", "slide", "carousel", "pulse"];
  var style = "stream";
  try { style = localStorage.getItem("momo_p2_cardstyle_v2") || "stream"; } catch (e) {}
  if (STYLES.indexOf(style) < 0) style = "stream";
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
    + ".p2c.s-slide{bottom:8px;transform:translateX(-50%) translateY(120%);opacity:0;transition:transform .45s cubic-bezier(.22,.9,.35,1),opacity .45s ease}"
    + ".p2c.s-slide.pp0{transform:translateX(-50%) translateY(0) scale(1);opacity:1;z-index:5}"
    + ".p2c.s-slide.pp1{transform:translateX(-50%) translateY(-56px) scale(.92);opacity:.88;z-index:4}"
    + ".p2c.s-slide.pp2{transform:translateX(-50%) translateY(-104px) scale(.84);opacity:.72;z-index:3}"
    + ".p2c.s-slide.pp3{transform:translateX(-50%) translateY(-144px) scale(.78);opacity:.58;z-index:2}"
    + ".p2c.s-slide.pp4{transform:translateX(-50%) translateY(-178px) scale(.74);opacity:.45;z-index:1}"
    + ".p2c.s-slide.leaving{transform:translateX(-50%) translateY(-32px) scale(.9);opacity:0}"
    + ".p2c.s-carousel{bottom:8px;transform:translateX(-50%) translateY(24px) scale(.92);opacity:0;transition:transform .45s cubic-bezier(.22,.9,.35,1),opacity .45s ease}"
    + ".p2c.s-carousel.pp0{transform:translateX(-50%) translateY(0) scale(1);opacity:1;z-index:5}"
    + ".p2c.s-carousel.pp1{transform:translateX(-50%) translateY(-7px) scale(.94);opacity:.88;z-index:4}"
    + ".p2c.s-carousel.pp2{transform:translateX(-50%) translateY(-14px) scale(.88);opacity:.72;z-index:3}"
    + ".p2c.s-carousel.pp3{transform:translateX(-50%) translateY(-20px) scale(.83);opacity:.55;z-index:2}"
    + ".p2c.s-carousel.pp4{transform:translateX(-50%) translateY(-25px) scale(.79);opacity:.4;z-index:1}"
    + ".p2c.s-carousel.leaving{transform:translateX(-50%) translateY(-18px) scale(.8);opacity:0}"
    + ".p2c.s-pulse{bottom:10px;transform:translateX(-50%) scale(1.1);opacity:0;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .3s ease}"
    + ".p2c.s-pulse.pp0{transform:translateX(-50%) translateY(0) scale(1);opacity:1;z-index:5}"
    + ".p2c.s-pulse.pp1{transform:translateX(-50%) translateY(-9px) scale(.95);opacity:.8;z-index:4}"
    + ".p2c.s-pulse.pp2{transform:translateX(-50%) translateY(-16px) scale(.9);opacity:.45;z-index:3}"
    + ".p2c.s-pulse.pp3{transform:translateX(-50%) translateY(-21px) scale(.86);opacity:.3;z-index:2}"
    + ".p2c.s-pulse.pp4{transform:translateX(-50%) translateY(-25px) scale(.83);opacity:.22;z-index:1}"
    + ".p2c.s-pulse.leaving{transform:translateX(-50%) scale(.85);opacity:0}"
    + ".p2csbtns{display:inline-flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}"
    + ".p2csbtns button{padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#f4f4fb;font-size:12px}"
    + ".p2csbtns button.sel{background:var(--pink,#ff5d8f);border-color:transparent;font-weight:700}"
    /* ストリーム(Gemini案1: 下からスライドインし、等間隔で上へ流れ、薄くなって消える。ココ好き!は上部) */
    + ".p2c.s-stream{bottom:10px;border-radius:999px;padding:10px 18px;background:rgba(255,255,255,.92);color:#26264a;box-shadow:0 6px 20px rgba(0,0,0,.28);transform:translateX(-50%) translateY(46px);opacity:0;transition:transform .5s cubic-bezier(.22,.9,.35,1),opacity .5s ease}"
    + ".p2c.s-stream.k-call{border:2px solid rgba(255,45,110,.85)}"
    + ".p2c.s-stream.k-sing{border:2px solid rgba(30,136,229,.85)}"
    + ".p2c.s-stream.k-koko{background:rgba(255,213,79,.95);color:#3a2a00;border:2px solid rgba(255,160,0,.7)}"
    + ".p2c.s-stream.pp0{transform:translateX(-50%) translateY(0);opacity:1;z-index:5}"
    + ".p2c.s-stream.pp1{transform:translateX(-50%) translateY(-58px);opacity:.82;z-index:4}"
    + ".p2c.s-stream.pp2{transform:translateX(-50%) translateY(-116px);opacity:.58;z-index:3}"
    + ".p2c.s-stream.pp3{transform:translateX(-50%) translateY(-174px);opacity:.36;z-index:2}"
    + ".p2c.s-stream.pp4{transform:translateX(-50%) translateY(-232px);opacity:.16;z-index:1}"
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
  function leaveEl(el) { el.classList.add("leaving"); setTimeout(function () { el.remove(); }, 650); }
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
    + "<button type=\"button\" data-cs=\"stream\">ストリーム</button>"
    + "<button type=\"button\" data-cs=\"stack\">縦積み</button>"
    + "<button type=\"button\" data-cs=\"bubble\">バブル</button>"
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
      try { localStorage.setItem("momo_p2_cardstyle_v2", style); } catch (e) {}
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
          applyRef(rs[0]);
          refApplied = true;
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
  let barsHtml = "";
  MK_TL_KINDS.forEach(k => {
    const bars = mk.scenes.filter(s => mkIsPlaced(s) && s.k === k).map(s => {
      const l = Math.max(0, s.t / d * 100), w = Math.max(0.8, s.d / d * 100), idx = mk.scenes.indexOf(s), sel2 = idx === mkSel;
      return '<div class="mktl-bar mb-' + k + (sel2 ? " selb2" : "") + '" data-mksel="' + idx + '" style="left:' + l + '%;width:' + w + '%" title="' + fmt(s.t) + "〜" + fmt(s.t + s.d) + " " + LAB[k] + " " + esc(s.x) + '"><span>' + fmt(s.t) + "〜" + fmt(s.t + s.d) + " " + esc(s.x) + "</span></div>";
    }).join("");
    barsHtml += '<div class="mktl-lane">' + bars + "</div>";
  });
  let ticksFull = "";
  const steps = [5, 10, 15, 20, 30, 60]; let step = 60;
  for (let si2 = 0; si2 < steps.length; si2++) { if (d / steps[si2] <= 14) { step = steps[si2]; break; } }
  for (let t2 = 0; t2 <= d; t2 += step) {
    const l3 = t2 / d * 100;
    ticksFull += '<div class="mktl-tick big" style="left:' + l3 + '%"></div><span class="mktl-tlab" style="left:' + l3 + '%">' + fmt(t2) + "</span>";
  }
  let ticksZoom = "";
  for (let t = 0; t <= d; t += 1) {
    const big = t % 5 === 0, l2 = t / d * 100;
    ticksZoom += '<div class="mktl-tick' + (big ? " big" : "") + '" style="left:' + l2 + '%"></div>' + (big ? '<span class="mktl-tlab" style="left:' + l2 + '%">' + fmt(t) + "</span>" : "");
  }
  inner.innerHTML = barsHtml + '<div class="mktl-ticks">' + ticksFull + "</div>";
  const zinner = $("mkTlZoomInner");
  if (zinner) zinner.innerHTML = barsHtml + '<div class="mktl-ticks">' + ticksZoom + "</div>";
  const md = $("mkTlMode"); if (md) md.textContent = "全体表示";
  mkTlApplyView();
}
function mkTlApplyView() {
  const inner = $("mkTlInner"); if (!inner) return;
  const d = mkTlD();
  const t = now() || 0;
  inner.style.width = "100%";
  inner.style.transform = "translateX(0%)";
  const pl = $("mkTlPlay");
  if (pl) { const p = t / d * 100; if (p >= 0 && p <= 100) { pl.style.display = "block"; pl.style.left = p + "%"; } else pl.style.display = "none"; }
  const pos = $("mkTlPos"); if (pos) pos.textContent = "現在 " + fmt(t);
  const kn = $("mkTlKnob");
  if (kn) {
    const sc = (mkSel >= 0 && mk.scenes[mkSel]) ? mk.scenes[mkSel] : null;
    if (sc && mkIsPlaced(sc)) {
      const kp = sc.t / d * 100;
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
function mkBandAbs(clientX) {
  const W = window.innerWidth || 360;
  const m = Math.max(10, Math.round(W * 0.04));
  const width = Math.max(50, W - m * 2);
  let r = (clientX - m) / width;
  r = Math.max(0, Math.min(1, r));
  return r * mkTlD();
}
/* プロトタイプ2: 置きに行くドラッグ専用の指位置→時刻。タイムラインの箱の左端=曲の頭、右端=曲の最後として、指の横位置そのままを時刻にする */
function mkScrAbs(clientX, src) {
  if (src && src.fromPlaceButton) {
    const vw = $("mkTlView");
    if (vw) { const rc = vw.getBoundingClientRect(); if (rc.width > 10) return Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * mkTlD(); }
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
  scr.target = target; mkTlCenter = target; mkTlApplyView();
  mkMoveGhost(e, target);
  if (scr.lastSeek === null || Math.abs(target - scr.lastSeek) >= 0.15) { scr.lastSeek = target; playerSeek(Math.round(target * 10) / 10); if (playerReady() && playerState() !== 1) playerPlay(); }   // プロトタイプ2: ドラッグ中に何かの理由で止まっても、指の動きで再開する
  scr.lastX = e.clientX; scr.lastY = e.clientY;
  if (scr.settle) clearTimeout(scr.settle);
  scr.settle = setTimeout(() => {   // 指を止めたら(約320ms)、指の絶対位置から再生して聞き直せる
    if (!mkScrSt || !mkScrSt.active) return;
    const t = Math.max(0, Math.min(mkTlD(), Math.round(mkScrAbs(mkScrSt.lastX, mkScrSt.src) * 10) / 10));
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
      const t = Math.max(0, Math.min(mkTlD() - 0.5, Math.round(sc.target * 10) / 10));
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
    mk = {scenes: [], type: "call", from: null, base: ""}; mkSel = -1; mkLenPhase = null; renderMk(); UI.songSel(si); sess = null; paintApply(); applyAct(); loadCalls();
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
    const t = Math.round(clampT(now()));
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
    v = Math.max(0, Math.min(Math.max(0, D - sc.d), v));
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
    t = Math.max(0, Math.min(Math.max(0, D - sc.d), t));
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
    el.style.left = (h.t0 / d * 100) + "%";
    el.style.width = Math.max(1.2, h.d / d * 100) + "%";
    el.style.top = (li * 23 + 2) + "px";
    el.textContent = h.d.toFixed(1) + "秒";
    const zinner = $("mkTlZoomInner");
    if (zinner) {
      let zel = $("mkTlZoomPrev");
      if (!zel) { zel = document.createElement("div"); zel.id = "mkTlZoomPrev"; zinner.appendChild(zel); }
      zel.style.left = el.style.left; zel.style.width = el.style.width; zel.style.top = el.style.top;
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
      if (commit && el >= 0.3) { h.rel.d = h.d; renderMk(); toast("「" + (h.rel.x || LAB[h.rel.k]) + "」の長さを " + h.d.toFixed(1) + " 秒に決め直しました"); guideEvent("lenDone"); }
      else renderMk();
      return;
    }
    if (!commit) return;
    // 新規カード: 押した位置から、押していた長さで作る。種類・文言は「次に作るカード」の設定を使う
    const sc = {t: h.t0, d: h.d, placed: true, k: mk.type, x: $("mkText").value.trim()};
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
    let t0 = Math.round(clampT(now()) * 10) / 10;
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
    const w = mkTlWin(), D = mkTlD();
    let t = w.a + ratio * w.span;
    t = Math.max(0, Math.min(Math.max(0, D - sc.d), Math.round(t * 10) / 10));
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
    if (e && e.clientX != null && mk.scenes.indexOf(sc) >= 0) sc.t = Math.max(0, Math.min(Math.max(0, mkTlD() - sc.d), Math.round(mkBandAbs(e.clientX) * 10) / 10));
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
    target = Math.max(0, Math.min(Math.max(0, mkTlD() - sc.d), Math.round(target * 10) / 10));
    st.target = target; sc.t = target; mkTlCenter = target; mkTlApplyView(); paintKnob();
    const pt = $("mkPosTime"); if (pt) pt.textContent = fmt(target) + "〜" + fmt(target + sc.d);
    if (st.lastSeek === null || Math.abs(target - st.lastSeek) >= 0.15) { st.lastSeek = target; playerSeek(target); }
    st.lastX = e.clientX;
    if (st.settle) clearTimeout(st.settle);
    st.settle = setTimeout(() => {
      if (!mkPosScrSt || !mkPosScrSt.active) return;
      const sc2 = mkPosScrSt.sc; if (mk.scenes.indexOf(sc2) < 0) return;
      const t = Math.max(0, Math.min(Math.max(0, mkTlD() - sc2.d), Math.round(mkBandAbs(mkPosScrSt.lastX) * 10) / 10));
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
  if (mkTlZoom && !mkScrSt && !mkPosScrSt && !mkHoldSt) mkTlCenter = now() || 0;
  mkTlApplyView();
}, 250);
document.addEventListener("fullscreenchange", () => { if (native && !document.fullscreenElement && $("mv").classList.contains("fs")) A.fs(); });
/* build 62: ウェルカムカード。「表示しない」にチェックして閉じた場合のみ、次回から出さない */
try { if (!localStorage.getItem("momo_welcome_hide")) $("welcome").classList.add("on"); } catch (e) {}
})().catch(e => window.__show("起動エラー: " + (e && e.message)));
