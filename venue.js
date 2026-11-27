/* =====================================================================
   build 69: 会場モード v8（再生画面）
   v8 では祐治の実機フィードバック2点に対応した:
   (1) アニメーション廃止: ライブハウスの4フレーム切替は、映像の
       配置（スクリーン位置）を固定しても、絵の他の部分がフレーム間で
       ブレてチカチカした。生成動画でも同じになるとの判断で、全会場
       とも静止画1枚に統一した。ライブハウスは現行フレーム1
       （venue/livehouse-1.webp、縦長1200×1440）の1枚だけを使い、
       フレーム切替タイマーとフレーム別処理を撤去した。映像の配置は
       フレーム1単独の PAINT（v4〜v7 の「全フレーム平均の代表 PAINT」
       ではない）に戻し、マージン約3%は維持する。
   (2) 会場全画面にコンパクトな再生系ボタンを追加: 全画面（.vnfs）の
       間だけ、ドック内に小さな操作列（.vn-ctl）を出す。中身は
       再生／一時停止・ペンライト・湧く! の3つ。挙動は二重実装せず、
       本体の既存ボタン（#fsplay／#penbtn／#wakubtn）を venue.js から
       プログラム的にクリックして再利用する（本体ボタンが全画面で
       非表示でも click() は効き、document 委譲のアクションが動く）。
       ペンライトは本体と同じく、タップ=点灯/消灯、長押し=色バー
       （#dots）を開く。本体の長押し判定は [data-a="pen"] への
       pointerdown リスナーで動くため、コンパクト側の pointerdown/up を
       本体ボタンへ転送してそのまま使う。色バーは通常 body.vn-fs の
       一括非表示に含まれるため、開いているときだけ表示する例外を
       足した。あわせて、全画面で隠していた #pen（ペンライト本体）も
       v8 では隠さない（点灯が見えなければボタンが意味を持たないため）。
       再生ボタンの表示（▶/❚❚ と文言）は #fsplay の textContent を
       MutationObserver で監視して同期する。ペンライトの色ドットと
       押下状態は #pen の class/style を監視して同期する。
       枠内（非全画面）では本体のコントローラーが見えているため
       コンパクト列は出さない。
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
   v9 では Gemini 製 VR 試作 v5（テストページ venue-vr-v5.html で
   祐治が確認・承認）の見た目を、ライブハウス会場に組み込んだ:
   (1) ライブハウスのときだけ、平らな静止画＋PAINT 配置に代えて
       Three.js の 270°ドーム（実写＋左右ミラー延長のシームレス
       テクスチャ、半径620の内向き球）で描く。他会場は v8 のまま。
       Three.js (r128) は cdnjs から動的に読み込み、失敗したら
       v8 の平らな表示へ自動で戻る（フォールバック）。
   (2) 映像（#yt）はドームのスクリーン枠（正面 Z=-500、392×221）に
       射影変換（ホモグラフィ→CSS matrix3d）で毎フレーム貼る。
       CSS 3D の入れ子にすると iframe の親要素が変わり再読み込みで
       再生が止まる恐れがあるため、#yt は元の場所のまま動かさない。
   (3) 客席ペンライト（180本）とステージビーム（6本）が、実際のコール
       カードの出現に反応する。カードの DOM 追加・前面化を
       MutationObserver で拾い、カード文言にメンバー名があれば
       メンバーカラーのプリセット（かなこ=赤／しおり=黄／れに=紫／
       あーりん=ピンク）、なければカード種別の色（コール=ピンク／
       シンガロン=青／ココ好き!=黄）で客席が光る。
   (4) ジャイロ・ドラッグ・視点のイージングは v8 の確定値をそのまま
       使う（v5 の4層スタビライザーは未検証のため今回は入れない）。
       ドームのカメラは本モジュールの current/currentP から作る。
   背景画像は venue/livehouse-vr.jpg（Gemini 生成の 21:9 実写風画像、
   1584×672）。ドームのテクスチャ合成は v5 の方式そのまま。
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
     豪華客船 の順に切替。絵は全会場とも静止画1枚（ライブハウスは
     livehouse-1.webp。v7 までは4フレーム切替のアニメだったが、
     v8 で廃止した。上の v8 (1) を参照）。
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
     ※v8 では、全画面の間だけドック内にコンパクト操作列（.vn-ctl:
     再生／一時停止・ペンライト・湧く!）を出す。本体ボタンを
     プログラム的にクリックして挙動を再利用する（上の v8 (2)）。
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
    // ※v8: #pen（ペンライト本体）は隠さない。全画面のコンパクト
    // ペンライトボタンで点灯/消灯するのに、消えていたら見えないため。
    "#mv.vnfs #cards,#mv.vnfs #panel,#mv.vnfs #intro,#mv.vnfs #kokos,#mv.vnfs .crowd{display:none!important}",
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
    // v8: ペンライトの色バー（#dots）は #app 直下なので上の一括非表示に
    // 含まれるが、全画面で長押しから色を変えられるよう、開いている
    // ときだけ表示に戻す（詳細度で上の一括非表示に勝たせる）。さらに
    // 全画面中は #mvwrap が z-index:80 で手前に出るため、色バーが
    // 不透明な #mv の下に隠れないよう z-index をその上へ引き上げ、
    // ドック（2段分）と重ならないよう少し上へずらす。
    "body.vn-fs #app>#dots.open{display:flex!important;z-index:90;bottom:158px}",
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
    // v8: 会場全画面のときだけ出すコンパクトな再生系操作列。
    // ドックの中（会場UIの下）に置き、枠内では出さない（本体の
    // コントローラーが見えているため）。ドックは全画面のときだけ
    // #mv の中へ移るので、「#mv.vnfs 配下のときだけ表示」で足りる。
    ".vn-ctl{display:none}",
    "#mv.vnfs .vn-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin-top:8px}",
    ".vn-ctl button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;min-height:42px;padding:4px 7px;border-radius:12px;background:rgba(10,12,16,.72);border:1px solid rgba(147,167,196,.55);color:#eef2f8;font:inherit;cursor:pointer}",
    ".vn-ctl button svg{width:18px;height:18px;flex:none}",
    ".vn-ctl button .vn-cap{font-size:.6rem;line-height:1.15;letter-spacing:.02em}",
    ".vn-ctl button .vn-ico{display:flex;flex:none}",
    // ペンライト点灯中は枠を明るくして示す（色そのものはドットで示す）
    ".vn-ctl #vnPenBtn[aria-pressed=\"true\"]{background:rgba(255,255,255,.18);border-color:#eef2f8}",
    // ペンライトの色ドット（現在の色に同期して JS が背景色を書く）
    ".vn-ctl .vn-dot{width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 7px 1px currentColor;flex:none}",
    // ジャイロ許可エラー等の連絡用（v7: 調整パネル廃止に伴い新設）
    ".vn-note{display:none;margin-top:6px;font-size:.78rem;color:#ffd9a8}",
    ".vn-note.show{display:block}",
    "#venueBtn{min-height:44px;padding:10px 20px;border-radius:999px;font-size:1rem;font-weight:900;letter-spacing:.03em;border:2px solid #ff7ab8;color:#ff7ab8;background:rgba(255,122,184,.14)}",
    "#venueBtn.on{background:#ff7ab8;border-color:#ff7ab8;color:#14152b;box-shadow:0 0 0 3px rgba(255,122,184,.35),0 4px 14px rgba(255,122,184,.45)}",
    // v9: ライブハウス用 270°ドーム（WebGLキャンバス）。ドーム有効時は
    // 平らな .vn-world を隠し、#mv の perspective（#yt の rotate 用）は
    // 射影変換と競合しないよう切る。#yt は matrix3d で貼るため z を上げる。
    ".vn-gl{display:none;position:absolute;inset:0;width:100%;height:100%;z-index:0}",
    "#mv.vn-dome .vn-gl{display:block}",
    "#mv.vn-dome .vn-world{visibility:hidden}",
    "#mv.vn-dome{perspective:none}",
    "#mv.vn-dome #yt{z-index:2}"
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

  // v8: 会場全画面のときだけ出すコンパクトな再生系操作列（再生／
  // 一時停止・ペンライト・湧く!）。ドックの中に置き、CSS で
  // #mv.vnfs のときだけ表示する。挙動は本体ボタンのプログラム的
  // クリックで再利用する（下の「会場全画面のコンパクト操作列」参照）。
  var ICO_PLAY = SVG_HEAD + '<path d="M8.5 5.8v12.4c0 .8.9 1.3 1.6.9l9.7-6.2c.6-.4.6-1.4 0-1.8L10.1 4.9c-.7-.4-1.6.1-1.6.9z" fill="currentColor" stroke="none"/></svg>';
  var ICO_PAUSE = SVG_HEAD + '<path d="M8.2 5.5v13M15.8 5.5v13" stroke-width="3.4"/></svg>';
  var ICO_PEN = SVG_HEAD + '<path d="M12 2.8v2.2M6.1 5.2l1.6 1.6M17.9 5.2l-1.6 1.6"/><rect x="10.4" y="7.4" width="3.2" height="11.8" rx="1.6" fill="currentColor" stroke="none"/></svg>';
  var ICO_WAKU = SVG_HEAD + '<circle cx="12" cy="12" r="3.1"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';
  var ctl = document.createElement("div");
  ctl.className = "vn-ctl";
  ctl.id = "vnCtl";
  ctl.innerHTML =
    '<button type="button" id="vnPlayBtn" aria-label="再生"><span class="vn-ico" id="vnPlayIco">' + ICO_PLAY + '</span><span class="vn-cap" id="vnPlayCap">再生</span></button>' +
    '<button type="button" id="vnPenBtn" aria-pressed="false" aria-label="ペンライト（タップで点灯/消灯、長押しで色変更）"><span class="vn-ico">' + ICO_PEN + '</span><span class="vn-dot" id="vnPenDot"></span><span class="vn-cap">ペン</span></button>' +
    '<button type="button" id="vnWakuBtn" aria-label="湧く!"><span class="vn-ico">' + ICO_WAKU + '</span><span class="vn-cap">湧く!</span></button>';
  dock.appendChild(ctl);

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
    { id: "livehouse", name: "ライブハウス", src: "venue/livehouse-1.webp", iw: 1200, ih: 1440,
      paint: { x: 0.252, y: 0.379, w: 0.492, h: 0.249 } },
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
  var preloaded = false;

  // v8: 全会場とも静止画1枚。フレーム切替（タイマー・フレーム別
  // PAINT・平均の代表 PAINT）は廃止した（上の v8 (1) を参照）。
  function preload() {
    if (preloaded) return;
    preloaded = true;
    for (var vi = 0; vi < VENUES.length; vi++) {
      var pre = new Image();
      pre.src = VENUES[vi].src;
    }
  }
  function setVenue(i) {
    venueIdx = ((i % VENUES.length) + VENUES.length) % VENUES.length;
    var V = VENUES[venueIdx];
    if (img.getAttribute("src") !== V.src) img.src = V.src;
    venueName.textContent = V.name;
    apply();
    domeSyncVenue();
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
  var VIDEO_MARGIN = 1.03; // 映像を PAINT より一回り大きく置く倍率（v4）

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
    if (domeActive()) { domeResize(); return; }
    var w = mv.clientWidth;
    var h = mv.clientHeight;
    if (!w || !h) return;
    var V = VENUES[venueIdx];
    var PAINT = V.paint;
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
      // 映像は PAINT より約3%大きめに置く（中心は PAINT と同じ）。
      // 絵のスクリーンの縁が映像の外にはみ出して見えないよう、
      // 余裕を持たせる（v4。v8 でもマージンは維持）。
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
    if (domeActive()) domeFrame(); else apply();
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
    syncPlayBtn(); // v8: コンパクト操作列の表示を本体の状態に合わせる
    syncPenBtn();
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

  /* ---------- 会場全画面のコンパクト操作列（v8） ----------
     挙動は二重実装せず、本体の既存ボタンをプログラム的にクリック
     して再利用する。本体ボタンは会場全画面で非表示（display:none）
     になっているが、click() は表示状態によらず発火し、document へ
     バブリングして app.js の委譲ハンドラ（data-a）が動く。 */
  var playBtnC = document.getElementById("vnPlayBtn");
  var playIcoC = document.getElementById("vnPlayIco");
  var playCapC = document.getElementById("vnPlayCap");
  var penBtnC = document.getElementById("vnPenBtn");
  var penDotC = document.getElementById("vnPenDot");
  var wakuBtnC = document.getElementById("vnWakuBtn");
  function mainPlayBtn() { return document.getElementById("fsplay") || document.getElementById("play"); }
  function mainPenBtn() { return document.getElementById("penbtn") || document.querySelector('#fspads [data-a="pen"]'); }
  function mainWakuBtn() { return document.getElementById("wakubtn") || document.querySelector('#fspads [data-a="waku"]'); }

  // 再生ボタンの表示は、本体 #fsplay の文言（再生/一時停止）に同期
  // する。app.js の loop が再生状態に応じて毎フレーム書き換える
  // （同じ値の代入でも監視が発火しうる）ので、状態が変わったとき
  // だけコンパクト側を書き換える。
  var playShown = null;
  function syncPlayBtn() {
    var b = mainPlayBtn();
    if (!b || !playBtnC) return;
    var playing = b.textContent.indexOf("一時停止") >= 0;
    if (playing === playShown) return;
    playShown = playing;
    playIcoC.innerHTML = playing ? ICO_PAUSE : ICO_PLAY;
    playCapC.textContent = playing ? "一時停止" : "再生";
    playBtnC.setAttribute("aria-label", playing ? "一時停止" : "再生");
  }
  // ペンライトの押下状態と色ドットは、本体 #pen の class（on）と
  // style.color（penColor アクションが書く）に同期する。
  function syncPenBtn() {
    var pen = document.getElementById("pen");
    if (!pen || !penBtnC) return;
    penBtnC.setAttribute("aria-pressed", pen.classList.contains("on") ? "true" : "false");
    var col = pen.style.color;
    if (!col) {
      try { col = window.getComputedStyle(document.documentElement).getPropertyValue("--pc").trim(); } catch (e) {}
    }
    if (col) { penDotC.style.background = col; penDotC.style.color = col; }
  }
  var fsplayEl = document.getElementById("fsplay");
  if (fsplayEl) {
    new MutationObserver(syncPlayBtn).observe(fsplayEl,
      { childList: true, characterData: true, subtree: true });
  }
  var penEl = document.getElementById("pen");
  if (penEl) {
    new MutationObserver(syncPenBtn).observe(penEl,
      { attributes: true, attributeFilter: ["class", "style"] });
  }
  syncPlayBtn();
  syncPenBtn();

  if (playBtnC) playBtnC.addEventListener("click", function () {
    var b = mainPlayBtn(); if (b) b.click();
  });
  if (wakuBtnC) wakuBtnC.addEventListener("click", function () {
    var b = mainWakuBtn(); if (b) b.click();
  });
  // ペンライトは本体と同じ挙動を、本体ボタンへのイベント転送で
  // 再利用する。タップ=点灯/消灯は click の転送で委譲ハンドラが
  // 処理する。長押し=色バーは、本体ボタンに付けられた pointerdown
  // リスナー（480ms タイマー＋抑制フラグ）が担うため、コンパクト側の
  // pointerdown/up をそのまま本体ボタンへ転送する。長押し後に
  // click を転送すると、本体側の click リスナーが抑制フラグを見て
  // 伝播を止めるので、点灯/消灯は起きない（本体と同じ）。
  function forwardPointer(type) {
    var b = mainPenBtn();
    if (!b) return;
    var ev = null;
    try { ev = new PointerEvent(type, { bubbles: true, cancelable: true }); }
    catch (e) {
      try { ev = new MouseEvent(type, { bubbles: true, cancelable: true }); } catch (e2) {}
    }
    if (ev) b.dispatchEvent(ev);
  }
  if (penBtnC) {
    penBtnC.addEventListener("pointerdown", function () { forwardPointer("pointerdown"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      penBtnC.addEventListener(t, function () { forwardPointer(t); });
    });
    penBtnC.addEventListener("click", function () {
      var b = mainPenBtn(); if (b) b.click();
      syncPenBtn();
    });
    penBtnC.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  /* ---------- v9: ライブハウス用 270°ドーム（Gemini VR試作 v5 の移植） ----------
     ライブハウス会場のときだけ有効。それ以外・読み込み失敗時は v8 の
     平らな表示のまま（domeActive() が false を返し、従来経路で描く）。
     視点（current/currentP・ジャイロ・ドラッグ）は v8 のものをそのまま
     使い、ドームのカメラへ渡すだけにする。 */
  var DOME_VENUE_ID = "livehouse";
  var DOME_DEG = Math.PI / 180;
  var domeState = "idle"; // idle | loading | ready | failed
  var domeOn = false;
  var D = null;           // THREE 関連一式（ready のときに buildDome が作る）

  var glCanvas = document.createElement("canvas");
  glCanvas.className = "vn-gl";
  glCanvas.setAttribute("aria-hidden", "true");
  mv.insertBefore(glCanvas, mv.firstChild);

  function domeActive() { return domeOn && D !== null; }

  function domeSyncVenue() {
    var want = on && VENUES[venueIdx].id === DOME_VENUE_ID && domeState === "ready";
    if (want && !domeOn) {
      domeOn = true;
      mv.classList.add("vn-dome");
      domeResize();
    } else if (!want && domeOn) {
      domeOn = false;
      mv.classList.remove("vn-dome");
      var yEl = claimYt();
      if (yEl) yEl.style.transformOrigin = "";
      apply();
    }
  }

  function ensureDome() {
    if (domeState === "ready") { domeSyncVenue(); return; }
    if (domeState !== "idle") return;
    domeState = "loading";
    var sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    sc.onload = function () {
      var imgEl = new Image();
      imgEl.onload = function () {
        try {
          buildDome(imgEl);
          domeState = "ready";
          domeSyncVenue();
          if (on && !domeActive()) apply();
        } catch (e) { domeState = "failed"; }
      };
      imgEl.onerror = function () { domeState = "failed"; };
      imgEl.src = "venue/livehouse-vr.jpg";
    };
    sc.onerror = function () { domeState = "failed"; };
    document.head.appendChild(sc);
  }

  function domeResize() {
    if (!D) return;
    var w = mv.clientWidth, h = mv.clientHeight;
    if (!w || !h) return;
    D.lastW = w; D.lastH = h;
    D.camera.aspect = w / h;
    D.camera.updateProjectionMatrix();
    D.renderer.setSize(w, h, false);
  }

  /* ドームのテクスチャ合成（v5 の方式そのまま: 正面の実写＋左右は端の
     反転コピーで延長し、天井トラス・壁面パネル・床のグラデーションで
     2048×1024 のエクイレクタングラーに包む） */
  function buildDomeTexture(imgEl) {
    var TEX_W = 2048, TEX_H = 1024;
    var cnv = document.createElement("canvas");
    cnv.width = TEX_W; cnv.height = TEX_H;
    var ctx = cnv.getContext("2d");
    var bgGrad = ctx.createLinearGradient(0, 0, 0, TEX_H);
    bgGrad.addColorStop(0.00, "#04050b");
    bgGrad.addColorStop(0.24, "#090b17");
    bgGrad.addColorStop(0.45, "#121324");
    bgGrad.addColorStop(0.68, "#0c0b16");
    bgGrad.addColorStop(1.00, "#030307");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.strokeStyle = "rgba(130, 155, 220, 0.14)";
    ctx.lineWidth = 2;
    var y, x;
    for (y = 40; y < TEX_H * 0.30; y += 34) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TEX_W, y); ctx.stroke();
    }
    for (x = 0; x < TEX_W; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TEX_H * 0.30); ctx.stroke();
    }
    ctx.fillStyle = "rgba(26, 28, 46, 0.55)";
    for (x = 0; x < TEX_W; x += 96) {
      ctx.fillRect(x + 8, TEX_H * 0.30, 76, TEX_H * 0.36);
    }
    ctx.fillStyle = "rgba(34, 197, 94, 0.55)";
    ctx.fillRect(TEX_W * 0.18, TEX_H * 0.55, 18, 12);
    ctx.fillRect(TEX_W * 0.82, TEX_H * 0.55, 18, 12);
    if (imgEl.naturalWidth > 0) {
      var frontW = Math.round(TEX_W * 0.486);
      var frontH = Math.round(frontW * (imgEl.naturalHeight / imgEl.naturalWidth));
      var fx = Math.round((TEX_W - frontW) * 0.5);
      var fy = Math.round((TEX_H - frontH) * 0.5 + 14);
      var flankSrcW = Math.round(imgEl.naturalWidth * 0.24);
      var flankDstW = Math.round(TEX_W * 0.16);
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.translate(fx, fy);
      ctx.scale(-1, 1);
      ctx.drawImage(imgEl, 0, 0, flankSrcW, imgEl.naturalHeight, 0, 0, flankDstW, frontH);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.translate(fx + frontW, fy);
      ctx.scale(-1, 1);
      ctx.drawImage(imgEl, imgEl.naturalWidth - flankSrcW, 0, flankSrcW, imgEl.naturalHeight,
        -flankDstW, 0, flankDstW, frontH);
      ctx.restore();
      ctx.drawImage(imgEl, fx, fy, frontW, frontH);
      var fadeLeft = ctx.createLinearGradient(fx - flankDstW, 0, fx + 30, 0);
      fadeLeft.addColorStop(0, "#070812");
      fadeLeft.addColorStop(0.55, "rgba(7,8,18,0.35)");
      fadeLeft.addColorStop(1, "rgba(7,8,18,0)");
      ctx.fillStyle = fadeLeft;
      ctx.fillRect(fx - flankDstW, fy - 10, flankDstW + 30, frontH + 20);
      var fadeRight = ctx.createLinearGradient(fx + frontW - 30, 0, fx + frontW + flankDstW, 0);
      fadeRight.addColorStop(0, "rgba(7,8,18,0)");
      fadeRight.addColorStop(0.45, "rgba(7,8,18,0.35)");
      fadeRight.addColorStop(1, "#070812");
      ctx.fillStyle = fadeRight;
      ctx.fillRect(fx + frontW - 30, fy - 10, flankDstW + 30, frontH + 20);
      var fadeTop = ctx.createLinearGradient(0, fy - 10, 0, fy + 54);
      fadeTop.addColorStop(0, "#060812");
      fadeTop.addColorStop(1, "rgba(6,8,18,0)");
      ctx.fillStyle = fadeTop;
      ctx.fillRect(fx - flankDstW, fy - 10, frontW + flankDstW * 2, 64);
      var fadeBot = ctx.createLinearGradient(0, fy + frontH - 50, 0, fy + frontH + 16);
      fadeBot.addColorStop(0, "rgba(4,5,10,0)");
      fadeBot.addColorStop(1, "#04050a");
      ctx.fillStyle = fadeBot;
      ctx.fillRect(fx - flankDstW, fy + frontH - 50, frontW + flankDstW * 2, 66);
    }
    var tex = new THREE.CanvasTexture(cnv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.32, "rgba(255,255,255,0.75)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function makeBeamTexture() {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 256;
    var b = c.getContext("2d");
    var gr = b.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0.0, "rgba(255,255,255,0.85)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.28)");
    gr.addColorStop(1.0, "rgba(255,255,255,0.0)");
    b.fillStyle = gr;
    b.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  }

  function buildDome(imgEl) {
    var renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04050a);
    var camera = new THREE.PerspectiveCamera(78, 1, 1, 2000);
    camera.position.set(0, 0, 0);

    var domeGeo = new THREE.SphereGeometry(620, 48, 28);
    domeGeo.scale(-1, 1, 1);
    var domeMesh = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ map: buildDomeTexture(imgEl) }));
    domeMesh.rotation.y = -Math.PI * 0.5; // テクスチャ中央（正面の実写）が -Z に来る配置
    scene.add(domeMesh);

    // 客席ペンライト（v5 は240本。本番は祐治の端末負荷を考え180本に抑える）
    var glowTex = makeGlowTexture();
    var paletteHex = [0xff2a85, 0x38bdf8, 0xfacc15, 0x34d399, 0xc084fc, 0xfb923c];
    var penlightNodes = [];
    var penlightGroup = new THREE.Group();
    scene.add(penlightGroup);
    for (var i = 0; i < 180; i++) {
      var azDeg = (Math.random() * 276) - 138;
      var az = azDeg * DOME_DEG;
      var radius = 280 + Math.random() * 230;
      var baseY = -125 - Math.random() * 140;
      var baseColor = new THREE.Color(paletteHex[i % paletteHex.length]);
      var mat = new THREE.SpriteMaterial({
        map: glowTex, color: baseColor.clone(), transparent: true, opacity: 0.72,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var sp = new THREE.Sprite(mat);
      var baseScale = 22 + Math.random() * 26;
      sp.scale.set(baseScale, baseScale * 1.45, 1);
      var bx = Math.sin(az) * radius;
      var bz = -Math.cos(az) * radius;
      sp.position.set(bx, baseY, bz);
      penlightGroup.add(sp);
      penlightNodes.push({
        sprite: sp, baseX: bx, baseY: baseY, baseZ: bz, baseScale: baseScale,
        baseColor: baseColor, phase: Math.random() * Math.PI * 2,
        delayMs: 18 + Math.random() * 78
      });
    }

    // ステージ照明ビーム（6本、v5 そのまま）
    var beamTex = makeBeamTexture();
    var beamMeshes = [];
    var beamColors = [0xff2a85, 0xec4899, 0xa855f7, 0x38bdf8, 0x22d3ee, 0x34d399];
    for (var j = 0; j < 6; j++) {
      var coneGeo = new THREE.ConeGeometry(78, 560, 20, 1, true);
      coneGeo.translate(0, -280, 0);
      var coneMat = new THREE.MeshBasicMaterial({
        color: beamColors[j], map: beamTex, transparent: true, opacity: 0.14,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      });
      var cone = new THREE.Mesh(coneGeo, coneMat);
      var angleSpread = ((j / 5) - 0.5) * 1.55;
      cone.position.set(Math.sin(angleSpread) * 260, 260, -Math.cos(angleSpread) * 320);
      cone.rotation.z = -angleSpread * 0.55;
      scene.add(cone);
      beamMeshes.push({
        mesh: cone, baseColor: new THREE.Color(beamColors[j]),
        baseRotZ: cone.rotation.z, speed: 0.55 + j * 0.11, phase: j * 1.15
      });
    }

    D = {
      renderer: renderer, scene: scene, camera: camera,
      penlightNodes: penlightNodes, beamMeshes: beamMeshes,
      tmpColor: new THREE.Color(), tmpEuler: new THREE.Euler(0, 0, 0, "YXZ"),
      tmpV: new THREE.Vector3(), lastW: 0, lastH: 0
    };
  }

  /* ---------- コール反応（実際のカードに連動） ---------- */
  var MEMBER_COLOR_PRESET = {
    "かなこ": "#e60012", "しおり": "#ffd400", "れに": "#9333ea", "あーりん": "#ff6fb5"
  };
  var activeCalls = [];
  function triggerCall(opt) {
    if (!window.THREE) return;
    opt = opt || {};
    var colorHex = opt.colorHex || null;
    if (!colorHex && opt.member) colorHex = MEMBER_COLOR_PRESET[opt.member] || null;
    activeCalls.push({
      startMs: performance.now(), durationMs: opt.durationMs || 580,
      color: colorHex ? new THREE.Color(colorHex) : null, intensity: opt.intensity || 1.0
    });
    if (activeCalls.length > 10) activeCalls.shift();
  }
  function callEnvelope(nowMs, delayMs) {
    var sum = 0, activeColor = null;
    for (var i = activeCalls.length - 1; i >= 0; i--) {
      var c = activeCalls[i];
      var elapsed = nowMs - c.startMs - delayMs;
      if (elapsed < 0 || elapsed > c.durationMs) continue;
      var p = elapsed / c.durationMs;
      var env = p < 0.18
        ? Math.sin((p / 0.18) * (Math.PI * 0.5))
        : Math.pow(1 - (p - 0.18) / 0.82, 1.8);
      sum += env * c.intensity;
      if (!activeColor && c.color && env > 0.15) activeColor = c.color;
    }
    return { energy: Math.min(1.4, sum), color: activeColor };
  }

  function memberFromLabel(label) {
    if (!label) return null;
    if (/かなこ|夏菜子/.test(label)) return "かなこ";
    if (/しおり|詩織/.test(label)) return "しおり";
    if (/れに/.test(label)) return "れに";
    if (/あーりん|アーリン|彩夏/.test(label)) return "あーりん";
    return null;
  }
  function kindColorHex(el) {
    if (el.classList.contains("k-sing") || el.classList.contains("b-sing")) return "#38bdf8";
    if (el.classList.contains("k-koko") || el.classList.contains("b-koko")) return "#facc15";
    return "#ff2a85";
  }
  var firedCards = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  function maybeFireCard(el) {
    if (!on || !domeActive()) return;
    var st = el.querySelector ? el.querySelector("strong") : null;
    var label = st ? (st.textContent || "") : "";
    if (!label) return;
    if (firedCards && firedCards.get(el) === label) return;
    if (firedCards) firedCards.set(el, label);
    var member = memberFromLabel(label);
    triggerCall({
      label: label, member: member,
      colorHex: member ? null : kindColorHex(el),
      intensity: 1.15, durationMs: 640
    });
  }
  function scanCards(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && (node.classList.contains("p2c") || node.classList.contains("p2bub"))) {
      maybeFireCard(node);
    }
    if (node.querySelectorAll) {
      var q = node.querySelectorAll(".p2c, .p2bub");
      for (var i = 0; i < q.length; i++) maybeFireCard(q[i]);
    }
  }
  var cardObs = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.type === "childList") {
        for (var j = 0; j < r.addedNodes.length; j++) scanCards(r.addedNodes[j]);
      } else if (r.type === "attributes" && r.target && r.target.classList &&
                 r.target.classList.contains("p2c")) {
        if (r.target.classList.contains("pp0")) maybeFireCard(r.target);
        else if (firedCards) firedCards.delete(r.target); // 前面を離れたら再武装
      }
    }
  });
  cardObs.observe(mv, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  /* ---------- 映像（#yt）をドームのスクリーン枠へ射影変換で貼る ---------- */
  var SLOT_W = 392, SLOT_H = 221;
  // スクリーン枠の4隅（three 座標、正面 Z=-500。v5 の .youtube-slot と同じ置き方）
  var SLOT_CORNERS = [[-196, 115], [196, 115], [-196, -106], [196, -106]]; // TL TR BL BR
  function solveHomography(src, dst) {
    var A = [], b = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], X = dst[i][0], Y = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
    }
    for (i = 0; i < 8; i++) {
      var piv = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-10) return null;
      if (piv !== i) {
        var ta = A[i]; A[i] = A[piv]; A[piv] = ta;
        var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      }
      for (j = i + 1; j < 8; j++) {
        var f = A[j][i] / A[i][i];
        if (!f) continue;
        for (k = i; k < 8; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var out = [0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 7; i >= 0; i--) {
      var sum = b[i];
      for (j = i + 1; j < 8; j++) sum -= A[i][j] * out[j];
      out[i] = sum / A[i][i];
    }
    return out; // [a,b,c,d,e,f,g,h]
  }
  var SLOT_SRC = [[0, 0], [SLOT_W, 0], [0, SLOT_H], [SLOT_W, SLOT_H]];
  function syncVideoSlot() {
    var yEl = claimYt();
    if (!yEl || !D) return;
    var w = mv.clientWidth, h = mv.clientHeight;
    var dst = [];
    for (var i = 0; i < 4; i++) {
      D.tmpV.set(SLOT_CORNERS[i][0], SLOT_CORNERS[i][1], -500);
      var viewZ = D.tmpV.clone().applyMatrix4(D.camera.matrixWorldInverse).z;
      if (viewZ > -60) { // 枠が視界の外（真横など）なら映像は画面外へ逃がす
        yEl.style.transform = "translate(-3000px,-3000px)";
        return;
      }
      D.tmpV.project(D.camera);
      dst.push([(D.tmpV.x + 1) / 2 * w, (1 - D.tmpV.y) / 2 * h]);
    }
    var H = solveHomography(SLOT_SRC, dst);
    if (!H) return;
    yEl.style.setProperty("left", "0px", "important");
    yEl.style.setProperty("top", "0px", "important");
    yEl.style.setProperty("width", SLOT_W + "px", "important");
    yEl.style.setProperty("height", SLOT_H + "px", "important");
    yEl.style.setProperty("right", "auto", "important");
    yEl.style.setProperty("bottom", "auto", "important");
    yEl.style.transformOrigin = "0 0";
    yEl.style.transform = "matrix3d(" +
      [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, 1].join(",") + ")";
  }

  /* ---------- ドームの毎フレーム描画（loop() から呼ばれる） ---------- */
  function domeFrame() {
    if (!D) return;
    var w = mv.clientWidth, h = mv.clientHeight;
    if (!w || !h) return;
    if (w !== D.lastW || h !== D.lastH) domeResize();
    var fov = h > w ? 96 : 78; // v5 と同じ: 縦画面は広角96°、横画面は78°
    if (D.camera.fov !== fov) { D.camera.fov = fov; D.camera.updateProjectionMatrix(); }
    D.tmpEuler.set(currentP * DOME_DEG, -current * DOME_DEG, 0);
    D.camera.quaternion.setFromEuler(D.tmpEuler);
    D.camera.updateMatrixWorld();

    var nowMs = performance.now();
    var nowSec = nowMs * 0.001;
    while (activeCalls.length > 0 && (nowMs - activeCalls[0].startMs) > activeCalls[0].durationMs + 150) {
      activeCalls.shift();
    }
    var i, p, env;
    for (i = 0; i < D.penlightNodes.length; i++) {
      p = D.penlightNodes[i];
      env = callEnvelope(nowMs, p.delayMs);
      var swayX = Math.sin(nowSec * 3.0 + p.phase) * 9;
      var bobY = Math.abs(Math.sin(nowSec * 3.0 + p.phase)) * 8 + env.energy * 48;
      p.sprite.position.set(p.baseX + swayX, p.baseY + bobY, p.baseZ);
      var sc = p.baseScale * (1 + env.energy * 0.45);
      p.sprite.scale.set(sc, sc * 1.45, 1);
      if (env.color) {
        D.tmpColor.copy(p.baseColor).lerp(env.color, Math.min(1, env.energy * 0.9));
        p.sprite.material.color.copy(D.tmpColor);
      } else {
        p.sprite.material.color.copy(p.baseColor);
      }
      p.sprite.material.opacity = Math.min(0.95, 0.52 + env.energy * 0.42);
    }
    var g = callEnvelope(nowMs, 0);
    for (i = 0; i < D.beamMeshes.length; i++) {
      var bm = D.beamMeshes[i];
      bm.mesh.rotation.z = bm.baseRotZ + Math.sin(nowSec * bm.speed + bm.phase) * 0.22;
      bm.mesh.material.opacity = Math.min(0.24, 0.08 + g.energy * 0.12);
      if (g.color) {
        D.tmpColor.copy(bm.baseColor).lerp(g.color, Math.min(1, g.energy * 0.85));
        bm.mesh.material.color.copy(D.tmpColor);
      } else {
        bm.mesh.material.color.copy(bm.baseColor);
      }
    }

    syncVideoSlot();
    D.renderer.render(D.scene, D.camera);
  }

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
    ensureDome();
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }
  function exit() {
    if (!on) return;
    on = false;
    fsExit();
    gyroOff();
    mv.classList.remove("vn");
    mv.classList.remove("vn-dome");
    domeOn = false;
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
