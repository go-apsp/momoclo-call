/* ---------- 作成付箋: 再生画面の三層レイヤー付箋帯に4枚目「作成」を足す独立モジュール ----------
   既存の付箋3枚(操作/一覧/タイムライン)は app.js のレイヤー仕組み(v43)が持つシート切替用で、
   「作成」はシートではなく作成画面への遷移ボタン。そのため v43 の内部(シート配列・スライド判定・
   data-top の CSS)には手を入れず、このモジュールがステージ(#p2LayerStage)を見つけて
   子としてタブを1枚追加するだけにする(venue.js が #modebar にトグルを足した前例と同じ方式)。
   ステージ要素は v43 が作りっぱなしで使い回し、作成/シェア画面では本体が DOM から外し、
   再生画面で同じ要素を戻すので、付けたタブも一緒に着脱される。
   見た目は既存タブ(.p2lt-tab)の寸法・書式をそのまま写し、色だけ既存と被らない紫にする。
   表示条件も既存タブに合わせ、ステージ有効時(#p2LayerStage.p2lt-active)だけ出す。
   縦位置は固定値にせず、実測したタイムラインタブの下端+6px に合わせる(既存タブ同士の
   間隔は7px。フォント環境でタブの高さが変わっても並びが崩れないように)。
   遷移はメニューの「推しコールを作る」(#mkbtn / data-a="startMk")をそのままクリックし、
   本体の委譲ハンドラ→startMk→enterMk() に完全に委ねる(作成画面の開き方を二重実装しない)。
   会場全画面(.vnfs)中はステージごと本体側の制御で隠れるため、従来方針どおり出ない。 */
(function () {
  var tab = document.createElement("button");
  tab.type = "button";
  tab.className = "p2mk-tab";
  tab.textContent = "作成";
  tab.setAttribute("aria-label", "推しコールを作る（作成画面へ）");

  var st = document.createElement("style");
  st.id = "p2mkTabStyles";
  st.textContent = ".p2mk-tab{display:none}"
    + "#p2LayerStage.p2lt-active .p2mk-tab{display:block;position:absolute;right:2px;top:202px;z-index:6;width:28px;transform:none;padding:11px 0;border:0;border-radius:0 9px 9px 0;writing-mode:vertical-rl;font-size:12px;font-weight:900;letter-spacing:.14em;box-shadow:2px 3px 8px rgba(0,0,0,.45);cursor:pointer;font-family:inherit;background:#b78cff;color:#241040;touch-action:none}";
  document.head.appendChild(st);

  tab.addEventListener("click", function () {
    var b = document.getElementById("mkbtn");
    if (b) b.click();
  });

  var stageEl = null;
  function position() {
    if (!stageEl) return;
    var tl = stageEl.querySelector(".p2lt-tab-tl");
    if (!tl) return;
    var sr = stageEl.getBoundingClientRect();
    var r = tl.getBoundingClientRect();
    if (!r.height || !sr.height) return;   /* 非表示中は測れないので据え置き */
    tab.style.top = Math.round(r.bottom - sr.top) + 6 + "px";
  }
  function watchStage() {
    var mo = new MutationObserver(function () { position(); });
    mo.observe(stageEl, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", position);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(position);
    position();
  }
  function attach() {
    var stage = document.getElementById("p2LayerStage");
    if (!stage) return false;
    if (tab.parentNode !== stage) stage.appendChild(tab);
    if (stageEl !== stage) { stageEl = stage; watchStage(); }
    position();
    return true;
  }
  if (!attach()) {
    var mo = new MutationObserver(function () { if (attach()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
