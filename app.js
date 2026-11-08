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


/* ---------- 作成 ---------- */
function renderMk() { $("mkList").innerHTML = UI.mkList(mk.scenes); }

/* ---------- build 50: 湧きリアクション演出(画面の振動・再生中コール連動のはみ出しバッジ・紙吹雪) ---------- */
let impactTm = null;
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
    await addDoc(collection(db, "calls", id, "comments"), {name: name.slice(0, 20), text: text.slice(0, 200), status: "pending", uid: me ? me.uid : null, ownerUid: c.ownerUid, at: serverTimestamp()});
    try { await addDoc(collection(db, "notifications"), {callId: id, ownerUid: c.ownerUid, kind: "comment", at: serverTimestamp()}); } catch (e) {}
    tEl.value = "";
    toast("感想を送りました。作者の承認後に公開されます");
    if (me && c.ownerUid === me.uid) { await loadCmts(id); await checkPending(false); render(); }
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
/* ---------- シェアポイント ---------- */
const SPBASE = "https://go-apsp.github.io/momoclo-call/";
function spLink(id, a, b) { return SPBASE + "#sp=" + id + "&a=" + (+a).toFixed(1) + "&b=" + (+b).toFixed(1); }
function srLink(id, a, b) { return SPBASE + "#sr=" + id + "&a=" + (+a).toFixed(1) + "&b=" + (+b).toFixed(1); }
function spLinkFor(s) { return String(s.callId || "").indexOf("ref:") === 0 ? srLink(s.callId.slice(4), s.a, s.b) : spLink(s.callId, s.a, s.b); }
function spVals() { return {a: +$("spA").value, b: +$("spB").value}; }
function paintSpVals() { const v = spVals(); $("spAv").textContent = fmt(v.a); $("spBv").textContent = fmt(v.b); }
function openSpPanel(id) {
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
  $("spResult").innerHTML = (me && prof) ? "" : '<div class="spLink">ログインしていないため、このシェアポイントは保存されません（リンクのコピーとシェアはできます）</div>';
  $("spPanel").style.display = "flex";
  $("spPanel").scrollIntoView({behavior: "smooth", block: "center"});
}
function openSpPanelRef(id) {
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
  $("spResult").innerHTML = (me && prof) ? "" : '<div class="spLink">ログインしていないため、このシェアポイントは保存されません（リンクのコピーとシェアはできます）</div>';
  $("spPanel").style.display = "flex";
  $("spPanel").scrollIntoView({behavior: "smooth", block: "center"});
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
    mk = {scenes: [], type: "call", from: null, base: ""}; renderMk(); UI.songSel(si); sess = null; paintApply(); applyAct(); loadCalls();
  },
  menu: () => { const m = $("menu"); m.style.display = m.style.display === "block" ? "none" : "block"; },
  openOv: () => { $("menu").style.display = "none"; $("ov").style.display = "block"; render(); },
  closeOv: () => { $("ov").style.display = "none"; },
  play: () => {
    if (spMode && !spHasTrack()) return toast("この曲はSpotifyでは再生できません");
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備中です" : "動画の準備中です");
    if (sess && sess.t0 && Date.now() - sess.t0 > LIMIT) { sess = null; paintApply(); }
    if ($("intro").style.display === "block") { skipIntro(); return; }
    if (playerState() === 1) { playerPause(); return; }
    const R = curRange();
    if (R) { const t = now(); if (t < R.s - 0.05 || t >= R.e - 0.3) playerSeek(R.s); }
    else if (spMode && spOff() < 0 && spRawNow() < -spOff() - 0.1) { playerSeek(0); }
    if (playerState() === 2 && now() > 1) { playerPlay(); return; }
    runIntro();
  },
  pen: () => $("pen").classList.toggle("on"),
  penColor: (i, b) => { $("pen").style.color = PEN[i][1]; document.documentElement.style.setProperty("--pc", PEN[i][1]); document.querySelectorAll("#dots button").forEach(x => x.classList.toggle("sel", x === b)); },
  help: () => toast("このタイミングで一緒にコールやシンガロンができます"),
  waku: async () => {
    if (!cur) return toast("コール・シンガロンの場面で押してね");
    if (refPlay || randPlay) { wakuFx(cur ? cur.x : null); return toast("一緒に湧いた!"); }
    if (isMine()) { wakuFx(cur.x); return toast("一緒に湧いた! ※自分の推しコールなのでスコアは反映されません"); }
    const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); }
    if (Date.now() - q.t0 > LIMIT) return toast("タイム制限がかかりました。これ以上は反映されません。次回再生時にリセットされます", 4500);
    await q.ready; q.n++; wakuFx(cur.x);
    toast(me && prof ? "一緒に湧いた! 今回 " + q.n + " 回" : "一緒に湧いた! ※ログインすると、スコアに反映されます");
    if (q.first) { clearTimeout(q.tm); q.tm = setTimeout(() => saveWaku(q), 2500); } else paintApply();
  },
  apply: () => { if (sess) saveWaku(sess); },
  pickIcon: i => { pickI = +i; UI.sheetIcons(pickI); },
  tl: id => { const c = calls.find(x => x.id === id); if (!c) return; tlId = id; tlZoom = false; tlD = Math.max(dur() || 0, c.scenes.reduce((m, s) => Math.max(m, s.t + s.d), 0), 1); $("tlBody").innerHTML = UI.timeline(c, tlD, false); $("tlov").style.display = "block"; },
  tlZoom: () => { const sc = mkPv ? mkPv.scenes : EV; const c = tlId === "__cur__" ? {id: "__cur__", ownerName: refPlay ? "参考コール" : randPlay ? "ランダム再生" : "プレビュー", versionName: (curRef && curRef.versionName) || "", scenes: sc} : calls.find(x => x.id === tlId); if (!c) return; tlZoom = !tlZoom; $("tlBody").innerHTML = UI.timeline(c, tlD, tlZoom); },
  closeTl: () => { $("tlov").style.display = "none"; tlId = null; tlZoom = false; },
  tlMark: i => { const sc = mkPv ? mkPv.scenes : EV; const c = tlId === "__cur__" ? {scenes: sc} : calls.find(x => x.id === tlId); if (!c || !c.scenes) return; const s2 = c.scenes[+i]; if (s2) $("tlInfo").textContent = fmt(s2.t) + " " + LAB[s2.k] + " 「" + s2.x + "」"; },
  refcall: async () => {
    A.closeOv();
    try { const snap = await getDocs(query(collection(db, "refs"), where("videoId", "==", VID))); refCalls = snap.docs.map(d => ({id: d.id, ...d.data()})); }
    catch (e) { refCalls = []; }
    $("refList").innerHTML = UI.refs(refCalls);
    $("refov").style.display = "block";
  },
  closeRef: () => { $("refov").style.display = "none"; },
  useRef: id => {
    const c = refCalls.find(x => x.id === id); if (!c) return;
    applyRef(c);
    A.closeRef();
    if (playerReady()) playerSeek(rangeStart());
    toast("参考コールで再生します");
  },
  randomPlay: () => {
    const pubs = calls.filter(c => c.public);
    if (!pubs.length) return toast("公開中の推しコールがまだありません");
    const byT = new Map();
    pubs.forEach(c => (c.scenes || []).forEach(sc => { const k = Math.round(sc.t); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(sc); }));
    const scenes = [...byT.keys()].sort((a, b) => a - b).map(t => { const arr = byT.get(t); return {...arr[Math.floor(Math.random() * arr.length)], t}; });
    if (!scenes.length) return toast("場面がまだありません");
    randPlay = true; refPlay = false; act = null; curRef = null; sess = null; paintApply();
    EV = scenes.sort((a, b) => a.t - b.t);
    $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">コールランダム再生モード</div>';
    $("info").textContent = "";
    $("panelbody").innerHTML = "コールランダム再生モードです。みんなの推しコールから、場面ごとに選んで再生しています";
    renderPEv();
    A.closeOv();
    if (playerReady()) playerSeek(rangeStart());
    toast("コールランダム再生モードで再生します");
  },
  mkv: () => { $("mkvWarn").style.display = "flex"; },
  mkvCancel: () => { $("mkvWarn").style.display = "none"; },
  mkvOk: () => { $("mkvWarn").style.display = "none"; $("mkvPage").style.display = "block"; },
  closeMkv: () => { $("mkvPage").style.display = "none"; },
  spOpen: id => openSpPanel(id),
  spClose: () => { $("spPanel").style.display = "none"; },
  spSetA: () => { $("spA").value = Math.floor(now()); paintSpVals(); },
  spSetB: () => { $("spB").value = Math.ceil(now()); paintSpVals(); },
  spPreview: () => { const v = spVals(); if (!(v.b > v.a + 0.4)) return toast("終点は始点より後にしてください"); spRange = {a: v.a, b: v.b}; if (playerReady()) { playerSeek(v.a); playerPlay(); } },
  spCreate: () => createSp(),
  spCopy: async url => {
    try { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); }
    catch { const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("リンクをコピーしました"); }
  },
  spPageClose: () => { $("spPage").style.display = "none"; try { history.replaceState(null, "", location.pathname); } catch (e) {} },
  spPlay: key => { const p = key.split("|"); A.spPageClose(); startSpCall(p[0], +p[1], +p[2]).then(() => toast("シェアポイントの範囲を再生します")); },
  spOpenRef: id => openSpPanelRef(id),
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
  review: () => { $("menu").style.display = "none"; renderReview(); $("cmov").style.display = "block"; },
  evToggle: () => { pEvOpen = !pEvOpen; renderPEv(); },
  edit: id => {
    if (!guard()) return;
    const c = calls.find(x => x.id === id); if (!c) return;
    if (!confirm("編集はできますが、今までのスコア(♥と湧き)はリセットされ、付いた感想も削除されます。よろしいですか?")) return;
    mk = {scenes: c.scenes.map(x => ({...x})), type: "call", from: null, base: "", editId: id};
    $("mkVer").value = c.versionName || ""; $("mkNote").value = c.note || ""; $("mkRef").checked = !!c.allowRef;
    A.closeOv(); $("mk").style.display = "flex"; renderMk(); $("mk").scrollIntoView({behavior: "smooth"});
    toast("編集モード: 保存するとスコアと感想はリセットされます");
  },
  closeReview: () => { $("cmov").style.display = "none"; },
  use: id => { act = id; refPlay = false; randPlay = false; spRange = null; sess = null; paintApply(); applyAct(); A.closeOv(); },
  heart: async id => {
    if (!guard()) return;
    const own = calls.find(x => x.id === id);
    if (own && own.ownerUid === me.uid) return toast("自分の推しコールには、ハートは付けられません");   // 作った本人は変化なし
    const c = calls.find(x => x.id === id), hr = doc(db, "calls", id, "hearts", me.uid), b = writeBatch(db), was = liked.has(id);
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
  startMk: () => { if (!guard()) return; mk.editId = null; A.menu(); $("mk").style.display = "flex"; renderMk(); $("mk").scrollIntoView({behavior: "smooth"}); },
  endMk: () => { $("mk").style.display = "none"; if (mkMeas !== null) { mkMeas = null; const b = $("mkMeas"); if (b) b.textContent = "▶ 再生して表示時間を測る"; } },
  seek: (d) => { if (playerReady()) playerSeek(clampT(now() + +d)); },
  pseek: (d) => { if (playerReady()) playerSeek(clampT(now() + +d)); },
  type: (k) => { mk.type = k; document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === k)); const dv = k === "koko" ? 5 : 6; $("mkDur").value = dv; $("mkDurVal").textContent = dv + "秒"; },
  durAdj: d => {
    const c = Math.max(1, Math.min(20, Math.round((parseFloat($("mkDur").value) + parseFloat(d)) * 10) / 10));
    $("mkDur").value = c; $("mkDurVal").textContent = c + "秒";
  },
  durAdjRow: key => {
    const p = String(key).split("|"), sc = mk.scenes[+p[0]]; if (!sc) return;
    sc.d = Math.max(1, Math.min(20, Math.round((sc.d + parseFloat(p[1])) * 10) / 10));
    renderMk();
  },
  durMeas: () => {
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    const b = $("mkMeas");
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
  addScene: () => {
    mk.scenes.push({t: Math.round(clampT(now())), d: parseFloat($("mkDur").value) || 6, k: mk.type, x: $("mkText").value.trim() || LAB[mk.type]});
    mk.scenes.sort((a, b) => a.t - b.t); $("mkText").value = ""; renderMk();
  },
  pvScene: i => {
    const sc = mk.scenes[+i]; if (!sc) return;
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    mkPv = {scenes: mk.scenes.map(x => ({...x})), until: sc.t + sc.d + 3};
    playerSeek(sc.t); playerPlay();
    $("mv").scrollIntoView({behavior: "smooth"});
    toast("場面のプレビュー中(" + fmt(sc.t) + "〜" + fmt(sc.t + sc.d + 3) + ")");
  },
  pvAll: () => {
    if (!mk.scenes.length) return toast("場面を追加してください");
    if (!playerReady()) return toast(spMode ? "Spotifyプレイヤーの準備ができていません" : "動画の準備ができていません");
    const sorted = mk.scenes.map(x => ({...x})).sort((a, b) => a.t - b.t), first = sorted[0], lastS = sorted[sorted.length - 1];
    mkPv = {scenes: sorted, until: lastS.t + lastS.d + 3};
    playerSeek(first.t); playerPlay();
    $("mv").scrollIntoView({behavior: "smooth"});
    toast("作成中の推しコールをプレビュー中");
  },
  delScene: i => { mk.scenes.splice(+i, 1); renderMk(); },
  save: async pub => {
    if (!guard()) return;
    if (!mk.scenes.length) return toast("場面を追加してください");
    const ver = $("mkVer").value.trim();
    if (calls.some(c => c.ownerUid === me.uid) && !ver) return toast("2つ目以降はバージョン名を入れてください");
    if (+pub && mk.from && JSON.stringify(mk.scenes) === mk.base) return toast("参考にした推しコールと全く同じなので公開できません。少し変えてください");
    try {
      const editId = mk.editId || null;
      await addDoc(collection(db, "calls"), {ownerUid: me.uid, ownerName: prof.nick, oshi: prof.oshi, ownerIcon: prof.icon || 0, videoId: VID, versionName: ver, note: $("mkNote").value.trim(), allowRef: $("mkRef").checked, scenes: mk.scenes, public: !!+pub, hearts: 0, used: 0, createdAt: serverTimestamp()});
      if (editId) {
        try { const cs = await getDocs(query(collection(db, "calls", editId, "comments"), where("ownerUid", "==", me.uid))); await Promise.all(cs.docs.map(d => deleteDoc(d.ref))); } catch (e) {}
        try { await deleteDoc(doc(db, "calls", editId)); } catch (e) {}
      }
    } catch (e) { return toast("保存できませんでした"); }
    toast(+pub ? "公開しました" : "下書きを保存しました");
    mk = {scenes: [], type: "call", from: null, base: ""}; $("mkVer").value = $("mkNote").value = ""; renderMk(); loadCalls();
  },
  ref: id => {
    if (!guard()) return;
    const c = calls.find(x => x.id === id);
    mk = {scenes: c.scenes.map(x => ({...x})), type: "call", from: id, base: JSON.stringify(c.scenes)};
    A.closeOv(); $("mk").style.display = "flex"; renderMk(); $("mk").scrollIntoView({behavior: "smooth"});
    toast("中身を読み込みました。自分用に変えてください");
  },
  pub: async id => { const c = calls.find(x => x.id === id); try { await updateDoc(doc(db, "calls", id), {public: !c.public}); loadCalls(); } catch (e) { toast("変更できませんでした"); } },
  del: async id => { if (!confirm("この推しコールを削除しますか?")) return; try { await deleteDoc(doc(db, "calls", id)); loadCalls(); } catch (e) { toast("削除できませんでした"); } }
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]");
  if (b && A[b.dataset.a]) A[b.dataset.a](b.dataset.i, b);
});
document.addEventListener("change", e => { const b = e.target.closest("[data-c]"); if (b && A[b.dataset.c]) A[b.dataset.c](b.value, b); });
$("intro").addEventListener("click", () => { if ($("intro").style.display === "block") skipIntro(); });
$("cpos").addEventListener("input", e => { $("cards").style.bottom = 10 + +e.target.value + "px"; });
$("mkDur").addEventListener("input", e => { $("mkDurVal").textContent = e.target.value + "秒"; });
document.addEventListener("input", e => {
  const sl = e.target.closest("[data-dur]");
  if (sl) { const sc = mk.scenes[+sl.dataset.dur]; if (sc) { sc.d = parseFloat(sl.value); const v = sl.closest(".mkrow").querySelector(".durval"); if (v) v.textContent = sl.value + "秒"; } }
});
document.addEventListener("fullscreenchange", () => { if (native && !document.fullscreenElement && $("mv").classList.contains("fs")) A.fs(); });
})().catch(e => window.__show("起動エラー: " + (e && e.message)));
