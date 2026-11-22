/* =====================================================================
   build 69: 会場モード v3（再生画面）
   v1 の概念違い（オンにすると全画面化してしまう）を v2 で修正し、
   v3 では実ブラウザ確認で判明した「映像が絵のスクリーンに収まらない」
   不具合と、ラベル・ボタンの重なりを直した版。
   自己完結モジュールで、app.js 本体には触らない（#modebar へトグル
   ボタンを足し、#mv の中に会場レイヤーを作る）。

   v3 の要点（#yt の競合対策）:
   app.js は YouTube IFrame API で new YT.Player("yt", ...) を作る。
   このとき API はプレースホルダの <div id="yt"> を新しい
   <iframe id="yt"> に差し替える。v2 は読み込み時点の #yt（まだ div）
   を掴んでいたため、差し替え後の本物の iframe にはスタイルが一切
   届かず、style.css の #yt{inset:0;width:100%;height:100%} のまま
   枠いっぱいに表示されていた。v3 では #yt を毎回引き直し、要素が
   差し替わっていたら掴み直す。さらに配置は inline style の
   !important で書き、style.css の #yt 規則に確実に勝つ。会場モード
   終了時は、掴んだ要素の style 属性を丸ごと元に戻す。

   仕様（v2）:
   - 既定オフ。オンにしても全画面化しない。再生画面にある もともとの
     YouTube 枠（#mv の通常表示サイズ・位置そのまま）の中に会場の
     光景を再現する。枠の外のレイアウト（コールカード・操作ボタン・
     モードバー等）は通常表示のまま一切変えない。
   - 枠の中では、会場の背景絵が広がり、YouTube 映像（#yt）が絵の中の
     スクリーン位置に重なる。正面を向いたとき、絵の中のスクリーン幅が
     枠の幅の約97%になり、少しだけ会場の縁が見える。
   - 見回し: 横はコンパス方位（開始方位からの相対）、縦は傾き。ドラッグ
     でも見回せる。世界は枠からはみ出さない（#mv の overflow:hidden で
     クリップ）。手ブレ補正の標準は ×2.00。ジャイロ調整スライダー
     （補正の強さ・感度・デッドバンド、初期値に戻す付き）を持つ。
   - 会場モード専用の「全画面」ボタンを押したときだけ、枠ごと（会場
     背景＋映像の構図のまま）全画面に広がる（.vnfs の固定表示方式）。
     アプリ既存の全画面（#mv.fs + Fullscreen API）とは競合させない:
     会場モード中は既存の全画面ボタン（#fsbtn / #fsExit）を隠し、
     Fullscreen API は使わない。
   - 会場は小さなボタン1つで ライブハウス→スタジアム→アリーナ→山脈→
     豪華客船 の順に切替。ライブハウスは縦長フレーム4枚を約0.4秒間隔・
     フェードなしで切り替える立ち姿アニメ。他会場は静止画1枚。
   - 会場名ラベルと会場用ボタン列・調整パネルは、枠の中ではなく
     枠の外（#mv の直下に作る .vn-dock の中）に置き、映像に重ならない
     ようにする（v3）。会場全画面（.vnfs）のときだけドックごと枠の
     中（下部）へ移す。
   - コールカード（#cards）は従来どおり画面に対して固定表示。
     世界と一緒に動かさない（本番の従来表示に準ずる）。
   - 再生/ペンライト/湧く! の .fsonly ボタンは、会場全画面（.vnfs）の
     ときだけ表示する（枠内表示のときは通常レイアウトのまま）。
   - モードバーの「会場モード」ボタンは大きめ・目立つ色にし、オン時は
     塗りつぶし＋「ON」表記で一目で分かるようにする。
   - 作成画面・シェアポイント作成画面へ移ったら自動で会場モードを終える。
   ===================================================================== */
(function () {
  "use strict";
  var mv = document.getElementById("mv");
  var modebar = document.getElementById("modebar");
  if (!mv || !modebar) return;

  /* ---------- スタイル ---------- */
  var css = [
    "#mv.vn{background:#101319;perspective:1500px;touch-action:none}",
    "#mv.vnfs{position:fixed;inset:0;z-index:60;border-radius:0;aspect-ratio:auto;height:100dvh}",
    "#mv.vn #fsbtn,#mv.vn #fsExit{display:none!important}",
    "#mv.vnfs .fsonly{display:flex}",
    ".vn-world{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;z-index:0}",
    ".vn-world img{display:block;width:100%;height:100%}",
    "#mv.vn #yt{border-radius:2px;box-shadow:0 0 0 3px rgba(8,10,14,.9),0 4px 18px rgba(0,0,0,.5);background:#000;will-change:transform}",
    ".vn-dock{display:none;margin-top:8px}",
    "#mv.vn + .vn-dock{display:block}",
    "#mv.vnfs .vn-dock{display:block;position:absolute;left:10px;right:10px;bottom:10px;z-index:56;margin-top:0}",
    ".vn-dockrow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
    ".vn-badge{display:inline-flex;background:rgba(10,12,16,.55);border:1px solid rgba(147,167,196,.45);border-radius:999px;padding:3px 12px;color:#cfd9e8;font-size:.8rem;pointer-events:none}",
    ".vn-ui{display:flex;flex-wrap:wrap;gap:6px}",
    ".vn-ui button{min-height:34px;padding:5px 11px;font-size:.8rem;border-radius:999px;background:rgba(10,12,16,.72);border:1px solid rgba(147,167,196,.55);color:#eef2f8;font:inherit;cursor:pointer}",
    ".vn-ui button[aria-pressed=\"true\"]{background:#e4572e;border-color:#e4572e;color:#fff;font-weight:700}",
    ".vn-ui .vn-venue{font-weight:700}",
    ".vn-tune{display:none;margin-top:8px;background:rgba(14,16,28,.94);border:1px solid rgba(147,167,196,.45);border-radius:12px;padding:10px 12px;color:#eef2f8;font-size:.85rem}",
    ".vn-tune.open{display:block}",
    ".vn-tune .vrow{display:flex;align-items:center;gap:10px;margin:7px 0}",
    ".vn-tune label{white-space:nowrap;min-width:5.6em;font-size:.82rem}",
    ".vn-tune input[type=range]{flex:1;min-height:32px;min-width:110px}",
    ".vn-val{font-variant-numeric:tabular-nums;font-weight:700;min-width:3.6em;font-size:.88rem}",
    ".vn-tune button{min-height:32px;padding:4px 12px;font-size:.8rem;border-radius:9px;background:#21243d;border:1px solid rgba(147,167,196,.55);color:#eef2f8;font:inherit;cursor:pointer}",
    ".vn-tune .vnote{font-size:.76rem;color:#a7abb5;line-height:1.5;margin-top:6px}",
    "#venueBtn{min-height:44px;padding:10px 20px;border-radius:999px;font-size:1rem;font-weight:900;letter-spacing:.03em;border:2px solid #ff7ab8;color:#ff7ab8;background:rgba(255,122,184,.14)}",
    "#venueBtn.on{background:#ff7ab8;border-color:#ff7ab8;color:#14152b;box-shadow:0 0 0 3px rgba(255,122,184,.35),0 4px 14px rgba(255,122,184,.45)}"
  ].join("\n");
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- DOM ---------- */
  // 会場の絵のレイヤー（#mv の一番後ろに入れる。#mv の overflow:hidden で
  // 枠の外にはみ出さない）
  var world = document.createElement("div");
  world.className = "vn-world";
  world.setAttribute("aria-hidden", "true");
  var img = document.createElement("img");
  img.id = "vnImg";
  img.alt = "";
  world.appendChild(img);
  mv.insertBefore(world, mv.firstChild);

  // 会場名ラベル・ボタン列・調整パネルは、映像に重ねず枠の外に出すため、
  // #mv の直後（弟要素）にドックを作ってそこへ入れる。会場全画面
  // （.vnfs）のときだけ、fsEnter/fsExit がドックごと枠の中へ出し入れする。
  var dock = document.createElement("div");
  dock.className = "vn-dock";
  var dockRow = document.createElement("div");
  dockRow.className = "vn-dockrow";
  dock.appendChild(dockRow);
  mv.parentNode.insertBefore(dock, mv.nextSibling);

  var badge = document.createElement("div");
  badge.className = "vn-badge";
  badge.textContent = "ライブハウス";
  dockRow.appendChild(badge);

  var tune = document.createElement("div");
  tune.className = "vn-tune";
  tune.id = "vnTune";
  tune.innerHTML =
    '<div class="vrow"><label for="vnTuneSmooth">補正の強さ</label>' +
    '<input type="range" id="vnTuneSmooth" min="0.5" max="4" step="0.05" value="2">' +
    '<span class="vn-val" id="vnTuneSmoothVal">×2.00</span></div>' +
    '<div class="vrow"><label for="vnTuneSens">感度</label>' +
    '<input type="range" id="vnTuneSens" min="0.5" max="2" step="0.05" value="1">' +
    '<span class="vn-val" id="vnTuneSensVal">×1.00</span></div>' +
    '<div class="vrow"><label for="vnTuneDead">デッドバンド</label>' +
    '<input type="range" id="vnTuneDead" min="0" max="3" step="0.1" value="1">' +
    '<span class="vn-val" id="vnTuneDeadVal">×1.0</span></div>' +
    '<div class="vrow"><button type="button" id="vnTuneReset">初期値に戻す</button></div>' +
    '<div class="vnote" id="vnGyroStatus">スライダーを動かすと、その場でジャイロの効き方が変わります。標準は補正の強さ×2.00・感度×1.00・デッドバンド×1.0です。</div>';
  dock.appendChild(tune);

  var ui = document.createElement("div");
  ui.className = "vn-ui";
  ui.innerHTML =
    '<button type="button" class="vn-venue" id="vnVenueBtn" aria-label="会場を切り替える（タップするたびに次の会場へ）">会場：ライブハウス ›</button>' +
    '<button type="button" id="vnGyroBtn" aria-pressed="false">傾きで見る</button>' +
    '<button type="button" id="vnTuneBtn" aria-expanded="false">ジャイロ調整</button>' +
    '<button type="button" id="vnFsBtn" aria-pressed="false">全画面</button>' +
    '<button type="button" id="vnExitBtn">会場モードを終わる</button>';
  dockRow.appendChild(ui);

  // 再生画面のモードバーにトグルを追加（分かりやすい大きめボタンにする）
  var toggleBtn = document.createElement("button");
  toggleBtn.id = "venueBtn";
  toggleBtn.className = "modebtn";
  toggleBtn.type = "button";
  toggleBtn.textContent = "会場モード";
  toggleBtn.setAttribute("aria-pressed", "false");
  modebar.appendChild(toggleBtn);

  /* #yt は掴みっぱなしにしない。app.js が YouTube IFrame API で
     プレーヤーを作ると、<div id="yt"> が <iframe id="yt"> に差し替わる
     （app.js の new YT.Player("yt", ...)）。差し替え前の要素へ書き続けても
     画面には届かないので、使うたびに引き直し、要素が変わっていたら
     その要素の元の style 属性を保存し直す。終了時は保存した style 属性を
     丸ごと戻し、#yt を完全に元の状態へ復元する。 */
  var styledEl = null;   // いま venue がスタイルを書いている #yt 要素
  var savedStyle = null; // その要素の元の style 属性（文字列。無ければ null）
  function claimYt() {
    var el = document.getElementById("yt");
    if (!el) return null;
    if (el !== styledEl) {
      styledEl = el;
      savedStyle = el.getAttribute("style");
    }
    return el;
  }
  function restoreYt() {
    if (!styledEl) return;
    var el = styledEl;
    styledEl = null;
    if (savedStyle === null) el.removeAttribute("style");
    else el.setAttribute("style", savedStyle);
    savedStyle = null;
  }
  var venueBtn = document.getElementById("vnVenueBtn");
  var gyroBtn = document.getElementById("vnGyroBtn");
  var tuneBtn = document.getElementById("vnTuneBtn");
  var fsBtn = document.getElementById("vnFsBtn");
  var exitBtn = document.getElementById("vnExitBtn");
  var gyroStatus = document.getElementById("vnGyroStatus");

  /* ---------- 会場データ（デモで実測した PAINT をそのまま使う） ---------- */
  var VENUES = [
    { id: "livehouse", name: "ライブハウス", iw: 1200, ih: 1440,
      frames: [
        { src: "venue/livehouse-1.webp", paint: { x: 0.252, y: 0.379, w: 0.492, h: 0.249 } },
        { src: "venue/livehouse-2.webp", paint: { x: 0.248, y: 0.356, w: 0.500, h: 0.258 } },
        { src: "venue/livehouse-3.webp", paint: { x: 0.248, y: 0.355, w: 0.502, h: 0.280 } },
        { src: "venue/livehouse-4.webp", paint: { x: 0.254, y: 0.351, w: 0.488, h: 0.253 } }
      ] },
    { id: "stadium", name: "スタジアム", src: "venue/stadium.webp", iw: 2352, ih: 1008,
      paint: { x: 0.334, y: 0.322, w: 0.406, h: 0.317 } },
    { id: "arena", name: "アリーナ", src: "venue/arena.webp", iw: 2352, ih: 1008,
      paint: { x: 0.264, y: 0.380, w: 0.499, h: 0.415 } },
    { id: "mountains", name: "山脈", src: "venue/mountains.webp", iw: 2352, ih: 1008,
      paint: { x: 0.365, y: 0.322, w: 0.280, h: 0.280 } },
    { id: "cruise", name: "豪華客船", src: "venue/cruise.webp", iw: 2352, ih: 1008,
      paint: { x: 0.344, y: 0.165, w: 0.328, h: 0.392 } }
  ];
  var venueIdx = 0;
  var frameIdx = 0;
  var frameTimer = null;
  var FRAME_MS = 400;
  var preloaded = false;

  function curPaint(V) {
    if (V.frames) return V.frames[frameIdx % V.frames.length].paint;
    return V.paint;
  }
  function curSrc(V) {
    if (V.frames) return V.frames[frameIdx % V.frames.length].src;
    return V.src;
  }
  function preload() {
    if (preloaded) return;
    preloaded = true;
    for (var vi = 0; vi < VENUES.length; vi++) {
      var srcs = VENUES[vi].frames
        ? VENUES[vi].frames.map(function (f) { return f.src; })
        : [VENUES[vi].src];
      for (var si = 0; si < srcs.length; si++) {
        var pre = new Image();
        pre.src = srcs[si];
      }
    }
  }
  function stopFrames() {
    if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
  }
  function startFrames() {
    stopFrames();
    if (!on || !VENUES[venueIdx].frames) return;
    frameTimer = setInterval(function () {
      frameIdx = (frameIdx + 1) % VENUES[venueIdx].frames.length;
      img.src = curSrc(VENUES[venueIdx]);
      apply();
    }, FRAME_MS);
  }
  function setVenue(i) {
    venueIdx = ((i % VENUES.length) + VENUES.length) % VENUES.length;
    var V = VENUES[venueIdx];
    frameIdx = 0;
    var s = curSrc(V);
    if (img.getAttribute("src") !== s) img.src = s;
    venueBtn.textContent = "会場：" + V.name + " ›";
    badge.textContent = V.name;
    startFrames();
    apply();
  }
  venueBtn.addEventListener("click", function () { setVenue(venueIdx + 1); });

  /* ---------- 見回し ---------- */
  var on = false;
  var fsOn = false;
  var target = 0, current = 0;       // 横の視点 (-90..90)
  var targetP = 0, currentP = 0;     // 縦の視点 (-35..35、正で見上げ)
  var gyroOn = false;
  var gyroBaseH = null, gyroBaseY = null;
  var gyroSH = null, gyroSY = null;
  var gyroAngle = null, gyroRecal = false;
  var tuneVal = { smooth: 2, sens: 1, dead: 1 };
  var rafId = null;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SCREEN_FIT = 0.97;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function setTarget(v) { target = clamp(v, -90, 90); }
  function setTargetP(v) { targetP = clamp(v, -35, 35); }

  // 枠（#mv の現在の表示サイズ）の中に世界を置く。
  // 正面では絵の中のスクリーン中心が枠の中心に来て、スクリーン幅が
  // 枠幅の約97%になる大きさにする（縦長絵でスクリーン高さが枠高さを
  // 超える場合は、スクリーン全体が枠に収まるよう少し縮める）。
  // 見回しの移動量は「世界が枠を覆い続けられる範囲」に制限する。
  function apply() {
    if (!on) return;
    var w = mv.clientWidth;
    var h = mv.clientHeight;
    if (!w || !h) return;
    var V = VENUES[venueIdx];
    var PAINT = curPaint(V);
    var AR = V.iw / V.ih;
    var paintCx = PAINT.x + PAINT.w / 2;
    var paintCy = PAINT.y + PAINT.h / 2;
    var Lw = w * SCREEN_FIT / PAINT.w;
    var Lh = Lw / AR;
    if (Lh * PAINT.h > h * 0.98) {
      Lh = h * 0.98 / PAINT.h;
      Lw = Lh * AR;
    }
    var baseX, baseY, maxX = 0, maxY = 0;
    if (Lw > w) {
      baseX = clamp(w / 2 - Lw * paintCx, w - Lw, 0);
      maxX = Math.max(0, Math.min(baseX - (w - Lw), 0 - baseX));
    } else {
      baseX = (w - Lw) / 2;
    }
    if (Lh > h) {
      baseY = clamp(h / 2 - Lh * paintCy, h - Lh, 0);
      maxY = Math.max(0, Math.min(baseY - (h - Lh), 0 - baseY));
    } else {
      baseY = (h - Lh) / 2;
    }
    world.style.width = Lw + "px";
    world.style.height = Lh + "px";
    var shiftX = (current / 90) * maxX;
    var shiftY = (currentP / 35) * maxY;
    var wx = baseX - shiftX;
    var wy = baseY + shiftY;
    world.style.transform = "translate(" + wx + "px," + wy + "px)";
    // 動画（#yt）は写真と同じ座標系で、絵のスクリーンの位置・大きさに重ねる。
    // コールカード等は #mv 直下のままなので画面に対して固定される。
    // 配置は毎回 #yt を引き直して inline style の !important で書く
    // （style.css の #yt{inset:0;width:100%;height:100%} に確実に勝つため。
    // right/bottom は auto にして inset:0 の残りと競合させない）。
    var yEl = claimYt();
    if (yEl) {
      yEl.style.setProperty("left", (wx + Lw * PAINT.x) + "px", "important");
      yEl.style.setProperty("top", (wy + Lh * PAINT.y) + "px", "important");
      yEl.style.setProperty("width", (Lw * PAINT.w) + "px", "important");
      yEl.style.setProperty("height", (Lh * PAINT.h) + "px", "important");
      yEl.style.setProperty("right", "auto", "important");
      yEl.style.setProperty("bottom", "auto", "important");
      var ry = -current * 0.20;
      var rx = currentP * 0.18;
      yEl.style.transform = "rotateY(" + ry + "deg) rotateX(" + rx + "deg)";
    }
  }

  function loop() {
    if (!on) { rafId = null; return; }
    if (reduced) {
      current = target;
      currentP = targetP;
    } else {
      var dx = target - current;
      var dy = targetP - currentP;
      var portraitNow = mv.clientHeight > mv.clientWidth;
      var fx = ((portraitNow ? 0.026 : 0.042) + Math.min(0.14, Math.abs(dx) * 0.0045)) / tuneVal.smooth;
      var fy = (0.06 + Math.min(0.16, Math.abs(dy) * 0.006)) / tuneVal.smooth;
      var stepX = dx * fx;
      var capX = (portraitNow ? 1.3 : 2.2) / tuneVal.smooth;
      if (stepX > capX) stepX = capX;
      if (stepX < -capX) stepX = -capX;
      current += stepX;
      currentP += dy * fy;
    }
    if (Math.abs(target - current) < 0.02) current = target;
    if (Math.abs(targetP - currentP) < 0.02) currentP = targetP;
    apply();
    rafId = requestAnimationFrame(loop);
  }

  /* ドラッグで見回す（ボタンやパネルの上では始めない） */
  var dragging = false, lastX = 0, lastY = 0;
  mv.addEventListener("pointerdown", function (e) {
    if (!on) return;
    if (e.target && e.target.closest &&
        e.target.closest("button, a, input, select, textarea, #panel, .vn-ui, .vn-tune, .vn-dock")) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    try { mv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  mv.addEventListener("pointermove", function (e) {
    if (!dragging || !on) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    setTarget(target - dx * 0.20);
    setTargetP(targetP + dy * 0.12);
  });
  function endDrag() { dragging = false; }
  mv.addEventListener("pointerup", endDrag);
  mv.addEventListener("pointercancel", endDrag);

  /* ---------- ジャイロ ---------- */
  function wrap180(d) {
    d = ((d % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
  }
  function headingOf(e) {
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) {
      return e.webkitCompassHeading;
    }
    if (e.alpha !== null && e.alpha !== undefined) {
      return (360 - e.alpha) % 360;
    }
    return null;
  }
  function screenAngle() {
    if (window.screen && window.screen.orientation &&
        typeof window.screen.orientation.angle === "number") {
      return window.screen.orientation.angle;
    }
    if (typeof window.orientation === "number") {
      return ((window.orientation % 360) + 360) % 360;
    }
    return mv.clientWidth >= mv.clientHeight ? 90 : 0;
  }
  function smoothSensor(prev, raw) {
    if (prev === null) return raw;
    var d = raw - prev;
    if (Math.abs(d) < 0.08 * tuneVal.dead) return prev;
    var a = (0.14 + Math.min(0.40, Math.abs(d) * 0.06)) / tuneVal.smooth;
    return prev + d * a;
  }
  function smoothHeading(prev, raw, portrait) {
    if (prev === null) return raw;
    var d = wrap180(raw - prev);
    var dead = (portrait ? 1.1 : 0.7) * tuneVal.dead;
    if (Math.abs(d) < dead) return prev;
    var a = (portrait
      ? 0.075 + Math.min(0.18, Math.abs(d) * 0.016)
      : 0.095 + Math.min(0.24, Math.abs(d) * 0.020)) / tuneVal.smooth;
    return prev + d * a;
  }
  function onOrient(e) {
    if (!gyroOn || !on) return;
    if (e.beta === null || e.beta === undefined ||
        e.gamma === null || e.gamma === undefined) return;
    var angle = screenAngle();
    var rawY;
    if (angle === 90)       { rawY = -e.gamma; }
    else if (angle === 180) { rawY = -e.beta; }
    else if (angle === 270) { rawY = e.gamma; }
    else                    { rawY = e.beta; }
    var hdg = headingOf(e);
    var portrait = mv.clientHeight > mv.clientWidth;
    if (gyroAngle === null || gyroAngle !== angle || gyroRecal) {
      gyroSY = rawY;
      gyroBaseY = rawY + targetP / (0.9 * tuneVal.sens);
      if (hdg !== null) {
        gyroSH = hdg;
        gyroBaseH = hdg - target / tuneVal.sens;
      }
      gyroAngle = angle;
      gyroRecal = false;
      return;
    }
    gyroSY = smoothSensor(gyroSY, rawY);
    setTargetP((gyroBaseY - gyroSY) * 0.9 * tuneVal.sens);
    if (hdg !== null && gyroBaseH !== null) {
      gyroSH = smoothHeading(gyroSH, hdg, portrait);
      var desired = clamp(wrap180(gyroSH - gyroBaseH) * tuneVal.sens, -90, 90);
      var deadT = (portrait ? 1.6 : 0.9) * tuneVal.dead;
      if (Math.abs(desired - target) >= deadT) {
        var blend = Math.min(1, (portrait ? 0.5 : 0.65) / tuneVal.smooth);
        setTarget(target + (desired - target) * blend);
      }
    }
  }
  function gyroOff() {
    if (!gyroOn) return;
    gyroOn = false;
    gyroBaseH = null; gyroBaseY = null;
    gyroSH = null; gyroSY = null;
    gyroAngle = null; gyroRecal = false;
    gyroBtn.setAttribute("aria-pressed", "false");
    gyroBtn.textContent = "傾きで見る";
    window.removeEventListener("deviceorientation", onOrient);
  }
  gyroBtn.addEventListener("click", function () {
    if (gyroOn) { gyroOff(); return; }
    function start() {
      gyroOn = true;
      gyroBaseH = null; gyroBaseY = null;
      gyroSH = null; gyroSY = null;
      gyroAngle = null; gyroRecal = false;
      gyroBtn.setAttribute("aria-pressed", "true");
      gyroBtn.textContent = "傾きで見る：ON";
      gyroStatus.textContent = "端末を向けた方向（方角）の景色が見えます（横ブレを抑える補正入り）。標準は補正の強さ×2.00・感度×1.00・デッドバンド×1.0です。";
      window.addEventListener("deviceorientation", onOrient);
    }
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(function (res) {
        if (res === "granted") start();
        else {
          gyroStatus.textContent = "許可されなかったので、ドラッグで見回してください。";
          tune.classList.add("open");
          tuneBtn.setAttribute("aria-expanded", "true");
        }
      }).catch(function () {
        gyroStatus.textContent = "この端末では傾きが使えませんでした。";
        tune.classList.add("open");
        tuneBtn.setAttribute("aria-expanded", "true");
      });
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      start();
    } else {
      gyroStatus.textContent = "この端末・ブラウザでは傾きが使えません。";
      tune.classList.add("open");
      tuneBtn.setAttribute("aria-expanded", "true");
    }
  });
  window.addEventListener("orientationchange", function () { gyroRecal = true; });
  if (window.screen && window.screen.orientation &&
      window.screen.orientation.addEventListener) {
    window.screen.orientation.addEventListener("change", function () { gyroRecal = true; });
  }
  window.addEventListener("resize", function () { if (on) apply(); });

  /* ---------- ジャイロ調整パネル ---------- */
  tuneBtn.addEventListener("click", function () {
    var open = !tune.classList.contains("open");
    tune.classList.toggle("open", open);
    tuneBtn.setAttribute("aria-expanded", String(open));
    tuneBtn.textContent = open ? "ジャイロ調整を閉じる" : "ジャイロ調整";
  });
  function bindTune(id, valId, key, digits) {
    var input = document.getElementById(id);
    var val = document.getElementById(valId);
    function sync() {
      var v = parseFloat(input.value);
      tuneVal[key] = v;
      val.textContent = "×" + v.toFixed(digits);
    }
    input.addEventListener("input", sync);
    sync();
    return input;
  }
  var tuneSmoothInput = bindTune("vnTuneSmooth", "vnTuneSmoothVal", "smooth", 2);
  var tuneSensInput = bindTune("vnTuneSens", "vnTuneSensVal", "sens", 2);
  var tuneDeadInput = bindTune("vnTuneDead", "vnTuneDeadVal", "dead", 1);
  document.getElementById("vnTuneReset").addEventListener("click", function () {
    tuneSmoothInput.value = "2";
    tuneSensInput.value = "1";
    tuneDeadInput.value = "1";
    tuneSmoothInput.dispatchEvent(new Event("input"));
    tuneSensInput.dispatchEvent(new Event("input"));
    tuneDeadInput.dispatchEvent(new Event("input"));
  });

  /* ---------- 会場モード専用の全画面 ----------
     押したときだけ枠ごと全画面に広げる。アプリ既存の全画面
     （#mv.fs + Fullscreen API）とは別系統で、競合させない。 */
  function fsEnter() {
    if (!on || fsOn) return;
    fsOn = true;
    mv.appendChild(dock); // ドック（ラベル・ボタン列・調整）も枠の中へ
    mv.classList.add("vnfs");
    document.body.style.overflow = "hidden";
    fsBtn.setAttribute("aria-pressed", "true");
    fsBtn.textContent = "全画面を戻す";
    gyroRecal = true;
    apply();
  }
  function fsExit() {
    if (!fsOn) return;
    fsOn = false;
    mv.parentNode.insertBefore(dock, mv.nextSibling); // ドックを枠の外へ戻す
    mv.classList.remove("vnfs");
    document.body.style.overflow = "";
    fsBtn.setAttribute("aria-pressed", "false");
    fsBtn.textContent = "全画面";
    gyroRecal = true;
    apply();
  }
  fsBtn.addEventListener("click", function () { if (fsOn) fsExit(); else fsEnter(); });
  document.addEventListener("keydown", function (e) {
    if (fsOn && (e.key === "Escape" || e.key === "Esc")) fsExit();
  });

  /* ---------- 会場モードの入/切 ---------- */
  function enter() {
    if (on) return;
    if (document.body.classList.contains("scr-mk") ||
        document.body.classList.contains("scr-sp")) return; // 再生画面でのみ使う
    if (mv.classList.contains("fs")) return; // アプリ既存の全画面中は入らない
    on = true;
    preload();
    mv.classList.add("vn");
    toggleBtn.classList.add("on");
    toggleBtn.setAttribute("aria-pressed", "true");
    toggleBtn.textContent = "会場モード ON";
    target = 0; current = 0; targetP = 0; currentP = 0;
    setVenue(venueIdx);
    apply();
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }
  function exit() {
    if (!on) return;
    on = false;
    fsExit();
    gyroOff();
    stopFrames();
    mv.classList.remove("vn");
    toggleBtn.classList.remove("on");
    toggleBtn.setAttribute("aria-pressed", "false");
    toggleBtn.textContent = "会場モード";
    tune.classList.remove("open");
    tuneBtn.setAttribute("aria-expanded", "false");
    tuneBtn.textContent = "ジャイロ調整";
    restoreYt();
    world.style.transform = "";
  }
  toggleBtn.addEventListener("click", function () { if (on) exit(); else enter(); });
  exitBtn.addEventListener("click", exit);

  // 作成画面・シェアポイント作成画面へ移ったら自動で終える
  var mo = new MutationObserver(function () {
    if (on && (document.body.classList.contains("scr-mk") ||
               document.body.classList.contains("scr-sp"))) exit();
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
