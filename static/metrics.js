(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var setText = function (key, value) {
    var nodes = document.querySelectorAll('[data-k="' + key + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  };

  var SPARK_MAX = 60;
  var sparkData = [];
  var canvas = $("#spark");
  var ctx = canvas.getContext("2d");

  function drawSpark() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (sparkData.length < 2) {
      ctx.fillStyle = "#8b94a7";
      ctx.font = "12px " + getComputedStyle(canvas).fontFamily;
      ctx.fillText("En attente de données…", 6, h / 2);
      return;
    }

    var max = -Infinity, min = Infinity;
    for (var i = 0; i < sparkData.length; i++) {
      if (sparkData[i] > max) max = sparkData[i];
      if (sparkData[i] < min) min = sparkData[i];
    }
    var range = (max - min) || 1;
    setText("spark-max", max);
    setText("spark-min", min);

    // baseline grid
    ctx.strokeStyle = "rgba(45, 53, 72, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var g = 0; g <= 3; g++) {
      var y = (h / 3) * g + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // area fill
    ctx.fillStyle = "rgba(94, 179, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var j = 0; j < sparkData.length; j++) {
      var x = (j / (SPARK_MAX - 1)) * w;
      var y2 = h - ((sparkData[j] - min) / range) * (h - 16) - 8;
      ctx.lineTo(x, y2);
    }
    ctx.lineTo(((sparkData.length - 1) / (SPARK_MAX - 1)) * w, h);
    ctx.closePath();
    ctx.fill();

    // stroke
    ctx.strokeStyle = "#5eb3ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var k = 0; k < sparkData.length; k++) {
      var x2 = (k / (SPARK_MAX - 1)) * w;
      var y3 = h - ((sparkData[k] - min) / range) * (h - 16) - 8;
      if (k === 0) ctx.moveTo(x2, y3); else ctx.lineTo(x2, y3);
    }
    ctx.stroke();

    // last-point dot
    var last = sparkData.length - 1;
    var lx = (last / (SPARK_MAX - 1)) * w;
    var ly = h - ((sparkData[last] - min) / range) * (h - 16) - 8;
    ctx.fillStyle = "#5eb3ff";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function setStatus(state, text) {
    var el = $("#status");
    el.classList.remove("is-error", "is-warn");
    if (state === "error") el.classList.add("is-error");
    if (state === "warn") el.classList.add("is-warn");
    $("#status-text").textContent = text;
  }

  function update(d) {
    if (!d || !d.latency_ms || d.count === 0) {
      setStatus("warn", "Aucune donnée pour l'instant — émettez quelques requêtes (par ex. visitez /osi).");
      return;
    }
    setText("p50", d.latency_ms.p50);
    setText("p90", d.latency_ms.p90);
    setText("p95", d.latency_ms.p95);
    setText("p99", d.latency_ms.p99);
    setText("rps", d.rps_last_60s);
    setText("count", d.count);
    setText("jitter", d.jitter_ms_avg_absdiff);

    var errPct = (d.error_rate * 100).toFixed(2);
    setText("err", errPct);
    var errCard = $("#err-card");
    errCard.classList.toggle("bad", d.error_rate > 0.05);
    errCard.classList.toggle("ok",  d.error_rate <= 0.05);

    var tb = (d.qos_policy && d.qos_policy.token_bucket) || {};
    setText("burst", tb.burst != null ? tb.burst : "—");
    setText("rate", tb.tokens_per_sec != null ? (tb.tokens_per_sec + " jetons/s") : "—");

    sparkData.push(d.latency_ms.p95);
    while (sparkData.length > SPARK_MAX) sparkData.shift();
    drawSpark();

    var ts = new Date().toLocaleTimeString();
    setStatus("ok", "Mise à jour " + ts + " — " + d.count + " échantillons");
  }

  function fetchOnce() {
    fetch("/metrics?format=json", { headers: { "Accept": "application/json" }, cache: "no-store" })
      .then(function (r) {
        if (r.status === 429) {
          var retry = r.headers.get("Retry-After") || "?";
          setStatus("error", "HTTP 429 — token bucket vide, retry dans " + retry + " s. (C'est exactement ce que la QoS est censée faire.)");
          return null;
        }
        if (!r.ok) {
          setStatus("error", "HTTP " + r.status);
          return null;
        }
        return r.json();
      })
      .then(function (d) { if (d) update(d); })
      .catch(function (e) { setStatus("error", "Erreur réseau : " + e.message); });
  }

  var timer = null;
  function start() { if (!timer) timer = setInterval(fetchOnce, 2000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  $("#autorefresh").addEventListener("change", function (e) {
    if (e.target.checked) start(); else stop();
  });
  $("#refresh-now").addEventListener("click", fetchOnce);
  window.addEventListener("resize", drawSpark);

  drawSpark();
  fetchOnce();
  start();
})();
