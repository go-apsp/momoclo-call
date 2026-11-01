/* 画面の見た目まわり(カード・NEXT・曲名・曲選択)。app.js より先に読み込む */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); };
  var LAB = {call: "コール", sing: "シンガロン", koko: "ココ好き!"};
  var W = [58, 34, 26], S = [1, 0.72, 0.58];   // 新しいカードほど大きく、古いカードは小さく横へ
  var cardKey = "", nextKey = "";

  window.UI = {
    songs: [
      {s: "走れ!", title: "走れ!", vid: "tCD81ACqUYk"},
      {s: "Event Horizon", title: "Event Horizon", vid: "XN4RSUj15TE"},
      {s: "怪盗少女(ZZ)", title: "行くぜっ!怪盗少女 -ZZ ver.-", vid: "f-X5-pYU9gM"}
    ],
    /* 3カード: いま出ている場面(出た順)。重なったら、先に出たカードを小さくして左へ寄せる */
    cards: function (on) {
      var list = on.slice(-3), key = list.map(function (e) { return e.t + e.k + e.x; }).join("|");
      if (key === cardKey) return;
      cardKey = key;
      var n = list.length;
      $("cards").innerHTML = list.map(function (e, i) {
        var r = n - 1 - i;
        return '<div class="cd" style="flex:0 0 ' + W[r] + '%;--s:' + S[r] + '"><small>' + LAB[e.k] + '</small><strong>' + esc(e.x) + '</strong>'
          + (e.mine && e.k !== "koko" ? "<em>このスコアは反映されません</em>" : "") + "</div>";
      }).join("");
    },
    /* NEXTカード: 次のコール・シンガロンの内容を中に書く。近づくほど大きくなる */
    nexts: function (list, t) {
      var key = list.map(function (e) { return e.t + e.k + e.x; }).join("|");
      if (key !== nextKey) {
        nextKey = key;
        $("nexts").innerHTML = list.map(function (e) { return '<div class="nx"><small>NEXT ' + LAB[e.k] + "</small><b>" + esc(e.x) + "</b></div>"; }).join("");
      }
      var els = $("nexts").children;
      for (var i = 0; i < els.length; i++) els[i].style.transform = "scale(" + (0.85 + 0.35 * (1 - (list[i].t - t) / 6)) + ")";
    },
    /* MVの左上: 曲名(左寄せ)の下に「◯◯さんの推しコール」 */
    who: function (title, name, ver) {
      $("who").innerHTML = '<div class="st">♪ ' + esc(title) + "</div>"
        + (name ? '<div class="wn">' + esc(name) + "さんの<b>推し</b>コール" + (ver ? "<i>" + esc(ver) + "</i>" : "") + "</div>" : "");
    },
    chips: function (sel) {
      $("songs").innerHTML = this.songs.map(function (x, i) { return '<button data-a="song" data-i="' + i + '" class="' + (i === sel ? "sel" : "") + '">' + esc(x.s) + "</button>"; }).join("");
    }
  };
})();
