/* app — the Sundial page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Wiring only: the arc, the hour marks and the shadows live in sundial-core.js. */
(function () {
  "use strict";
  var S = window.SundialCore;
  var $ = function (id) { return document.getElementById(id); };
  var K = "sundial:day";
  var state = { dial: S.makeDial({}).dial, day: { events: [] }, selected: null, unreadable: null };

  var els = {
    status: $("status"), marks: $("marks"), shadowLayer: $("shadowLayer"), dial: $("dial"),
    name: $("name"), mins: $("mins"), pos: $("pos"), posLabel: $("posLabel"), addBtn: $("addBtn"), addSays: $("addSays"),
    eventList: $("eventList"), moveWrap: $("moveWrap"), movePos: $("movePos"), moveName: $("moveName"), moveLabel: $("moveLabel"),
    exportBtn: $("exportBtn"), ioNote: $("ioNote")
  };

  function today() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function setStatus(k, m) { els.status.className = "status show " + k; els.status.textContent = m; }
  function node(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function clockOf(mins) { var m = Math.round(mins) % 1440; return (m < 600 ? "0" : "") + Math.floor(m / 60) + ":" + ((m % 60) < 10 ? "0" : "") + (m % 60); }

  function persist() {
    try { window.localStorage.setItem(K, S.serialize(state.day)); return true; }
    catch (e) { setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") + ". The dial on screen is unchanged."); return false; }
  }

  function render() {
    var d = state.dial;
    els.marks.textContent = "";
    var marks = S.hourMarks(d);
    marks.forEach(function (m) {
      var span = node("span", null, m.label);
      els.marks.appendChild(span);
    });
    els.shadowLayer.textContent = "";
    state.day.events.forEach(function (e) {
      var sh = S.shadow(d, e);
      var el = node("div", "shadow" + (state.selected === e.id ? " sel" : ""), e.name + " " + sh.starts + "\u2013" + sh.ends);
      el.style.left = (sh.from * 100) + "%";
      el.style.width = Math.max(4, (sh.to - sh.from) * 100) + "%";
      el.addEventListener("click", function () { state.selected = e.id; render(); });
      els.shadowLayer.appendChild(el);
    });

    els.eventList.textContent = "";
    if (!state.day.events.length) els.eventList.appendChild(node("li", null, "No shadow drawn yet."));
    state.day.events.forEach(function (e) {
      var li = node("li");
      li.appendChild(node("div", null, e.name + "  \u2014  " + clockOf(e.startMinutes) + " for " + e.minutes + " min"));
      li.appendChild(node("span", "meta", "shadow at " + Math.round(e.position * 100) + "% of the arc"));
      var b = node("button", "small", "Select");
      b.addEventListener("click", function () {
        state.selected = e.id;
        els.moveWrap.hidden = false;
        els.moveName.textContent = e.name;
        els.movePos.value = String(e.position);
        els.moveLabel.textContent = clockOf(e.startMinutes);
        render();
      });
      li.appendChild(b);
      els.eventList.appendChild(li);
    });

    els.posLabel.textContent = clockOf(S.timeAt(d, Number(els.pos.value)));
    if (state.selected) {
      var sel = state.day.events.filter(function (e) { return e.id === state.selected; })[0];
      if (sel) els.moveLabel.textContent = clockOf(sel.startMinutes);
    }
  }

  function add() {
    var out = S.addEvent(state.dial, state.day, { name: els.name.value, position: Number(els.pos.value), minutes: Number(els.mins.value) });
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.day = out.state;
    var saved = persist();
    els.name.value = "";
    render();
    els.addSays.textContent = out.says;
    if (saved) setStatus("ok", out.says);
  }

  function move() {
    if (!state.selected) { setStatus("bad", "Select a shadow first."); return; }
    var out = S.moveEvent(state.dial, state.day, { id: state.selected, position: Number(els.movePos.value) });
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.day = out.state;
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says);
  }

  function doExport() {
    var out = S.exportFile("day", { state: state.day }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime); return true;
    });
    if (out.ok) { els.ioNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  els.addBtn.addEventListener("click", add);
  els.movePos.addEventListener("input", move);
  els.pos.addEventListener("input", render);
  els.exportBtn.addEventListener("click", doExport);

  var raw = null;
  try { raw = window.localStorage.getItem(K); } catch (e) { raw = null; }
  if (raw) {
    var parsed = S.parseState(raw);
    if (parsed.ok) state.day = parsed.state;
    else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable day");
      keep.addEventListener("click", function () {
        var out = S.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime); return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.ioNote.parentNode.insertBefore(keep, els.ioNote);
    }
  }

  render();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
