/* 画面の見た目まわり(カード・NEXT・曲名・曲選択・一覧・アイコン)。app.js より先に読み込む */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); };
  var LAB = {call: "コール", sing: "シンガロン", koko: "ココ好き!"};
  var OSHI = [["赤推し", "#ff3b4f"], ["黄色推し", "#ffd23f"], ["ピンク推し", "#ff7ab8"], ["紫推し", "#a66bff"], ["箱推し", "#000000"], ["決まってない", "#ffffff"]];
  var PEN = [["赤", "#ff3b4f"], ["黄", "#ffd23f"], ["ピンク", "#ff7ab8"], ["紫", "#a66bff"], ["白", "#ffffff"]];
  var fmt = function (t) { return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
  var colorOf = function (i) { return (OSHI[i] || OSHI[5])[1]; };
  var W = [58, 34, 26], S = [1, 0.72, 0.58];   // 新しいカードほど大きく、古いカードは小さく横へ
  var cardKey = "", nextKey = "";

  var sv = function (inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="#f4f4fb" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>"; };
  var MIC = [   // マイクのイラスト5種(0番が初期アイコン)
    sv('<circle cx="12" cy="8" r="5"/><path d="M8.5 6.5h7M8.2 9.5h7.6M10 13.5l-1.5 8h7L14 13.5"/>'),
    sv('<rect x="8" y="2.5" width="8" height="12" rx="4"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5v3M8.5 21.5h7"/>'),
    sv('<rect x="7" y="2.5" width="10" height="14" rx="3"/><path d="M7 7h10M7 10h10M7 13h10M12 16.5v5M8 21.5h8"/>'),
    sv('<circle cx="12" cy="9" r="4.5"/><path d="M12 4.5V1.5M9 14l-1 7.5h8L15 14M10 18h4"/>'),
    sv('<circle cx="12" cy="8" r="5"/><path d="M12 5.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2L9.1 7.6l2-.3zM10 13.5l-1.5 8h7L14 13.5"/>')
  ];
  var mic = function (i) { return MIC[i || 0] || MIC[0]; };
  var icon = function (i, col) { return '<span class="av" style="border-color:' + col + '">' + mic(i) + "</span>"; };

  window.UI = {
    LAB: LAB, OSHI: OSHI, PEN: PEN, esc: esc, fmt: fmt, colorOf: colorOf, mic: mic,
    songs: [
      {s: "走れ!", title: "走れ!", tid: "45R1m5osIXo92tgY1eHTeW", durMs: 273373},
      {s: "Event Horizon", title: "Event Horizon", tid: "1hHkOBpuly0rAoFuKWy5CM", durMs: 234633},
      {s: "行くぜっ!怪盗少女 -ZZ ver.-", title: "行くぜっ!怪盗少女 -ZZ ver.-", tid: "6gIf4tylgA6mr7mj62Pz55", durMs: 228026}
    ],
    /* 曲選択(プルダウン) */
    songSel: function (sel) {
      $("songbox").innerHTML = '<select id="songsel" data-c="song" aria-label="曲を選ぶ">' + this.songs.map(function (x, i) { return '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">♪ " + esc(x.s) + "</option>"; }).join("") + "</select>";
    },
    total: function (n) { $("tot").textContent = n ? "この曲の湧き合計: " + n + "回" : ""; },
    /* 3カード: いま出ている場面(出た順)。重なったら横に潰さず、古いものを小さく上に積む(下が最新で元の位置)。
       ココ好き!は枠の上半分に別表示する */
    cards: function (on) {
      var main = on.filter(function (e) { return e.k !== "koko"; }).slice(-3);
      var koko = on.filter(function (e) { return e.k === "koko"; }).slice(-2);
      var key = on.map(function (e) { return e.t + e.k + e.x; }).join("|");
      if (key === cardKey) return;
      cardKey = key;
      var n = main.length;
      $("cards").innerHTML = main.map(function (e, i) {
        var r = n - 1 - i;
        return '<div class="cd" style="--s:' + S[r] + (r ? ";opacity:" + (r === 1 ? ".88" : ".72") : "") + '"><small>' + LAB[e.k] + "</small><strong>" + esc(e.x) + "</strong>"
          + (e.mine ? "<em>このスコアは反映されません</em>" : "") + "</div>";
      }).join("");
      var kn = koko.length;
      $("kokos").innerHTML = koko.map(function (e, i) {
        var r = kn - 1 - i;
        return '<div class="cd" style="--s:' + (r ? 0.72 : 1) + (r ? ";opacity:.75" : "") + '"><small>' + LAB[e.k] + "</small><strong>" + esc(e.x) + "</strong></div>";
      }).join("");
    },
    /* NEXTカード: 垂れタグ型。カウントダウンは数字のみ大きめ、近づくほど色が濃くなる。
       枠との重なりはカードの縦幅の1/4だけ(残り3/4は枠の上) */
    nexts: function (list, t) {
      var key = list.map(function (e) { return e.t + e.k + e.x; }).join("|");
      if (key !== nextKey) {
        nextKey = key;
        $("nexts").innerHTML = list.map(function (e, i) { return '<div class="nx nx-' + e.k + (i === 0 ? " main" : "") + '"><small>NEXT ' + LAB[e.k] + "</small><b>" + esc(e.x) + '</b><span class="nxnum"></span></div>'; }).join("");
      }
      var els = $("nexts").children;
      for (var i = 0; i < els.length; i++) {
        var e = list[i]; if (!e || !els[i]) continue;
        var remain = Math.max(0, e.t - t), p = Math.min(1, Math.max(0, 1 - remain / 6));
        var sec = Math.max(1, Math.ceil(remain)), num = els[i].querySelector(".nxnum");
        if (num && num.textContent !== String(sec)) num.textContent = sec;
        var rgb = e.k === "sing" ? "30,136,229" : "255,45,110";
        els[i].style.background = "rgba(" + rgb + "," + (0.30 + 0.22 * p).toFixed(2) + ")";
        els[i].style.transform = "translateY(" + (-100 + 25 * p).toFixed(1) + "%) scale(" + (0.94 + 0.08 * p).toFixed(3) + ")";
      }
    },
    /* YouTube画面の外: 曲名(左寄せ)の下に「◯◯さんの推しコール」 */
    who: function (title, name, ver) {
      $("who").innerHTML = '<div class="st">♪ ' + esc(title) + "</div>"
        + (name ? '<div class="wn">' + esc(name) + "さんの<b>推し</b>コール" + (ver ? "<i>" + esc(ver) + "</i>" : "") + "</div>" : "");
    },
    /* 全画面の情報パネル */
    panel: function (c) {
      return c ? "<b>" + esc(c.ownerName) + "さんの推しコール</b>" + (c.versionName ? " [" + esc(c.versionName) + "]" : "") + "<br>♥ " + (c.hearts || 0) + " / 湧き " + (c.used || 0) + "回" + (c.note ? "<br>備考: " + esc(c.note) : "") : "推しコールはまだありません";
    },
    sheetIcons: function (sel) {
      $("icons").innerHTML = MIC.map(function (m, i) { return '<button data-a="pickIcon" data-i="' + i + '" class="' + (i === sel ? "sel" : "") + '" aria-label="アイコン' + (i + 1) + '">' + m + "</button>"; }).join("");
    },
    mkList: function (scenes) {
      return scenes.map(function (e, i) { return '<div class="mkrow"><span>' + fmt(e.t) + "</span><span>" + LAB[e.k] + '</span><span class="sp">' + esc(e.x) + '</span><input type="range" class="dursl" min="1" max="20" step="0.5" value="' + e.d + '" data-dur="' + i + '" aria-label="表示時間"><span class="durval">' + e.d + '秒</span><button class="pvb" data-a="pvScene" data-i="' + i + '">プレビュー</button><button aria-label="削除" data-a="delScene" data-i="' + i + '">×</button></div>'; }).join("")
        || '<div style="font-size:12px;color:var(--mut)">動画を止めて、追加したい位置で「この位置に追加」を押します。</div>';
    },
    list: function (calls, x) {
      return calls.map(function (c) {
        var own = x.me && c.ownerUid === x.me.uid, col = colorOf(c.oshi), tc = col === "#000000" ? "#fff" : col;
        return '<div class="u' + (c.id === x.openId ? " open" : "") + '" style="box-shadow:0 0 0 1.5px ' + col + "99;background:linear-gradient(160deg," + col + '40,#262a4a 65%)">'
          + '<button class="hd" data-a="toggle" data-i="' + c.id + '">' + icon(c.ownerIcon, col) + '<span class="sp">' + esc(c.ownerName) + 'さんの<b style="color:' + tc + '">推し</b>コール'
          + (c.versionName ? '<span class="tag">' + esc(c.versionName) + "</span>" : "") + (c.public ? "" : '<span class="tag">下書き</span>') + '</span><span style="color:' + tc + '">♥' + (c.hearts || 0) + "</span></button>"
          + '<div class="dt">' + (c.note ? "<div>備考:" + esc(c.note) + "</div>" : "") + '<div class="used">みんなが ' + (c.used || 0) + '回 一緒に湧きました</div><div class="act">'
          + '<button class="hr" style="background:' + (x.liked.has(c.id) ? "#ff3b4f" : "#3a3f6b") + '" data-a="heart" data-i="' + c.id + '">♥ ' + (c.hearts || 0) + "</button>"
          + '<button class="w" data-a="use" data-i="' + c.id + '">これで再生</button>'
          + '<button data-a="tl" data-i="' + c.id + '">タイムライン</button>'
          + (!own && c.allowRef ? '<button data-a="ref" data-i="' + c.id + '">参考にする</button>' : "")
          + (own ? '<button data-a="pub" data-i="' + c.id + '">' + (c.public ? "非公開にする" : "公開する") + '</button><button data-a="del" data-i="' + c.id + '">削除</button>' : "")
          + "</div>" + UI.cmtHtml(c, x) + "</div></div>";
      }).join("") || '<div style="color:var(--mut);font-size:13px">まだ推しコールがありません。</div>';
    },
    /* タイムライン図解(場面が曲のどこに入るか)。zoom=true で拡大表示(各位置に時間と中身) */
    timeline: function (c, D, zoom) {
      D = Math.max(1, D || 1);
      var lanes = ["call", "sing", "koko"];
      var rows = lanes.map(function (k) {
        var ms = c.scenes.map(function (s, idx) { return {s: s, idx: idx}; }).filter(function (o) { return o.s.k === k; }).map(function (o) {
          var l = Math.max(0, o.s.t / D * 100), w = Math.max(1.5, o.s.d / D * 100);
          return '<button class="tlm tl-' + k + '" style="left:' + l + '%;width:' + w + '%" data-a="tlMark" data-i="' + o.idx + '" aria-label="' + fmt(o.s.t) + " " + LAB[k] + '"></button>';
        }).join("");
        return '<div class="tlrow"><span class="tllab">' + LAB[k] + '</span><div class="tltrack">' + ms + "</div></div>";
      }).join("");
      var extra = "";
      if (zoom) {
        var COL = {call: "#ff6b9d", sing: "#4dc9ff", koko: "#ffd23f"};
        var Hpx = Math.max(900, Math.round(D * 12));
        var items = c.scenes.map(function (s, idx) {
          var top = Math.round(16 + (s.t / D) * (Hpx - 70));
          return '<div class="tlVItem" style="top:' + top + 'px"><span class="tlVTime">' + fmt(s.t) + '</span><button class="tlVCard" style="border-color:' + COL[s.k] + ";background:" + COL[s.k] + '2e" data-a="tlMark" data-i="' + idx + '">' + LAB[s.k] + " 「" + esc(s.x) + "」</button></div>";
        }).join("");
        extra = '<div class="tlVert" style="height:' + Hpx + 'px"><div class="tlVLine"></div>' + items + "</div>";
      }
      return '<div class="tltitle">' + esc(c.ownerName) + "さんの推しコール" + (c.versionName ? "「" + esc(c.versionName) + "」" : "") + "</div>"
        + '<div class="tlbar" data-a="tlZoom">' + rows + '<div id="tlPos"></div></div>'
        + '<div class="tlscale"><span>0:00</span><span>' + fmt(D) + "</span></div>"
        + '<div class="tlHint">' + (zoom ? "図解をタップすると通常表示に戻ります" : "図解をタップすると拡大表示できます") + "</div>"
        + extra
        + '<div class="tlInfo" id="tlInfo">色のついた部分を押すと、その場面の中身が出ます</div>';
    },
    refs: function (refs) {
      return refs.map(function (c) {
        var lines = c.scenes.map(function (x) { return fmt(x.t) + " " + LAB[x.k] + " 「" + esc(x.x) + "」"; }).join("<br>");
        return '<div class="refitem"><b>' + esc(c.versionName || "参考コール") + '</b><div class="rs">' + lines + '</div><div class="act" style="margin-top:8px"><button class="w" data-a="useRef" data-i="' + c.id + '">これで再生</button></div></div>';
      }).join("") || '<div style="color:var(--mut);font-size:13px">この曲の参考コールはまだありません。</div>';
    },
    cmtHtml: function (c, x) {
      var d = (x.cmts || {})[c.id];
      var ap = d ? d.approved : [];
      var list = ap.map(function (m) { return '<div class="cmt"><b>' + esc(m.name) + '</b><span>' + esc(m.text) + '</span></div>'; }).join("");
      var pend = "";
      if (d && d.pending && d.pending.length) {
        pend = '<div class="cmtPend"><div class="cmtT">承認待ちの感想</div>' + d.pending.map(function (m) {
          return '<div class="cmt"><b>' + esc(m.name) + '</b><span>' + esc(m.text) + '</span><span class="cmtBtns"><button data-a="cmtOk" data-i="' + c.id + '|' + m.id + '">公開する</button><button data-a="cmtNg" data-i="' + c.id + '|' + m.id + '">公開しない</button></span></div>';
        }).join("") + '</div>';
      }
      return '<div class="cmts"><div class="cmtT">感想</div>' + (list || '<div class="cmtNone">まだ感想はありません</div>') + pend
        + '<div class="cmtForm"><input id="cn-' + c.id + '" placeholder="ニックネーム" maxlength="20" value="' + esc(x.myNick || "") + '"><input id="ct-' + c.id + '" placeholder="感想を書く" maxlength="200"><button data-a="cmtWrite" data-i="' + c.id + '">書く</button></div>'
        + '<div class="cmtNote">感想は、作者の承認後に公開されます</div></div>';
    }
  };
})();
