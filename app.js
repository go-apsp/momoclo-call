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
let EV = [], cur = null, sess = null, pickI = 0, native = false;
const LIMIT = 600000;   // 湧きを数えるのは、再生を始めてから10分
let mk = {scenes: [], type: "call", from: null, base: ""};
let tlId = null, tlZoom = false, tlD = 1, mkPv = null, refCalls = [], refPlay = false, randPlay = false, mkMeas = null;
let cmts = {}, pendAll = [], pendKnown = new Set();
let spRange = null, spEdit = null, mySps = [], spRef = null, curRef = null;

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
{ const spScript = document.createElement("script"); spScript.src = "https://open.spotify.com/embed/iframe-api/v1"; spScript.async = true; document.head.appendChild(spScript); }

const spHasTrack = () => !!(SONGS[si] && SONGS[si].tid);
const spOff = () => +(SONGS[si] && SONGS[si].spOffset) || 0;
const spRawNow = () => {
  if (!spHasTrack()) return 0;
  const ms = spAnchor.paused ? spAnchor.pos : Math.min(spAnchor.durMs || 240000, spAnchor.pos + (performance.now() - spAnchor.at));
  return Math.max(0, ms / 1000);
};
const spRawDur = () => (spAnchor.durMs || 240000) / 1000;

// --- app.js に追加・修正する実装コードの例 ---

// 1. 状態の保存用ヘルパー
function saveSpState() {
  try {
    const state = {
      tid: (SONGS[si] && SONGS[si].tid) || "",
      pos: spRawNow(),
      paused: spAnchor.paused,
      si: si,
      savedAt: performance.now()
    };
    localStorage.setItem("momo_sp_state", JSON.stringify(state));
  } catch (e) {}
}

// 2. 状態の復元用ヘルパー
function restoreSpState() {
  try {
    const raw = localStorage.getItem("momo_sp_state");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// 3. Spotifyコントローラー初期化時の復元処理の組み込み (initSpController の置き換え)
function initSpController() {
  if (spCtrl || !spApi) return;
  const el = $("spEmbed"); if (!el) return;
  
  // 保存された状態があればそれを優先、なければ現在の設定を使用
  const savedState = restoreSpState();
  const initTid = (savedState && savedState.tid) ? savedState.tid : ((SONGS[si] && SONGS[si].tid) || (SONGS.find(x => x.tid) || {}).tid || "45R1m5osIXo92tgY1eHTeW");
  
  // 保存されていた楽曲インデックスがあれば復元する
  if (savedState && typeof savedState.si === "number" && SONGS[savedState.si]) {
    si = savedState.si;
    VID = SONGS[si].vid;
    try { localStorage.setItem("momo_song", si); } catch (e) {}
    UI.songSel(si);
  }

  spApi.createController(el, {uri: "spotify:track:" + initTid, width: "100%", height: "100%"}, ctrl => {
    spCtrl = ctrl;
    spLoadedTid = initTid;

    // 復元した位置や再生状態があれば適用する
    if (savedState && savedState.pos > 0) {
      try {
        ctrl.seek(Math.round(savedState.pos));
        if (!savedState.paused && ctrl.resume) {
          ctrl.resume();
        }
      } catch (e) {}
    }

    ctrl.addListener("playback_update", e => {
      const d = (e && e.data) || {};
      const pos = typeof d.position === "number" ? d.position : spAnchor.pos;
      const durMs = (typeof d.duration === "number" && d.duration > 0) ? d.duration : spAnchor.durMs;
      const paused = !!d.isPaused;
      const isPreview = typeof d.duration === "number" && d.duration > 0 && d.duration <= 35000;
      spAnchor = {pos, at: performance.now(), paused, durMs, isPreview};
      
      // 再生状態が変わるたびにストレージに保存し、ページをまたいでも引き継げるようにする
      saveSpState();
      paintSpWarn();
    });

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
  $("play").textContent = $("fsplay").textContent = pl ? "一時停止" : "再生";
  if (st === 0 && sess) { sess = null; paintApply(); }   // 曲が終わったら、次回の再生でリセット
  if (mkPv && t >= mkPv.until) { mkPv = null; playerPause(); toast("プレビューが終わりました"); }   // プレビューは表示終了+3秒で止める
  const R = curRange(); if (R && pl && !mkPv && t >= R.e) playerPause();   // 再生範囲の終わりで止める
  if (spRange && pl && !mkPv && t >= spRange.b) { spRange = null; playerPause(); toast("シェアポイントの範囲が終わりました"); }   // シェアポイントの終点で止める
  if (pl && act && !isMine() && !mkPv) { const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); } }   // 再生を始めてから10分を数える
  if (!drag) { bar.max = dur(); bar.value = t; }
  $("tm").textContent = fmt(t); $("dur").textContent = fmt(dur());
  const SRC = mkPv ? mkPv.scenes : EV;
  const on = SRC.filter(x => t >= x.t && t < x.t + x.d);           // いま出ている場面(重なってもそれぞれ本来のタイミング)
  UI.cards(on); UI.nexts(SRC.filter(x => t < x.t && x.t - t <= 6 && x.k !== "koko"), t);
  const tp = $("tlPos");
  if (tp) { const on2 = tlId && (tlId === act || tlId === "__cur__") && dur() > 0; tp.style.display = on2 ? "block" : "none"; if (on2) tp.style.left = "calc(64px + (100% - 72px) * " + Math.min(1, t / dur()) + ")"; }
  const e = on.slice().reverse().find(x => x.k !== "koko") || null;   // 「自分も湧く!」の対象
  document.querySelectorAll(".wk").forEach(x => x.classList.toggle("hot", !!e));
  cur = mkPv ? null : e;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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
  paintLogin(); await loadCalls();
});
function paintLogin() {
  const b = $("login") || $("me");
  if (me && prof) b.outerHTML = `<button id="me" style="border-color:${colorOf(prof.oshi)}" aria-label="${esc(prof.nick)}" data-a="whoami">${UI.mic(prof.icon)}</button>`;
  else b.outerHTML = `<button class="pill" id="login" data-a="login">ログイン</button>`;
  $("mkbtn").style.display = $("oshibtn").style.display = $("logout").style.display = me && prof ? "block" : "none";
  if (!(me && prof)) A.endMk();
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
        const rs = snap.docs.map(d => ({id: d.id, ...d.data()}));
        rs.sort((a, b) => ((a.createdAt && a.createdAt.seconds) || 0) - ((b.createdAt && b.createdAt.seconds) || 0));
        refCalls = rs;
        applyRef(rs[0]);
        refApplied = true;
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
  refPlay = true; randPlay = false; act = null; curRef = c; sess = null; paintApply();
  EV = c.scenes.map(x => ({...x})).sort((a, b) => a.t - b.t);
  $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">参考コール' + (c.versionName ? "<i>" + esc(c.versionName) + "</i>" : "") + "</div>";
  $("info").textContent = "";
  $("panelbody").innerHTML = "参考コールで再生中です";
  renderPEv();
}
function applyAct() {
  curRef = null;
  const c = calls.find(x => x.id === act);
  EV = c ? c.scenes.map(x => ({...x, mine: !!me && c.ownerUid === me.uid})).sort((a, b) => a.t - b.t) : [];
  UI.who(SONGS[si].title, c ? c.ownerName : "", c ? c.versionName : "");
  $("info").textContent = c ? "" : "まだ推しコールがありません。ログインして作ってみましょう";
  UI.total(calls.filter(x => x.public).reduce((n, x) => n + (x.used || 0), 0)); $("panelbody").innerHTML = UI.panel(c);
  if (act && act !== evFor) { evFor = act; if (!cmts[act]) loadCmts(act).then(() => renderPEv()); }
  renderPEv();
}

/* ---------- 一覧(一番上のレイヤー) ---------- */
function render() { $("list").innerHTML = UI.list(calls, {me, liked, openId, cmts, myNick: prof ? prof.nick : ""}); renderPEv(); }
let pEvOpen = false, evFor = null;
function renderPEv() { const el = $("pEv"); if (!el) return; const c = calls.find(x => x.id === act); if (c) { el.innerHTML = UI.evHtml(c, {me, liked, cmts, myNick: prof ? prof.nick : "", open: pEvOpen}); return; } if (refPlay && curRef) { el.innerHTML = '<div class="evBox"><div class="evBody"><button class="w" style="width:100%;height:44px;border-radius:12px" data-a="spOpenRef" data-i="' + curRef.id + '">シェアポイントを作る</button></div></div>'; return; } el.innerHTML = ""; }
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
    try { const cs = await getDocs(query(collection(db, "calls", c.id, "com
