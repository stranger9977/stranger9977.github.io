/* Interactive zoomable US county choropleth for the Lottery of Life page.
   Lazy: nothing loads until #usmap scrolls near the viewport. Then it pulls
   d3 + topojson-client + the us-atlas county geometry from a CDN, joins them
   to window.COUNTY_RATES (fips -> [players-per-million, players]) and renders
   an SVG map with pan/zoom, hover tooltips, and a legend. Theme-aware via CSS. */
(function () {
  "use strict";
  var HOST_ID = "usmap";
  var CAP = 750; // color scale tops out here; a few counties run higher
  var CDN = {
    d3: "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js",
    topojson: "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js",
    counties: "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"
  };
  var STATE = {
    "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California",
    "08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia",
    "12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois",
    "18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana",
    "23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota",
    "28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada",
    "33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York",
    "37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon",
    "42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota",
    "47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia",
    "53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming","72":"Puerto Rico"
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function hint(host, msg) {
    var h = host.querySelector(".usmap-hint");
    if (h) h.textContent = msg;
  }

  var booted = false;
  function boot(host) {
    if (booted) return; booted = true;
    hint(host, "Loading map…");
    Promise.all([loadScript(CDN.d3), loadScript(CDN.topojson)])
      .then(function () { return fetch(CDN.counties); })
      .then(function (r) { if (!r.ok) throw new Error("geojson " + r.status); return r.json(); })
      .then(function (us) { render(host, us); })
      .catch(function (e) { hint(host, "Map could not load. (" + (e && e.message || e) + ")"); });
  }

  function color(rate) {
    var n = Math.sqrt(Math.min(rate, CAP) / CAP); // sqrt: the distribution is skewed
    return window.d3.interpolateMagma(1 - n);      // 1-n so high rate = dark
  }

  function render(host, us) {
    var d3 = window.d3, topojson = window.topojson;
    var rates = window.COUNTY_RATES || {};
    var counties = topojson.feature(us, us.objects.counties).features;
    var stateMesh = topojson.mesh(us, us.objects.states, function (a, b) { return a !== b; });
    var nationMesh = topojson.mesh(us, us.objects.nation);
    var W = 975, H = 610;
    // us-atlas counties-10m is in lon/lat, so project with Albers USA (handles AK/HI insets)
    var path = d3.geoPath(d3.geoAlbersUsa().fitSize([W, H], { type: "FeatureCollection", features: counties }));

    host.innerHTML = "";
    var svg = d3.select(host).append("svg")
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("class", "usmap-svg")
      .attr("role", "img")
      .attr("aria-label", "Zoomable map of NFL players produced per million residents by US county");

    var g = svg.append("g");
    g.append("g").selectAll("path").data(counties).join("path")
      .attr("d", path)
      .attr("class", "county")
      .attr("fill", function (f) { var d = rates[f.id]; return d ? color(d[0]) : "var(--usmap-nodata)"; });
    g.append("path").datum(stateMesh).attr("d", path).attr("class", "usmap-states").attr("fill", "none");
    g.append("path").datum(nationMesh).attr("d", path).attr("class", "usmap-nation").attr("fill", "none");

    // tooltip
    var tip = d3.select(host).append("div").attr("class", "usmap-tip").style("opacity", 0);
    var hostEl = host;
    g.select("g").selectAll(".county")
      .on("mousemove", function (ev, f) {
        var d = rates[f.id];
        var name = (f.properties && f.properties.name) ? f.properties.name : "County";
        var st = STATE[String(f.id).slice(0, 2)] || "";
        var pl = (window.COUNTY_PLAYERS && window.COUNTY_PLAYERS[f.id]) || null;
        var plHtml = pl ? "<div class='usmap-tip-pl'><i>most notable</i>" +
          pl.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" : "";
        var head = "<b>" + name + (st ? ", " + st : "") + "</b>";
        var body = d
          ? head + "<br>" + Math.round(d[0]) + " per million" +
            (d[1] ? " · " + d[1] + " player" + (d[1] === 1 ? "" : "s") : "") + plHtml
          : head + "<br>no matched players";
        var rect = hostEl.getBoundingClientRect();
        var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        tip.html(body)
          .style("left", Math.min(x + 14, rect.width - 150) + "px")
          .style("top", (y + 14) + "px")
          .style("opacity", 1);
        d3.select(this).raise().classed("hot", true);
      })
      .on("mouseleave", function () { tip.style("opacity", 0); d3.select(this).classed("hot", false); });

    // zoom / pan
    var zoom = d3.zoom().scaleExtent([1, 10])
      .translateExtent([[0, 0], [W, H]])
      .on("zoom", function (ev) { g.attr("transform", ev.transform); });
    svg.call(zoom).on("dblclick.zoom", null);

    // controls (zoom buttons + reset)
    var ctl = d3.select(host).append("div").attr("class", "usmap-ctl");
    ctl.append("button").attr("type", "button").attr("aria-label", "Zoom in").text("+")
      .on("click", function () { svg.transition().duration(250).call(zoom.scaleBy, 1.6); });
    ctl.append("button").attr("type", "button").attr("aria-label", "Zoom out").text("−")
      .on("click", function () { svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6); });
    ctl.append("button").attr("type", "button").attr("aria-label", "Reset").text("↺")
      .on("click", function () { svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity); });

    buildLegend(host);
  }

  function buildLegend(host) {
    var wrap = document.createElement("div");
    wrap.className = "usmap-legend";
    var stops = [];
    for (var i = 0; i <= 10; i++) {
      var rate = (i / 10) * CAP;
      stops.push(color(rate) + " " + (i * 10) + "%");
    }
    var bar = document.createElement("div");
    bar.className = "usmap-legend-bar";
    bar.style.background = "linear-gradient(to right, " + stops.join(", ") + ")";
    var ticks = document.createElement("div");
    ticks.className = "usmap-legend-ticks";
    [0, 250, 500, "750+"].forEach(function (t) {
      var s = document.createElement("span"); s.textContent = t; ticks.appendChild(s);
    });
    var lab = document.createElement("div");
    lab.className = "usmap-legend-lab";
    lab.textContent = "NFL players per million residents";
    wrap.appendChild(lab); wrap.appendChild(bar); wrap.appendChild(ticks);
    host.appendChild(wrap);
  }

  function init() {
    var host = document.getElementById(HOST_ID);
    if (!host) return;
    if (!("IntersectionObserver" in window)) { boot(host); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); boot(host); } });
    }, { rootMargin: "300px" });
    io.observe(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
