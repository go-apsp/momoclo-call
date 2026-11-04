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
let SONGS = UI.songs;
async function loadSongs() {
  try {
    const snap = await getDocs(query(collection(db, "songs"), orderBy("order")));
    if (!snap.empty) {
      const arr = snap.docs.map(d => { const x = d.data(); return {s: x.title, title: x.title, vid: x.yid, startSec: x.startSec || 0, endSec: x.endSec || 0, isDefault: !!x.isDefault}; });
      SONGS.length = 0; arr.forEach(x => SONGS.push(x));
      const di = arr.findIndex(x => x.isDefault);
      if (di >= 0) si = di;
      si = Math.min(si, SONGS.length - 1); VID = SONGS[si].vid;
      UI.songSel(si);
      if (ytReady) yt.cueVideoById(VID);
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

/* ---------- MV(YouTube) ---------- */
let yt = null, ytReady = false, last = 0, drag = false;
const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player("yt", {
    videoId: VID, playerVars: {playsinline: 1, controls: 0, rel: 0},
    events: {
      onReady: () => { ytReady = true; },
      onError: () => toast("MVを表示できません。公開したURLで開いてください")
    }
  });
};
const now = () => ytReady ? yt.getCurrentTime() : 0;
const dur = () => ytReady ? (yt.getDuration() || 240) : 240;
const curRange = () => { const sg = SONGS[si]; return (sg && +sg.endSec > +sg.startSec && +sg.endSec > 0) ? {s: +sg.startSec, e: +sg.endSec} : null; };
const clampT = t => { const R = curRange(); return Math.max(R ? R.s : 0, Math.min(R ? R.e : dur(), t)); };
const rangeStart = () => { const R = curRange(); return R ? R.s : 0; };
const bar = $("bar");
bar.addEventListener("input", () => { drag = true; });
bar.addEventListener("change", () => { drag = false; if (ytReady) yt.seekTo(clampT(+bar.value), true); });

function loop(ts) {
  last = ts;
  const t = now(), st = ytReady ? yt.getPlayerState() : -1, pl = st === 1;
  $("play").textContent = $("fsplay").textContent = pl ? "一時停止" : "再生";
  if (st === 0 && sess) { sess = null; paintApply(); }   // 曲が終わったら、次回の再生でリセット
  if (mkPv && t >= mkPv.until) { mkPv = null; if (ytReady) yt.pauseVideo(); toast("プレビューが終わりました"); }   // プレビューは表示終了+3秒で止める
  const R = curRange(); if (R && pl && !mkPv && t >= R.e) yt.pauseVideo();   // 再生範囲の終わりで止める
  if (pl && act && !isMine() && !mkPv) { const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); } }   // 再生を始めてから10分を数える
  if (!drag) { bar.max = dur(); bar.value = t; }
  $("tm").textContent = fmt(t); $("dur").textContent = fmt(dur());
  const SRC = mkPv ? mkPv.scenes : EV;
  const on = SRC.filter(x => t >= x.t && t < x.t + x.d);           // いま出ている場面(重なってもそれぞれ本来のタイミング)
  UI.cards(on); UI.nexts(SRC.filter(x => t < x.t && x.t - t <= 6 && x.k !== "koko"), t);
  const tp = $("tlPos");
  if (tp) { const on2 = tlId && tlId === act && dur() > 0; tp.style.display = on2 ? "block" : "none"; if (on2) tp.style.left = "calc(64px + (100% - 72px) * " + Math.min(1, t / dur()) + ")"; }
  const e = on.slice().reverse().find(x => x.k !== "koko") || null;   // 「自分も湧く!」の対象
  document.querySelectorAll(".wk").forEach(x => x.classList.toggle("hot", !!e));
  cur = mkPv ? null : e;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

UI.songSel(si);
loadSongs();
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
  if (!calls.some(c => c.id === act)) act = calls[0] ? calls[0].id : null;
  applyAct(); render(); checkPending(true);
}
function applyAct() {
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
function renderPEv() { const el = $("pEv"); if (!el) return; const c = calls.find(x => x.id === act); el.innerHTML = c ? UI.evHtml(c, {me, liked, cmts, myNick: prof ? prof.nick : "", open: pEvOpen}) : ""; }
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
  el.innerHTML = UI.myPage({prof: prof, calls: mine.map(c => ({...c, songTitle: sTitle(c.videoId)})), pend: myPend, msgs: msgs});
}
function paintReviewBtn() { const b = $("reviewBtn"); if (!b) return; const show = !!(me && prof && pendAll.length); b.style.display = show ? "block" : "none"; b.textContent = "感想の承認待ち(" + pendAll.length + "件)"; }
function renderReview() {
  const el = $("cmList"); if (!el) return;
  el.innerHTML = pendAll.map(m => '<div class="cmt"><b>' + esc(m.name) + '</b><span>' + esc(m.text) + '</span><span class="cmtSub">' + esc(m.songTitle) + (m.ver ? " 「" + esc(m.ver) + "」" : "") + '</span><span class="cmtBtns"><button data-a="cmtOk" data-i="' + m.callId + '|' + m.id + '">公開する</button><button data-a="cmtNg" data-i="' + m.callId + '|' + m.id + '">公開しない</button></span></div>').join("") || '<div class="cmtNone">承認待ちの感想はありません</div>';
}
setInterval(() => { if (me && prof) checkPending(true); }, 60000);


/* ---------- 作成 ---------- */
function renderMk() { $("mkList").innerHTML = UI.mkList(mk.scenes); }

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
  introTm.push(setTimeout(() => { yt.playVideo(); el.style.transition = "opacity .35s"; el.style.opacity = "0"; }, 6900));
  introTm.push(setTimeout(() => { el.style.display = "none"; el.classList.remove("whiteout"); el.style.transition = ""; clearIntroTm(); }, 7300));
}
function skipIntro() { clearIntroTm(); const el = $("intro"); el.style.display = "none"; el.classList.remove("whiteout"); yt.playVideo(); }
const A = {
  login: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { toast("ログインできませんでした"); } },
  logout: async () => { await signOut(auth); A.menu(); toast("ログアウトしました"); },
  copyLink: async () => {
    const u = "https://go-apsp.github.io/momoclo-call/";
    try { await navigator.clipboard.writeText(u); toast("リンクをコピーしました"); }
    catch { const ta = document.createElement("textarea"); ta.value = u; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("リンクをコピーしました"); }
  },
  spGo: () => { if (confirm("Spotify版へ移行します。この先は表示はできますが、ご使用になられたい場合は、アカウントの表示名と、Spotifyアカウントに登録しているメールアドレスを知らせていただくことになります。ただし先着24名まで（SpotifyのAPIの仕様上）。")) location.href = "spotify.html"; },
  whoami: () => { if (!me || !prof) return; $("mypage").style.display = "block"; loadMyPage(); },
  closeMy: () => { $("mypage").style.display = "none"; },
  userPage: uid => { if (me && uid === me.uid) return A.whoami(); openUserPage(uid); },
  closeUser: () => { $("userpage").style.display = "none"; },
  mypOpen: async key => {
    const p = key.split("|"), idx = SONGS.findIndex(s => s.vid === p[0]);
    $("mypage").style.display = "none";
    $("userpage").style.display = "none";
    if (idx >= 0 && idx !== si) { si = idx; VID = SONGS[si].vid; try { localStorage.setItem("momo_song", si); } catch (e) {} UI.songSel(si); if (ytReady) yt.cueVideoById(VID); }
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
    if (ytReady) yt.cueVideoById(VID);
    mkPv = null; refPlay = false; randPlay = false;
    mk = {scenes: [], type: "call", from: null, base: ""}; renderMk(); UI.songSel(si); sess = null; paintApply(); applyAct(); loadCalls();
  },
  menu: () => { const m = $("menu"); m.style.display = m.style.display === "block" ? "none" : "block"; },
  openOv: () => { $("menu").style.display = "none"; $("ov").style.display = "block"; render(); },
  closeOv: () => { $("ov").style.display = "none"; },
  play: () => {
    if (!ytReady) return;
    if (sess && sess.t0 && Date.now() - sess.t0 > LIMIT) { sess = null; paintApply(); }
    if ($("intro").style.display === "block") { skipIntro(); return; }
    if (yt.getPlayerState() === 1) { yt.pauseVideo(); return; }
    const R = curRange();
    if (R) { const t = yt.getCurrentTime(); if (t < R.s - 0.05 || t >= R.e - 0.3) yt.seekTo(R.s, true); }
    if (yt.getPlayerState() === 2 && yt.getCurrentTime() > 1) { yt.playVideo(); return; }
    runIntro();
  },
  pen: () => $("pen").classList.toggle("on"),
  penColor: (i, b) => { $("pen").style.color = PEN[i][1]; document.documentElement.style.setProperty("--pc", PEN[i][1]); document.querySelectorAll("#dots button").forEach(x => x.classList.toggle("sel", x === b)); },
  help: () => toast("このタイミングで一緒にコールやシンガロンができます"),
  waku: async () => {
    if (!cur) return toast("コール・シンガロンの場面で押してね");
    if (refPlay || randPlay) return toast("一緒に湧いた!");
    if (isMine()) return toast("一緒に湧いた! ※自分の推しコールなのでスコアは反映されません");
    const q = sessFor(); if (!q.t0) { q.t0 = Date.now(); q.ready = loadPrev(q); }
    if (Date.now() - q.t0 > LIMIT) return toast("タイム制限がかかりました。これ以上は反映されません。次回再生時にリセットされます", 4500);
    await q.ready; q.n++;
    toast(me && prof ? "一緒に湧いた! 今回 " + q.n + " 回" : "一緒に湧いた! ※ログインすると、スコアに反映されます");
    if (q.first) { clearTimeout(q.tm); q.tm = setTimeout(() => saveWaku(q), 2500); } else paintApply();
  },
  apply: () => { if (sess) saveWaku(sess); },
  pickIcon: i => { pickI = +i; UI.sheetIcons(pickI); },
  tl: id => { const c = calls.find(x => x.id === id); if (!c) return; tlId = id; tlZoom = false; tlD = Math.max(dur() || 0, c.scenes.reduce((m, s) => Math.max(m, s.t + s.d), 0), 1); $("tlBody").innerHTML = UI.timeline(c, tlD, false); $("tlov").style.display = "block"; },
  tlZoom: () => { const c = calls.find(x => x.id === tlId); if (!c) return; tlZoom = !tlZoom; $("tlBody").innerHTML = UI.timeline(c, tlD, tlZoom); },
  closeTl: () => { $("tlov").style.display = "none"; tlId = null; tlZoom = false; },
  tlMark: i => { const c = calls.find(x => x.id === tlId); if (!c) return; const s2 = c.scenes[+i]; if (s2) $("tlInfo").textContent = fmt(s2.t) + " " + LAB[s2.k] + " 「" + s2.x + "」"; },
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
    refPlay = true; randPlay = false; act = null; sess = null; paintApply();
    EV = c.scenes.map(x => ({...x})).sort((a, b) => a.t - b.t);
    $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">参考コール' + (c.versionName ? "<i>" + esc(c.versionName) + "</i>" : "") + "</div>";
    $("info").textContent = "";
    $("panelbody").innerHTML = "参考コールで再生中です";
    renderPEv();
    A.closeRef();
    if (ytReady) yt.seekTo(rangeStart(), true);
    toast("参考コールで再生します");
  },
  randomPlay: () => {
    const pubs = calls.filter(c => c.public);
    if (!pubs.length) return toast("公開中の推しコールがまだありません");
    const byT = new Map();
    pubs.forEach(c => (c.scenes || []).forEach(sc => { const k = Math.round(sc.t); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(sc); }));
    const scenes = [...byT.keys()].sort((a, b) => a - b).map(t => { const arr = byT.get(t); return {...arr[Math.floor(Math.random() * arr.length)], t}; });
    if (!scenes.length) return toast("場面がまだありません");
    randPlay = true; refPlay = false; act = null; sess = null; paintApply();
    EV = scenes.sort((a, b) => a.t - b.t);
    $("who").innerHTML = '<div class="st">♪ ' + esc(SONGS[si].title) + '</div><div class="wn">コールランダム再生モード</div>';
    $("info").textContent = "";
    $("panelbody").innerHTML = "コールランダム再生モードです。みんなの推しコールから、場面ごとに選んで再生しています";
    renderPEv();
    A.closeOv();
    if (ytReady) yt.seekTo(rangeStart(), true);
    toast("コールランダム再生モードで再生します");
  },
  mkv: () => { $("mkvWarn").style.display = "flex"; },
  mkvCancel: () => { $("mkvWarn").style.display = "none"; },
  mkvOk: () => { $("mkvWarn").style.display = "none"; $("mkvPage").style.display = "block"; },
  closeMkv: () => { $("mkvPage").style.display = "none"; },
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
  use: id => { act = id; refPlay = false; randPlay = false; sess = null; paintApply(); applyAct(); A.closeOv(); },
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
  seek: (d) => { if (ytReady) yt.seekTo(clampT(now() + +d), true); },
  pseek: (d) => { if (ytReady) yt.seekTo(clampT(now() + +d), true); },
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
    if (!ytReady) return toast("動画の準備ができていません");
    const b = $("mkMeas");
    if (mkMeas === null) {
      mkMeas = now();
      if (yt.getPlayerState() !== 1) yt.playVideo();
      b.textContent = "■ ストップ(計測中…)";
      toast("再生中です。表示を止めたいところでストップを押してください");
    } else {
      const d = Math.round((now() - mkMeas) * 10) / 10;
      mkMeas = null;
      yt.pauseVideo();
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
    if (!ytReady) return toast("動画の準備ができていません");
    mkPv = {scenes: mk.scenes.map(x => ({...x})), until: sc.t + sc.d + 3};
    yt.seekTo(sc.t, true); yt.playVideo();
    $("mv").scrollIntoView({behavior: "smooth"});
    toast("場面のプレビュー中(" + fmt(sc.t) + "〜" + fmt(sc.t + sc.d + 3) + ")");
  },
  pvAll: () => {
    if (!mk.scenes.length) return toast("場面を追加してください");
    if (!ytReady) return toast("動画の準備ができていません");
    const sorted = mk.scenes.map(x => ({...x})).sort((a, b) => a.t - b.t), first = sorted[0], lastS = sorted[sorted.length - 1];
    mkPv = {scenes: sorted, until: lastS.t + lastS.d + 3};
    yt.seekTo(first.t, true); yt.playVideo();
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
