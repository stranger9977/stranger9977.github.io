/* Shared shelf renderer (homepage, /blog/, /tools/).
   Reads data/posts.json and builds the shelf. Everything a tile shows — its
   copy, its link, its cover theme, its badges — comes from the record. Adding
   post No. 004 with its own cover is a data-file edit; this file does not change.
   If the fetch fails, the static directory list above stays put. */
(function () {
  "use strict";

  /* Declarative: every [data-shelf] on the page is filled with the records whose
     `kind` matches its value ("all" takes everything). The paired heading is
     [data-shelf-head] with the same value. Works on any page at any depth. */
  var mounts   = document.querySelectorAll("[data-shelf]");
  var dateline = document.getElementById("dateline");
  var fallback = document.getElementById("fallback");
  if (!mounts.length) return;

  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c];
    });
  }
  /* parse as a local date: new Date("2026-08-02") is UTC midnight and can
     format as the day before, west of Greenwich */
  function parseDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtLong(d) {
    return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  /* month precision means the day is a placeholder — never print it */
  function fmtStamp(d, precision) {
    if (!d) return "";
    if (precision === "month") return MONTHS[d.getMonth()] + " " + d.getFullYear();
    return MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate() + ", " + d.getFullYear();
  }
  function daysSince(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - d) / 86400000);
  }
  function freshness(d) {
    var n = daysSince(d);
    if (n < 0)   return "";
    if (n === 0) return "updated today";
    if (n === 1) return "updated yesterday";
    if (n <= 30) return "updated " + n + "d ago";
    return "";
  }

  /* Cover theme → inline custom properties on the tile itself.
     vars_dark is an override set, merged over vars — not a complete theme. */
  function applyTheme(el, theme, dark) {
    if (!theme) return;
    var merged = {}, k;
    for (k in theme.vars) if (Object.prototype.hasOwnProperty.call(theme.vars, k)) merged[k] = theme.vars[k];
    if (dark && theme.vars_dark) {
      for (k in theme.vars_dark) if (Object.prototype.hasOwnProperty.call(theme.vars_dark, k)) merged[k] = theme.vars_dark[k];
    }
    for (k in merged) {
      if (Object.prototype.hasOwnProperty.call(merged, k) && k.indexOf("--tile-") === 0) {
        el.style.setProperty(k, merged[k]);
      }
    }
  }

  function buildTile(post, dark) {
    var a = document.createElement("a");
    a.className = "tile";
    /* fallback_href is only present while the record's new path has not shipped:
       point at the known-good path first, then upgrade if the new one answers */
    a.href = post.fallback_href || post.href || "#";
    if (post.fallback_href && post.href) {
      try {
        fetch(post.href, { method: "HEAD" })
          .then(function (r) { if (r && r.ok) a.href = post.href; })
          .catch(function () {});
      } catch (e) { /* no fetch: keep the fallback path */ }
    }
    if (post.title_long) a.title = post.title_long;
    applyTheme(a, post.tile_theme, dark);

    var d       = parseDate(post.updated);
    var stamp   = fmtStamp(d, post.updated_precision);
    var fresh   = (post.status === "live" && d) ? freshness(d) : "";
    var prefix  = post.tile_theme && post.tile_theme.prompt_prefix;
    var stat    = post.headline_stat || {};
    var tools   = (post.tools || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    a.innerHTML =
      '<span class="band" aria-hidden="true"></span>' +
      '<p class="kicker">' + esc(post.kicker) + '</p>' +
      '<h3 class="headline">' +
        (prefix ? '<span class="prompt">' + esc(prefix) + '</span>' : '') +
        esc(post.title) +
      '</h3>' +
      (post.dek ? '<p class="dek">' + esc(post.dek) + '</p>' : '') +
      '<p class="meta">' +
        (stamp ? '<span class="when">' + esc(stamp) + '</span>' : '') +
        (post.status ? ' <span class="flag" data-status="' + esc(post.status) + '">' + esc(post.status) + '</span>' : '') +
        (fresh ? ' <span class="fresh">' + esc(fresh) + '</span>' : '') +
      '</p>' +
      (stat.value ?
        '<div class="peek">' +
          '<span class="statval">' + esc(stat.value) + '</span>' +
          (stat.label ? '<span class="statlab">' + esc(stat.label) + '</span>' : '') +
          (tools ? '<ul class="tools">' + tools + '</ul>' : '') +
        '</div>' : '');
    return a;
  }

  function render(data) {
    var posts = (data && data.posts) || [];
    if (!posts.length) return;                       /* keep the static list */
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    /* newest first; same-date posts keep issue order */
    posts = posts.slice().sort(function (a, b) {
      return String(b.updated).localeCompare(String(a.updated)) ||
             String(a.number).localeCompare(String(b.number));
    });

    /* Split on `kind`. A record with no kind falls back to blog, so an older
       posts.json still renders rather than silently dropping a post. */
    function shelfFor(kind) { return posts.filter(function (p) {
      return (p.kind || "blog") === kind; }); }

    /* newest entry across a set, including the file's own generated stamp for
       the blog shelf, so the line is never blank on an empty set */
    function newestOf(set, withGenerated) {
      var n = null;
      set.concat(withGenerated ? [{ updated: data.generated }] : []).forEach(function (p) {
        var d = parseDate(p.updated);
        if (d && (!n || d > n)) n = d;
      });
      return n;
    }

    function fill(mount, head, dirname, set) {
      if (mount) {
        var frag = document.createDocumentFragment();
        set.forEach(function (p) { frag.appendChild(buildTile(p, dark)); });
        mount.innerHTML = "";
        mount.appendChild(frag);
      }
      var n = newestOf(set, false);
      if (head) {
        head.innerHTML =
          '<b>index of ' + esc(dirname) + '</b>' +
          '<span class="dim">&middot;</span><span>' + set.length +
            ' entr' + (set.length === 1 ? 'y' : 'ies') + '</span>' +
          (n ? '<span class="dim">&middot;</span><span class="dim">last updated ' +
            esc(isoOf(n)) + '</span>' : '');
      }
    }

    Array.prototype.forEach.call(mounts, function (mount) {
      var kind = mount.getAttribute("data-shelf");
      var head = document.querySelector('[data-shelf-head="' + kind + '"]');
      var dir  = mount.getAttribute("data-dirname") ||
                 (kind === "all" ? "/quests/" : "/" + kind + "s/");
      fill(mount, head, dir, kind === "all" ? posts : shelfFor(kind));
    });
    if (fallback) fallback.hidden = true;

    /* dateline: newest thing on the site, whichever shelf it sits on */
    var newest = newestOf(posts, true);
    if (dateline && newest) {
      var latest = posts.reduce(function (hi, p) {
        return (parseInt(p.number, 10) || 0) > (parseInt(hi.number, 10) || 0) ? p : hi;
      }, posts[0]);
      dateline.textContent = fmtLong(newest) +
        (latest && latest.number ? " · No. " + latest.number : "");
    }
    return posts;
  }

  fetch("/the-side-quest/data/posts.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      render(data);
      /* themes carry a dark-mode override set: repaint when the scheme flips */
      var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      if (!mq) return;
      var repaint = function () { render(data); };
      if (mq.addEventListener) mq.addEventListener("change", repaint);
      else if (mq.addListener) mq.addListener(repaint);
    })
    .catch(function () { /* static directory list stays visible */ });
})();
