(() => {
  "use strict";

  const TRACKS = [
    {
      id: "hashire",
      name: "走れ!",
      videoId: "tCD81ACqUYk",
      accent: "#ff4aa8",
      calls: [
        {t:7.2,text:"うりゃおい！"},{t:12.8,text:"ハイ！ハイ！"},{t:20.1,text:"しおりん！"},{t:21.0,text:"しおりん！"},{t:22.0,text:"しおりん！"},
        {t:31.5,text:"オイ！オイ！"},{t:43.2,text:"かなこぉー！"},{t:44.1,text:"夏菜子⤴️⤴️"},{t:45.0,text:"夏菜子⤴️⤴️"},
        {t:58.4,text:"うりゃおい！"},{t:69.7,text:"れにちゃーん！"},{t:70.6,text:"れにちゃーん！"},{t:82.3,text:"あーりん！"},
        {t:96.2,text:"うりゃおい！"},{t:97.1,text:"うりゃおい！"},{t:98.0,text:"うりゃおい！"},{t:112.5,text:"ももクロ！"},{t:126.8,text:"ハイ！ハイ！"},
        {t:145.4,text:"全力疾走！"},{t:146.3,text:"全力疾走！"},{t:147.2,text:"全力疾走！"},{t:164.5,text:"うりゃおい！"},{t:178.1,text:"オイ！オイ！"}
      ]
    },
    {
      id: "event",
      name: "Event Horizon",
      videoId: "XN4RSUj15TE",
      accent: "#43e6ff",
      calls: [
        {t:5.8,text:"Are you ready?"},{t:14.2,text:"Hey！"},{t:15.0,text:"Hey！"},{t:16.0,text:"Hey！"},{t:28.6,text:"うりゃおい！"},
        {t:39.4,text:"もっと！"},{t:40.3,text:"もっと！"},{t:41.2,text:"もっと！"},{t:53.8,text:"Wow！"},{t:67.1,text:"オイ！オイ！"},
        {t:68.0,text:"オイ！オイ！"},{t:79.5,text:"Jump！"},{t:94.2,text:"Hey！Hey！"},{t:95.1,text:"Hey！Hey！"},
        {t:108.7,text:"うりゃおい！"},{t:121.4,text:"まだまだ！"},{t:122.3,text:"まだまだ！"},{t:139.8,text:"Wow Wow！"},
        {t:155.2,text:"オイ！オイ！"},{t:156.1,text:"オイ！オイ！"},{t:157.0,text:"オイ！オイ！"},{t:174.3,text:"最高！"}
      ]
    },
    {
      id: "thief",
      name: "行くぜっ!怪盗少女 -ZZ ver.-",
      videoId: "f-X5-pYU9gM",
      accent: "#ffb15d",
      calls: [
        {t:6.5,text:"チャイム！"},{t:13.7,text:"れに！"},{t:14.6,text:"かなこ！"},{t:15.5,text:"しおりん！"},{t:16.4,text:"あーりん！"},
        {t:25.2,text:"ももか！"},{t:34.8,text:"行くぜっ！"},{t:35.7,text:"行くぜっ！"},{t:36.6,text:"行くぜっ！"},
        {t:49.3,text:"うりゃおい！"},{t:63.5,text:"かなこぉー！"},{t:64.4,text:"夏菜子⤴️⤴️"},{t:65.3,text:"夏菜子⤴️⤴️"},
        {t:78.9,text:"しおりん！"},{t:79.8,text:"しおりん！"},{t:91.2,text:"あーりん！"},{t:106.4,text:"怪盗少女！"},
        {t:107.3,text:"怪盗少女！"},{t:108.2,text:"怪盗少女！"},{t:124.8,text:"うりゃおい！"},{t:143.1,text:"オイ！オイ！"},
        {t:161.6,text:"ももクロ！"},{t:162.5,text:"ももクロ！"},{t:163.4,text:"ももクロ！"},{t:177.7,text:"行くぜっ！"}
      ]
    }
  ];

  const STORAGE_PREFIX = "call-danmaku-rehearsal:v1:";
  const CALL_PHRASES = ["うりゃおい！", "オイ！オイ！", "ハイ！ハイ！", "Wow！", "もっと！", "最高！"];
  const $ = (id) => document.getElementById(id);
  const state = {
    trackIndex: 0, player: null, playerReady: false, nextSample: 0, lastVideoTime: 0,
    records: {}, crowd: 0, recentEvents: [], phraseIndex: 0, toastTimer: null,
    particles: [], raf: 0, lastFrame: 0, heatDecayAt: 0
  };

  function readRecords(track) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_PREFIX + track.id) || "[]");
      return Array.isArray(parsed) ? parsed.filter(x => x && Number.isFinite(x.t) && typeof x.text === "string") : [];
    } catch (_) { return []; }
  }
  function saveRecords() {
    const track = TRACKS[state.trackIndex];
    try { localStorage.setItem(STORAGE_PREFIX + track.id, JSON.stringify(state.records[track.id] || [])); }
    catch (_) { showToast("保存できませんでした。ブラウザの保存領域を確認してください"); }
  }
  function currentTrack() { return TRACKS[state.trackIndex]; }
  function videoTime() {
    if (state.playerReady && state.player && typeof state.player.getCurrentTime === "function") {
      try { return Math.max(0, state.player.getCurrentTime() || 0); } catch (_) {}
    }
    return 0;
  }
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "--:--";
    const s = Math.max(0, Math.floor(seconds));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function heatBins(calls, count = 42) {
    const bins = Array(count).fill(0);
    calls.forEach(call => {
      const index = Math.min(count - 1, Math.floor(call.t / 190 * count));
      bins[index] += 1;
    });
    const max = Math.max(1, ...bins);
    return bins.map(n => Math.max(3, Math.round(4 + n / max * 18)));
  }
  function renderTrackList() {
    const host = $("song-list");
    host.innerHTML = TRACKS.map((track, index) => {
      const bins = heatBins(track.calls);
      const records = state.records[track.id] || [];
      return '<button class="song-card' + (index === state.trackIndex ? ' selected' : '') + '" type="button" data-track="' + index + '" aria-pressed="' + (index === state.trackIndex) + '">' +
        '<span class="song-number">TRACK 0' + (index + 1) + '</span>' +
        '<strong class="song-name">' + escapeHTML(track.name) + '</strong>' +
        '<span class="song-meta"><span>' + track.calls.length + ' SAMPLE CALLS</span><strong>' + records.length + ' YOU</strong></span>' +
        '<span class="heat-label"><span>HEAT RADAR</span><span>LOW → HIGH</span></span>' +
        '<span class="heat-bar" aria-label="サンプルコール密度">' + bins.map(h => '<i style="height:' + h + 'px"></i>').join('') + '</span></button>';
    }).join("");
    host.querySelectorAll("[data-track]").forEach(button => button.addEventListener("click", () => selectTrack(Number(button.dataset.track))));
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  }
  function selectTrack(index) {
    if (!Number.isInteger(index) || index < 0 || index >= TRACKS.length || index === state.trackIndex) return;
    state.trackIndex = index;
    const track = currentTrack();
    state.nextSample = 0;
    state.lastVideoTime = 0;
    state.crowd = 0;
    state.recentEvents = [];
    state.records[track.id] = readRecords(track);
    $("danmaku-layer").innerHTML = "";
    $("stage-song-name").textContent = track.name;
    $("crowd-fill").style.width = "0%";
    $("crowd-value").textContent = "00";
    $("play-state").textContent = "LOADING TRACK";
    renderTrackList();
    renderStats();
    if (state.playerReady && state.player) {
      state.player.loadVideoById({ videoId: track.videoId, startSeconds: 0 });
    } else {
      showToast("プレイヤーの準備ができたら再生します");
    }
  }
  function renderStats() {
    const records = state.records[currentTrack().id] || [];
    $("tap-count").textContent = records.length;
    $("perfect-count").textContent = records.filter(r => r.grade === "PERFECT").length;
    $("good-count").textContent = records.filter(r => r.grade === "GOOD").length;
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function addDanmaku(text, options = {}) {
    const layer = $("danmaku-layer");
    const node = document.createElement("span");
    const lane = 7 + Math.random() * 78;
    const speed = options.mine ? 4.8 + Math.random() * 1.5 : 6.8 + Math.random() * 3.4;
    node.className = "danmaku" + (options.mine ? " mine" : "") + (options.perfect ? " perfect" : "");
    node.textContent = text;
    node.style.setProperty("--lane", lane + "%");
    node.style.setProperty("--speed", speed + "s");
    node.style.setProperty("--d-color", options.mine ? "#fff" : (options.color || currentTrack().accent));
    layer.appendChild(node);
    node.addEventListener("animationend", () => node.remove(), { once: true });
    while (layer.children.length > 34) layer.firstElementChild.remove();
  }
  function setCrowd(amount) {
    state.crowd = Math.max(0, Math.min(100, state.crowd + amount));
    $("crowd-fill").style.width = state.crowd + "%";
    $("crowd-value").textContent = String(Math.round(state.crowd)).padStart(2, "0");
  }
  function eventHeat(type, text) {
    const now = performance.now();
    state.recentEvents = state.recentEvents.filter(item => now - item.at < 3600);
    state.recentEvents.push({ at: now, type });
    setCrowd(type === "mine" ? 13 : 7);
    if (state.recentEvents.length >= 7) {
      state.recentEvents = [];
      triggerAvalanche();
    }
  }
  function triggerAvalanche() {
    $("avalanche-label").classList.remove("show");
    void $("avalanche-label").offsetWidth;
    $("avalanche-label").classList.add("show");
    burstParticles();
  }
  function burstParticles(intensity = 1) {
    const canvas = $("burst-canvas");
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cx = rect.width / 2, cy = rect.height / 2;
    const colors = ["#ff3fa4", "#40e7ff", "#c9ff58", "#ffffff", "#9b70ff"];
    for (let i = 0; i < (intensity > 0.8 ? 95 : 16); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (intensity > 0.8 ? 1.5 : .7) + Math.random() * (intensity > 0.8 ? 6 : 2.5);
      state.particles.push({ x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:1, decay:.012+Math.random()*.012, size:1.5+Math.random()*3.5, color:colors[Math.floor(Math.random()*colors.length)] });
    }
    if (!state.raf) state.raf = requestAnimationFrame(drawParticles);
  }
  function drawParticles(time) {
    const canvas = $("burst-canvas"), ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, rect.width, rect.height);
    state.particles = state.particles.filter(p => p.life > 0);
    state.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += .035; p.vx *= .992; p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (state.particles.length) state.raf = requestAnimationFrame(drawParticles);
    else { state.raf = 0; ctx.clearRect(0, 0, rect.width, rect.height); }
  }
  function judgeTap(t) {
    const calls = currentTrack().calls;
    let nearest = Infinity;
    calls.forEach(call => { nearest = Math.min(nearest, Math.abs(call.t - t)); });
    if (nearest <= .6) return "PERFECT";
    if (nearest <= 1.2) return "GOOD";
    return "";
  }
  function tapCall() {
    const track = currentTrack();
    const t = Math.round(videoTime() * 100) / 100;
    const phrase = CALL_PHRASES[state.phraseIndex % CALL_PHRASES.length];
    state.phraseIndex++;
    const grade = judgeTap(t);
    const record = { t, text: phrase, grade, savedAt: Date.now() };
    if (!state.records[track.id]) state.records[track.id] = [];
    state.records[track.id].push(record);
    saveRecords();
    addDanmaku(phrase, { mine:true, perfect:grade === "PERFECT" });
    burstParticles(.35);
    eventHeat("mine", phrase);
    renderStats();
    renderTrackList();
    const button = $("tap-button");
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 110);
    if (grade) showToast(grade + "  •  " + t.toFixed(2) + "s");
    else showToast("RECORDED  •  " + t.toFixed(2) + "s");
  }
  function tick() {
    const t = videoTime();
    $("current-time").textContent = formatTime(t);
    if (state.playerReady && state.player && typeof state.player.getDuration === "function") {
      try { $("duration-time").textContent = formatTime(state.player.getDuration()); } catch (_) {}
    }
    if (t + .7 < state.lastVideoTime) {
      state.nextSample = currentTrack().calls.findIndex(call => call.t > t);
      if (state.nextSample < 0) state.nextSample = currentTrack().calls.length;
    }
    const calls = currentTrack().calls;
    while (state.nextSample < calls.length && t >= calls[state.nextSample].t) {
      const call = calls[state.nextSample++];
      addDanmaku(call.text);
      eventHeat("sample", call.text);
    }
    state.lastVideoTime = t;
    if (state.crowd > 0 && performance.now() - state.heatDecayAt > 180) {
      state.crowd = Math.max(0, state.crowd - .45);
      $("crowd-fill").style.width = state.crowd + "%";
      $("crowd-value").textContent = String(Math.round(state.crowd)).padStart(2, "0");
      state.heatDecayAt = performance.now();
    }
  }
  function onPlayerState(event) {
    const playing = event.data === YT.PlayerState.PLAYING;
    $("stage").classList.toggle("is-playing", playing);
    if (playing) {
      $("play-state").textContent = "NOW PLAYING";
      $("stage-tap-hint").textContent = "ステージをタップして参加";
    } else if (event.data === YT.PlayerState.PAUSED) {
      $("play-state").textContent = "PAUSED";
    } else if (event.data === YT.PlayerState.ENDED) {
      $("play-state").textContent = "SHOW COMPLETE";
    } else if (event.data === YT.PlayerState.BUFFERING) {
      $("play-state").textContent = "BUFFERING";
    } else if (event.data === YT.PlayerState.CUED) {
      $("play-state").textContent = "READY TO GO";
    }
  }
  function initPlayer() {
    if (!window.YT || !window.YT.Player) return;
    state.player = new YT.Player("yt-player", {
      videoId: currentTrack().videoId,
      playerVars: { playsinline:1, rel:0, modestbranding:1, iv_load_policy:3, origin:location.origin },
      events: {
        onReady: () => {
          state.playerReady = true;
          $("play-state").textContent = "READY TO GO";
          $("duration-time").textContent = formatTime(state.player.getDuration());
          showToast("ステージ準備完了！");
        },
        onStateChange: onPlayerState,
        onError: event => {
          $("play-state").textContent = "PLAYER ERROR";
          showToast("動画を再生できません（YouTube error " + event.data + "）");
        }
      }
    });
  }
  function clearTrack() {
    const track = currentTrack();
    const records = state.records[track.id] || [];
    if (!records.length) { showToast("この曲のタップ記録はありません"); return; }
    if (!window.confirm("「" + track.name + "」の自分のタップ記録 " + records.length + " 件を消去しますか？")) return;
    state.records[track.id] = [];
    saveRecords();
    renderStats();
    renderTrackList();
    showToast("この曲のタップ記録を消去しました");
  }
  function init() {
    state.records = {};
    TRACKS.forEach(track => { state.records[track.id] = readRecords(track); });
    $("stage-song-name").textContent = currentTrack().name;
    renderTrackList();
    renderStats();
    $("tap-button").addEventListener("click", tapCall);
    $("stage").addEventListener("click", event => {
      if (event.target.closest("button") || event.target.closest("iframe") || event.target.closest(".video-wrap")) return;
      tapCall();
    });
    $("clear-button").addEventListener("click", clearTrack);
    window.setInterval(tick, 200);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = initPlayer;
    if (window.YT && window.YT.Player) initPlayer();
  }
  document.addEventListener("DOMContentLoaded", init, { once:true });
})();