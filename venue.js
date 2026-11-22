/* =====================================================================
   build 69: 会場モード v7（再生画面）
   v7 では祐治の実機フィードバック5点に対応した:
   (1) 広角化: 正面でスクリーン幅が枠幅の約97%では会場がほとんど
       見えず「何が違うのか分からない」ため、SCREEN_FIT を 0.97 から
       0.70 に下げ、正面でも上下左右に会場の絵が見えるようにした。
       見回しの移動範囲は apply() が新しいスケールで再計算する。
   (2) ボタンの整理: ドックのボタンを VR アプリ風のアイコン主体の
       4つだけにした（会場切替＝会場名を小さく併記／傾きで見る／
       正面に戻す／全画面）。「ジャイロ調整」ボタンと調整パネル、
       「会場モードを終わる」ボタンを削除した（オン/オフはモードバーの
       トグルで足りる）。調整値は確定値（補正×2.00・感度×1.00・
       デッドバンド×1.0）を tuneVal の固定値として内部に残す。
       ジャイロ許可エラー等の連絡は、ドック内の小さな注記行
       （.vn-note）に出す。
   (3) 正面に戻すボタン（リセンター）: タップすると基準（target/
       targetP）とドラッグオフセットを 0 に戻し、ジャイロの基準も
       次のセンサーイベントで取り直す（gyroRecal）。視点は loop の
       イージングでクッと中央へ戻る。
   (4) ジャイロ中もドラッグ可: ドラッグは target を直接書き換えず
       専用オフセット（dragX/dragP）に加算し、実際の視点は
       target＋オフセットで決める合成方式にした。ジャイロが target を
       更新してもオフセットは保持され、離しても残る。リセンターで消える。
   (5) 会場モード中のカード位置（追加指示）: バブル以外の見せ方では
       カードが枠の下部に出て映像との目の移動が忙しいため、会場モード中
       だけカードの定位置を枠の縦中央付近へ上げる CSS を足した
       （.p2c は bottom:calc(50% - 26px)、スタックの #cards は
       bottom:calc(50% - 30px)）。入場トランジションは各見せ方のものを
       そのまま使うので、下から中央へパッと上がる動きになる。
       バブル（.p2bub）とストリームのココ好き!（.k-koko、上部表示）は
       対象外。app.js には触っていない。
   v6 以前の経緯:
   v6 では実機で出た「会場全画面にすると真っ暗になる」バグを直した。
   v5 では祐治の実機確認で出た2点＋初期状態の仕様変更に対応した:
   (1) 縦の見回しが逆だった（上を見ているつもりで視点が下へ、下で
       上へ）。ジャイロの縦（pitch）の符号を反転し、ドラッグの縦も
       同じ感覚（指を上に送れば視点も上）に揃えた。横は良好との
       ことで変更なし。
   (2) 会場全画面（.vnfs）でまだ再生コントロールやボタン類・カードが
       出て邪魔だった。v4 の .fsonly 非表示だけでは実機で不十分
       だったため、全画面中は body に .vn-fs を付け、#mvwrap 以外の
       body 直下要素をすべて隠す（ヘッダー・モードバー・再生
       コントローラー・シークバー・カード一覧など）。さらに #mv の
       中のアプリ側の重なり（#cards・#panel・#intro・#kokos・#pen・
       .crowd）も全画面中は隠す。全画面を戻せばクラスを外すだけで
       完全に復元される（inline style は触らない）。枠内（非全画面）
       の会場モードでは従来どおり全部表示のまま。
   (3) 初期状態は会場モードONから始まる（祐治の言い直しで確定した
       仕様。「初期は解除（オフ）」という指示は取り消し）。ページを
       開いた／再生画面に入った時点で自動で enter() し、枠内に会場が
       再現されている状態にする。作成・シェア画面から再生画面へ
       戻ったときもONで始める。オフへの切替は従来のトグルで可能で、
       再生画面に留まったまま手動でオフにした場合は、無関係な body
       クラスの変化では再びオンにしない（画面遷移のときだけ自動で入る）。
   v6 では実機で出た「会場全画面にすると真っ暗になる」バグを直した。
   原因は v5 の一括非表示ルール「body.vn-fs>*:not(#mvwrap)」。実際の
   DOM は body > #app > #mvwrap > #mv で、#mvwrap は body の直下では
   ないため、このルールは body 直下の #app 自体に一致し、アプリ全体
   （#mv を含む）を display:none にして画面が真っ暗になっていた
   （position:fixed の子も、祖先の display:none からは逃げられない）。
   v6 では非表示の対象を正しい階層（#app 直下の #mvwrap 以外と、
   #mvwrap 直下の #mv・ドック以外）に改め、全画面の成立は隠すことに
   頼らず #mv.vnfs（position:fixed;inset:0）自身が画面いっぱいに
   表示されることを基本にした。あわせて全画面中は #mvwrap の
   z-index を 80 に引き上げ、body 直下の固定オーバーレイより手前に
   出す。v5 の仕様（縦見回し反転・初期は会場モードON・枠内は全部
   表示・終了時の完全復元）はそのまま維持する。
   v1 の概念違い（オンにすると全画面化してしまう）を v2 で修正し、
   v3 では実ブラウザ確認で判明した「映像が絵のスクリーンに収まらない」
   不具合と、ラベル・ボタンの重なりを直した。
   v4 では祐治の実機確認で出た2点を直した:
   (1) ライブハウスのフレーム切替時のチラつき。フレームごとに絵の中の
       スクリーン位置が微妙に違うため、フレーム別 PAINT で映像を置くと
       切替のたびに映像がガクガク揺れていた。v4 では映像の配置を
       4フレーム共通の代表 PAINT（各値の平均）に固定し、さらに映像を
       代表 PAINT より約3%大きめに置いて、フレーム間のズレで絵の
       スクリーンの縁が映像からはみ出して見えないよう余裕を持たせた。
       背景の切替（観客のカクカク感）は従来どおり。
   (2) 会場全画面（.vnfs）の間は、アプリの再生コントローラー
       （.fsonly: 再生／ペンライト／湧く!／情報）を表示しない。
       v3 までは会場全画面で .fsonly を出していたが、祐治の訂正で
       「全画面では操作パネルが邪魔。コールカードは出ていてよい」
       となったため。コールカード（#cards）は会場全画面でも表示の
       まま変えない。全画面を戻せばコントローラーは通常どおり
       （アプリ既存の全画面での表示）に戻る。会場UI（会場切替・
       全画面を戻す・ジャイロ調整・終了）は会場全画面でも残す。
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
   - オンにしても全画面化しない（初期状態は v5 で「再生画面に入ると
     自動でオン」に変更。上の v5 (3) を参照）。再生画面にある もともとの
     YouTube 枠（#mv の通常表示サイズ・位置そのまま）の中に会場の
     光景を再現する。枠の外のレイアウト（コールカード・操作ボタン・
     モードバー等）は通常表示のまま一切変えない。
   - 枠の中では、会場の背景絵が広がり、YouTube 映像（#yt）が絵の中の
     スクリーン位置に重なる。正面を向いたとき、絵の中のスクリーン幅が
     枠の幅の約70%になり、上下左右に会場の絵が見える（v7 で広角化。
     v6 までは約97%で会場がほとんど見えなかった）。
   - 見回し: 横はコンパス方位（開始方位からの相対）、縦は傾き。ドラッグ
     でも見回せる（ジャイロ中もドラッグオフセットとして効く、v7）。
     世界は枠からはみ出さない（#mv の overflow:hidden でクリップ）。
     手ブレ補正などの調整値は確定値（補正×2.00・感度×1.00・
     デッドバンド×1.0）で固定（v7 で調整パネルは廃止）。
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
     世界と一緒に動かさない（本番の従来表示に準ずる）。会場全画面
     （.vnfs）でも表示のままにする（v4）。※v5 で変更: 会場全画面中は
     #cards も隠す（上の v5 (2) を参照）。枠内では従来どおり表示。
   - 再生/ペンライト/湧く! 等の .fsonly（アプリの再生コントローラー）
     は、会場モード中は会場全画面（.vnfs）でも表示しない（v4）。
     アプリ既存の全画面（#mv.fs）のときだけ従来どおり表示される。
     ※v5 では全画面中の非表示を .fsonly 以外へ全面拡大した。
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
    "#mv.vnfs .fsonly{display:none!important}",
    // 会場全画面: #mv の中のアプリ側の重なりも隠し、会場の光景と
    // 会場UI（ドック）だけにする。#yt と .vn-world と .vn-dock は残す。
    "#mv.vnfs #cards,#mv.vnfs #panel,#mv.vnfs #intro,#mv.vnfs #kokos,#mv.vnfs #pen,#mv.vnfs .crowd{display:none!important}",
    // 会場モード中のカード位置（v7 追加分）: バブル以外の見せ方では
    // カードが枠の下部に出て、映像との間で目の移動が忙しい。会場モード中
    // だけ、カードの定位置を枠の縦中央付近まで上げる。各見せ方が持つ
    // 入場トランジション（下からスライド/ポップ）はそのまま活き、
    // 下から中央へパッと上がる動きになる。バブル（.p2bub）は現状で
    // よいとの判断で対象外。ストリームのココ好き!（.k-koko）は
    // もともと上部表示なので対象外。スタック見せ方（#cards）も
    // 同様に中央付近へ上げる（会場全画面では従来どおり非表示）。
    "#mv.vn .p2c:not(.k-koko){bottom:calc(50% - 26px)}",
    "#mv.vn #cards{bottom:calc(50% - 30px)}",
    // 会場全画面（v6）: 非表示は補助に留め、正しい階層だけを対象にする。
    // 実DOM は body > #app > #mvwrap > #mv。v5 の
    // 「body.vn-fs>*:not(#mvwrap)」は #app 自体を消して真っ暗になるため
    // 廃止し、#app 直下（#mvwrap 以外）と #mvwrap 直下（#mv・ドック以外）
    // だけを隠す。全画面の成立は #mv.vnfs 自身の fixed 表示が基本。
    "body.vn-fs #app>*:not(#mvwrap){display:none!important}",
    "body.vn-fs #mvwrap{position:relative;z-index:80}",
    "body.vn-fs #mvwrap>*:not(#mv):not(.vn-dock){display:none!important}",
    ".vn-world{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;z-index:0}",
    ".vn-world img{display:block;width:100%;height:100%}",
    "#mv.vn #yt{border-radius:2px;box-shadow:0 0 0 3px rgba(8,10,14,.9),0 4px 18px rgba(0,0,0,.5);background:#000;will-change:transform}",
    ".vn-dock{display:none;margin-top:8px}",
    "#mv.vn + .vn-dock{display:block}",
    "#mv.vnfs .vn-dock{display:block;position:absolute;left:10px;right:10px;bottom:10px;z-index:56;margin-top:0}",
    ".vn-dockrow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
    // v7: ドックのボタンは VR アプリ風のアイコン主体で4つだけにする
    ".vn-ui{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}",
    ".vn-ui button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:54px;min-height:54px;padding:6px 8px;border-radius:14px;background:rgba(10,12,16,.72);border:1px solid rgba(147,167,196,.55);color:#eef2f8;font:inherit;cursor:pointer}",
    ".vn-ui button svg{width:22px;height:22px;flex:none}",
    ".vn-ui button .vn-cap{font-size:.62rem;line-height:1.15;letter-spacing:.02em}",
    ".vn-ui button[aria-pressed=\"true\"]{background:#e4572e;border-color:#e4572e;color:#fff}",
    ".vn-ui .vn-venue{min-width:84px}",
    ".vn-ui .vn-venue .vn-cap{font-size:.74rem;font-weight:700}",
    // ジャイロ許可エラー等の連絡用（v7: 調整パネル廃止に伴い新設）
    ".vn-note{display:none;margin-top:6px;font-size:.78rem;color:#ffd9a8}",
    ".vn-note.show{display:block}",
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

  // v7: ドックのボタンはアイコン主体の4つだけ（会場切替／傾きで見る／
  // 正面に戻す／全画面）。会場名は会場切替ボタンの中に小さく併記する。
  // 「ジャイロ調整」「会場モードを終わる」は廃止（オン/オフはモードバーの
  // トグルで足りる）。ジャイロ許可エラー等の連絡は .vn-note の行に出す。
  var SVG_HEAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICO_VENUE = SVG_HEAD + '<path d="M4 21V11l8-6 8 6v10"/><path d="M2.5 21h19"/><path d="M10 21v-5h4v5"/></svg>';
  var ICO_GYRO = SVG_HEAD + '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2.3 4.9-4.7 2.1 2.3-4.9z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>';
  var ICO_CENTER = SVG_HEAD + '<circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M12 2.5v3.8M12 17.7v3.8M2.5 12h3.8M17.7 12h3.8"/></svg>';
  var ICO_FS = SVG_HEAD + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICO_FSB = SVG_HEAD + '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

  var ui = document.createElement("div");
  ui.className = "vn-ui";
  ui.innerHTML =
    '<button type="button" class="vn-venue" id="vnVenueBtn" aria-label="会場を切り替える（タップするたびに次の会場へ）">' + ICO_VENUE + '<span class="vn-cap" id="vnVenueName">ライブハウス</span></button>' +
    '<button type="button" id="vnGyroBtn" aria-pressed="false" aria-label="傾きで見る（ジャイロ）">' + ICO_GYRO + '<span class="vn-cap">傾き</span></button>' +
    '<button type="button" id="vnCenterBtn" aria-label="正面に戻す">' + ICO_CENTER + '<span class="vn-cap">正面</span></button>' +
    '<button type="button" id="vnFsBtn" aria-pressed="false" aria-label="全画面">' + ICO_FS + '<span class="vn-cap">全画面</span></button>';
  dockRow.appendChild(ui);

  var note = document.createElement("div");
  note.className = "vn-note";
  note.id = "vnNote";
  dock.appendChild(note);
  function showNote(msg) {
    note.textContent = msg || "";
    note.classList.toggle("show", !!msg);
  }

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
  var venueName = document.getElementById("vnVenueName");
  var gyroBtn = document.getElementById("vnGyroBtn");
  var centerBtn = document.getElementById("vnCenterBtn");
  var fsBtn = document.getElementById("vnFsBtn");
  function setFsIcon(back) {
    fsBtn.innerHTML = (back ? ICO_FSB : ICO_FS) +
      '<span class="vn-cap">' + (back ? "戻す" : "全画面") + "</span>";
    fsBtn.setAttribute("aria-label", back ? "全画面を戻す" : "全画面");
  }

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

  // 映像の配置に使う PAINT。フレーム持ちの会場（ライブハウス）は、
  // フレーム別 PAINT で映像を置くと切替のたびに映像が揺れてチラつく
  // ので、全フレームの平均（代表 PAINT）に固定する（v4）。背景の絵の
  // 切替自体は従来どおりフレームごとに行う。
  function repPaint(V) {
    if (!V.frames) return V.paint;
    if (V._rep) return V._rep;
    var n = V.frames.length, sx = 0, sy = 0, sw = 0, sh = 0;
    for (var i = 0; i < n; i++) {
      sx += V.frames[i].paint.x;
      sy += V.frames[i].paint.y;
      sw += V.frames[i].paint.w;
      sh += V.frames[i].paint.h;
    }
    V._rep = { x: sx / n, y: sy / n, w: sw / n, h: sh / n };
    return V._rep;
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
    venueName.textContent = V.name;
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
  // 調整値は確定値で固定する（v7 でジャイロ調整パネルを廃止）
  var tuneVal = { smooth: 2, sens: 1, dead: 1 };
  var rafId = null;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SCREEN_FIT = 0.70; // v7: 広角化（v6 までは 0.97 で会場がほぼ見えなかった）
  // ドラッグによる視点オフセット（度、v7）。ジャイロが決める target とは
  // 別に持ち、実際の視点は target＋オフセットで決める。ジャイロ中でも
  // ドラッグが効き、離しても保持される。リセンターで 0 に戻る。
  var dragX = 0, dragP = 0;
  function viewTarget() { return clamp(target + dragX, -90, 90); }
  function viewTargetP() { return clamp(targetP + dragP, -35, 35); }
  var VIDEO_MARGIN = 1.03; // 映像を代表 PAINT より一回り大きく置く倍率（v4）

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function setTarget(v) { target = clamp(v, -90, 90); }
  function setTargetP(v) { targetP = clamp(v, -35, 35); }

  // 枠（#mv の現在の表示サイズ）の中に世界を置く。
  // 正面では絵の中のスクリーン中心が枠の中心に来て、スクリーン幅が
  // 枠幅の約70%になる大きさにする（v7 の広角化。縦長絵でスクリーン
  // 高さが枠高さを超える場合は、スクリーン全体が枠に収まるよう少し縮める）。
  // 見回しの移動量は「世界が枠を覆い続けられる範囲」に制限する。
  function apply() {
    if (!on) return;
    var w = mv.clientWidth;
    var h = mv.clientHeight;
    if (!w || !h) return;
    var V = VENUES[venueIdx];
    var PAINT = repPaint(V);
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
      // 映像は代表 PAINT より約3%大きめに置く（中心は PAINT と同じ）。
      // フレームごとに絵のスクリーン位置が少し違うので、余裕を持たせて
      // 絵のスクリーンの縁が映像の外にはみ出して見えないようにする（v4）。
      var vw = PAINT.w * VIDEO_MARGIN;
      var vh = PAINT.h * VIDEO_MARGIN;
      var vx = PAINT.x - (vw - PAINT.w) / 2;
      var vy = PAINT.y - (vh - PAINT.h) / 2;
      yEl.style.setProperty("left", (wx + Lw * vx) + "px", "important");
      yEl.style.setProperty("top", (wy + Lh * vy) + "px", "important");
      yEl.style.setProperty("width", (Lw * vw) + "px", "important");
      yEl.style.setProperty("height", (Lh * vh) + "px", "important");
      yEl.style.setProperty("right", "auto", "important");
      yEl.style.setProperty("bottom", "auto", "important");
      var ry = -current * 0.20;
      var rx = currentP * 0.18;
      yEl.style.transform = "rotateY(" + ry + "deg) rotateX(" + rx + "deg)";
    }
  }

  function loop() {
    if (!on) { rafId = null; return; }
    var vt = viewTarget();   // ジャイロ等の target ＋ ドラッグオフセット
    var vtp = viewTargetP();
    if (reduced) {
      current = vt;
      currentP = vtp;
    } else {
      var dx = vt - current;
      var dy = vtp - currentP;
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
    if (Math.abs(vt - current) < 0.02) current = vt;
    if (Math.abs(vtp - currentP) < 0.02) currentP = vtp;
    apply();
    rafId = requestAnimationFrame(loop);
  }

  /* ドラッグで見回す（ボタンやパネルの上では始めない） */
  var dragging = false, lastX = 0, lastY = 0;
  mv.addEventListener("pointerdown", function (e) {
    if (!on) return;
    if (e.target && e.target.closest &&
        e.target.closest("button, a, input, select, textarea, #panel, .vn-ui, .vn-dock")) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    try { mv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  mv.addEventListener("pointermove", function (e) {
    if (!dragging || !on) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    // v7: ジャイロの target は書き換えず、ドラッグオフセットに加算する
    // （ジャイロ中でも効き、指を離しても保持される。リセンターで消える）。
    // 符号は従来どおり（縦は v5 の反転済みの感覚: 指を上に送れば視点も上）。
    dragX = clamp(dragX - dx * 0.20, -180, 180);
    dragP = clamp(dragP - dy * 0.12, -70, 70);
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
      gyroBaseY = rawY - targetP / (0.9 * tuneVal.sens);
      if (hdg !== null) {
        gyroSH = hdg;
        gyroBaseH = hdg - target / tuneVal.sens;
      }
      gyroAngle = angle;
      gyroRecal = false;
      return;
    }
    gyroSY = smoothSensor(gyroSY, rawY);
    // 縦は v5 で符号を反転（上を向ければ視点も上へ。v4 までは逆だった）
    setTargetP((gyroSY - gyroBaseY) * 0.9 * tuneVal.sens);
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
      showNote("");
      window.addEventListener("deviceorientation", onOrient);
    }
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(function (res) {
        if (res === "granted") start();
        else showNote("傾きが許可されなかったので、ドラッグで見回してください。");
      }).catch(function () {
        showNote("この端末では傾きが使えませんでした。");
      });
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      start();
    } else {
      showNote("この端末・ブラウザでは傾きが使えません。");
    }
  });

  /* 正面に戻す（リセンター、v7）: 基準とドラッグオフセットを 0 に戻し、
     ジャイロの基準は次のセンサーイベントで取り直す。視点そのものは
     loop のイージングでクッと中央へ戻る。 */
  centerBtn.addEventListener("click", function () {
    target = 0; targetP = 0;
    dragX = 0; dragP = 0;
    gyroRecal = true;
  });
  window.addEventListener("orientationchange", function () { gyroRecal = true; });
  if (window.screen && window.screen.orientation &&
      window.screen.orientation.addEventListener) {
    window.screen.orientation.addEventListener("change", function () { gyroRecal = true; });
  }
  window.addEventListener("resize", function () { if (on) apply(); });

  /* ---------- 会場モード専用の全画面 ----------
     押したときだけ枠ごと全画面に広げる。アプリ既存の全画面
     （#mv.fs + Fullscreen API）とは別系統で、競合させない。 */
  function fsEnter() {
    if (!on || fsOn) return;
    fsOn = true;
    mv.appendChild(dock); // ドック（ボタン列）も枠の中へ
    mv.classList.add("vnfs");
    document.body.classList.add("vn-fs"); // v6: #app 直下（#mvwrap 以外）等を補助的に隠す
    document.body.style.overflow = "hidden";
    fsBtn.setAttribute("aria-pressed", "true");
    setFsIcon(true);
    gyroRecal = true;
    apply();
  }
  function fsExit() {
    if (!fsOn) return;
    fsOn = false;
    mv.parentNode.insertBefore(dock, mv.nextSibling); // ドックを枠の外へ戻す
    mv.classList.remove("vnfs");
    document.body.classList.remove("vn-fs");
    document.body.style.overflow = "";
    fsBtn.setAttribute("aria-pressed", "false");
    setFsIcon(false);
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
    dragX = 0; dragP = 0;
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
    showNote("");
    restoreYt();
    world.style.transform = "";
  }
  toggleBtn.addEventListener("click", function () { if (on) exit(); else enter(); });

  // 作成画面・シェアポイント作成画面へ移ったら自動で終える。
  // 逆に再生画面へ入ったら会場モードONで始める（v5 の初期状態仕様）。
  // 再生画面に留まったままの無関係なクラス変化（メニュー開閉など）では
  // 入り直さないよう、「別画面だった→再生画面になった」遷移でのみ入る。
  var wasAlt = document.body.classList.contains("scr-mk") ||
               document.body.classList.contains("scr-sp");
  var mo = new MutationObserver(function () {
    var alt = document.body.classList.contains("scr-mk") ||
              document.body.classList.contains("scr-sp");
    if (alt) { if (on) exit(); }
    else if (wasAlt) enter();
    wasAlt = alt;
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (!wasAlt) enter(); // ページを開いた時点で再生画面なら、最初からON
})();
