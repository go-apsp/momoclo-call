(async () => {
window.__step("1 モジュール開始");
const B = "https://www.gstatic.com/firebasejs/10.12.2/";
const M = {};
for (const n of ["app", "auth", "firestore"]) {
  try { window.__step("2 読み込み中: " + n); M[n] = await import(B + "firebase-" + n + ".js"); }
  catch (e) { window.__show("読み込み失敗: firebase-" + n + " / " + (e && e.message)); throw e; }
}
const { initializeApp } = M.app;
const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = M.auth;
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, increment, writeBatch, serverTimestamp } = M.firestore;

window.__step("3 部品の読み込み完了");
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
const VID = "tCD81ACqUYk";   // ももいろクローバーZ【MV】走れ!-PLAY ACTIVE!2022 ver.-(公式)
const LAB = {call: "コール", sing: "シンガロン", koko: "ココ好き!"};
const OSHI = [["赤推し","#ff3b4f"],["黄色推し","#ffd23f"],["ピンク推し","#ff7ab8"],["紫推し","#a66bff"],["箱推し","#000000"],["決まってない","#ffffff"]];
const PEN = [["赤","#ff3b4f"],["黄","#ffd23f"],["ピンク","#ff7ab8"],["紫","#a66bff"],["白","#ffffff"]];

const auth = getAuth(initializeApp(firebaseConfig)), db = getFirestore(auth.app);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = t => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
const colorOf = i => (OSHI[i] || OSHI[5])[1];
function toast(s) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("on"), 2400); }

let me = null, prof = null, calls = [], liked = new Set(), act = null, openId = null;
let EV = [], cur = null, cnt = 0;
let mk = {scenes: [], type: "call", from: null, base: ""};

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
const bar = $("bar");
bar.addEventListener("input", () => { drag = true; });
bar.addEventListener("change", () => { drag = false; if (ytReady) yt.seekTo(+bar.value, true); });

function loop(ts) {
  last = ts;
  const t = now(), pl = ytReady && yt.getPlayerState() === 1;
  $("play").textContent = pl ? "一時停止" : "再生";
  if (!drag) { bar.max = dur(); bar.value = t; }
  $("tm").textContent = fmt(t); $("dur").textContent = fmt(dur());
  const e = EV.find(x => t >= x.t && t < x.t + x.d);
  const n = EV.find(x => t < x.t && x.t - t <= 6);
  $("card").classList.toggle("on", !!e);
  if (e) { $("cl").textContent = LAB[e.k]; $("tx").textContent = e.x; }
  $("nosc").style.display = e && e.mine && e.k !== "koko" ? "block" : "none";
  const nx = $("next");
  nx.style.opacity = n && !e ? 1 : 0;
  if (n) { nx.textContent = "NEXT " + LAB[n.k]; nx.style.transform = "scale(" + (0.7 + 0.5 * (1 - (n.t - t) / 6)) + ")"; }
  $("wakubtn").classList.toggle("hot", !!e && e.k !== "koko");
  cur = e;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

$("dots").innerHTML = PEN.map((p, i) => `<button aria-label="${p[0]}" data-a="penColor" data-i="${i}" class="${i === 2 ? "sel" : ""}"><i style="background:${p[1]}"></i></button>`).join("");

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
  if (me && prof) b.outerHTML = `<button id="me" style="border-color:${colorOf(prof.oshi)}" aria-label="${esc(prof.nick)}" data-a="whoami">${esc(prof.nick.slice(0, 1))}</button>`;
  else b.outerHTML = `<button class="pill" id="login" data-a="login">ログイン</button>`;
  $("mkbtn").style.display = $("oshibtn").style.display = $("logout").style.display = me && prof ? "block" : "none";
  if (!(me && prof)) A.endMk();
}
function openSheet(edit) {
  const sh = $("sheet").firstElementChild;
  sh.querySelectorAll("button").forEach(b => b.remove());
  sh.querySelector("h2").textContent = edit ? "推しの変更" : "はじめての登録";
  $("nick").value = edit && prof ? prof.nick : "";
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
  applyAct(); render();
}
function applyAct() {
  const c = calls.find(x => x.id === act);
  EV = c ? c.scenes.map(x => ({...x, mine: !!me && c.ownerUid === me.uid})).sort((a, b) => a.t - b.t) : [];
  $("info").textContent = c ? `再生中: ${c.ownerName}さんの推しコール${c.versionName ? "(" + c.versionName + ")" : ""}` : "まだ推しコールがありません。ログインして作ってみましょう";
}

/* ---------- 一覧(一番上のレイヤー) ---------- */
function render() {
  $("list").innerHTML = calls.map(c => {
    const own = me && c.ownerUid === me.uid, col = colorOf(c.oshi);
    return `<div class="u${c.id === openId ? " open" : ""}" style="box-shadow:0 0 0 1.5px ${col}99;background:linear-gradient(160deg,${col}40,#262a4a 65%)">
    <button class="hd" data-a="toggle" data-i="${c.id}"><span class="av" style="border-color:${col}">${esc(c.ownerName.slice(0, 1))}</span>
      <span class="sp">${esc(c.ownerName)}さんの<b style="color:${col === "#000000" ? "#fff" : col}">推し</b>コール${c.versionName ? `<span class="tag">${esc(c.versionName)}</span>` : ""}${c.public ? "" : `<span class="tag">下書き</span>`}</span>
      <span style="color:${col === "#000000" ? "#fff" : col}">♥${c.hearts || 0}</span></button>
    <div class="dt">${c.note ? `<div>備考:${esc(c.note)}</div>` : ""}
      <div class="used">みんなが ${c.used || 0}回 一緒に湧きました</div>
      <div class="act">
        <button class="hr" style="background:${liked.has(c.id) ? "#ff3b4f" : "#3a3f6b"}" data-a="heart" data-i="${c.id}">♥ ${c.hearts || 0}</button>
        <button class="w" data-a="use" data-i="${c.id}">これで再生</button>
        ${!own && c.allowRef ? `<button data-a="ref" data-i="${c.id}">参考にする</button>` : ""}
        ${own ? `<button data-a="pub" data-i="${c.id}">${c.public ? "非公開にする" : "公開する"}</button><button data-a="del" data-i="${c.id}">削除</button>` : ""}
      </div></div></div>`;
  }).join("") || '<div style="color:var(--mut);font-size:13px">まだ推しコールがありません。</div>';
}

/* ---------- 作成 ---------- */
function renderMk() {
  $("mkList").innerHTML = mk.scenes.map((e, i) => `<div class="mkrow"><span>${fmt(e.t)}</span><span>${LAB[e.k]}</span><span class="sp">${esc(e.x)}</span><button aria-label="削除" data-a="delScene" data-i="${i}">×</button></div>`).join("")
    || '<div style="font-size:12px;color:var(--mut)">動画を止めて、追加したい位置で「この位置に追加」を押します。</div>';
}

/* ---------- 操作 ---------- */
const guard = () => (me && prof) || (toast("ログインすると使えます"), false);
const A = {
  login: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { toast("ログインできませんでした"); } },
  logout: async () => { await signOut(auth); A.menu(); toast("ログアウトしました"); },
  whoami: () => toast(prof.nick + "さんでログイン中"),
  menu: () => { const m = $("menu"); m.style.display = m.style.display === "block" ? "none" : "block"; },
  openOv: () => { $("menu").style.display = "none"; $("ov").style.display = "block"; render(); },
  closeOv: () => { $("ov").style.display = "none"; },
  play: () => { if (!ytReady) return; yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo(); },
  pen: () => $("pen").classList.toggle("on"),
  penColor: (i, b) => { $("pen").style.color = PEN[i][1]; document.querySelectorAll("#dots button").forEach(x => x.classList.toggle("sel", x === b)); },
  help: () => toast("このタイミングで一緒にコールやシンガロンができます"),
  waku: () => {
    if (!cur || cur.k === "koko") return toast("コール・シンガロンの場面で押してね");
    if (cur.mine) return toast("一緒に湧いた! ※自分の推しコールなのでスコアは反映されません");
    cnt++; toast("一緒に湧いた! 今回 " + cnt + " 回");
    const c = calls.find(x => x.id === act);
    if (me && prof && c) { c.used = (c.used || 0) + 1; updateDoc(doc(db, "calls", c.id), {used: increment(1)}).catch(() => {}); }
  },
  toggle: id => { openId = openId === id ? null : id; render(); },
  use: id => { act = id; applyAct(); A.closeOv(); },
  heart: async id => {
    if (!guard()) return;
    const c = calls.find(x => x.id === id), hr = doc(db, "calls", id, "hearts", me.uid), b = writeBatch(db), was = liked.has(id);
    if (was) { b.delete(hr); b.update(doc(db, "calls", id), {hearts: increment(-1)}); liked.delete(id); c.hearts--; }
    else { b.set(hr, {at: serverTimestamp()}); b.update(doc(db, "calls", id), {hearts: increment(1)}); liked.add(id); c.hearts = (c.hearts || 0) + 1; }
    render();
    try { await b.commit(); } catch (e) { toast("ハートを反映できませんでした"); loadCalls(); }
  },
  register: async i => {
    const nick = $("nick").value.trim();
    if (!nick) return toast("ニックネームを入れてください");
    const before = prof, next = {nick, oshi: +i};
    try {
      await setDoc(doc(db, "users", me.uid), before ? next : {...next, createdAt: serverTimestamp()}, {merge: true});
      if (before && (before.oshi !== next.oshi || before.nick !== nick)) {   // 推し・名前を変えたら、自分の推しコールも合わせる
        const b = writeBatch(db);
        calls.filter(c => c.ownerUid === me.uid).forEach(c => b.update(doc(db, "calls", c.id), {oshi: next.oshi, ownerName: nick}));
        await b.commit();
      }
    } catch (e) { return toast("保存できませんでした"); }
    prof = next; $("sheet").style.display = "none"; paintLogin();
    toast(before ? "変更しました" : nick + "さん、登録しました"); loadCalls();
  },
  editProf: () => { A.menu(); openSheet(true); },
  closeSheet: () => { $("sheet").style.display = "none"; },
  startMk: () => { if (!guard()) return; A.menu(); $("mk").style.display = "flex"; renderMk(); $("mk").scrollIntoView({behavior: "smooth"}); },
  endMk: () => { $("mk").style.display = "none"; },
  seek: (d) => { if (ytReady) yt.seekTo(Math.max(0, Math.min(dur(), now() + +d)), true); },
  type: (k) => { mk.type = k; document.querySelectorAll("#mkTypes button").forEach(b => b.classList.toggle("sel", b.dataset.i === k)); },
  addScene: () => {
    mk.scenes.push({t: Math.round(now()), d: mk.type === "koko" ? 5 : 6, k: mk.type, x: $("mkText").value.trim() || LAB[mk.type]});
    mk.scenes.sort((a, b) => a.t - b.t); $("mkText").value = ""; renderMk();
  },
  delScene: i => { mk.scenes.splice(+i, 1); renderMk(); },
  save: async pub => {
    if (!guard()) return;
    if (!mk.scenes.length) return toast("場面を追加してください");
    const ver = $("mkVer").value.trim();
    if (calls.some(c => c.ownerUid === me.uid) && !ver) return toast("2つ目以降はバージョン名を入れてください");
    if (+pub && mk.from && JSON.stringify(mk.scenes) === mk.base) return toast("参考にした推しコールと全く同じなので公開できません。少し変えてください");
    try {
      await addDoc(collection(db, "calls"), {ownerUid: me.uid, ownerName: prof.nick, oshi: prof.oshi, videoId: VID, versionName: ver, note: $("mkNote").value.trim(), allowRef: $("mkRef").checked, scenes: mk.scenes, public: !!+pub, hearts: 0, used: 0, createdAt: serverTimestamp()});
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
})().catch(e => window.__show("起動エラー: " + (e && e.message)));
