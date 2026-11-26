/* sundial-core — the engine behind Sundial.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: a calendar you schedule by drawing shadows. The dial is an arc from sunrise to sunset; an
 * event is a shadow with a length; where the shadow falls on the arc IS its start time.
 *
 * The dial's hour marks are computed from the same arc, so a position and an hour can never disagree —
 * that is the spec's done-means, and it is one function, not two.
 *
 * Dragging a shadow changes when it starts and never how long it lasts: a duration is the length of the
 * shadow, and moving a shadow does not stretch it.
 *
 * Pure functions: no DOM, no network, no storage. No real astronomy: the arc is a simple day window.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SundialCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(mins) { var m = ((Math.round(mins) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

  var DEFAULT_DIAL = { sunrise: 6 * 60, sunset: 18 * 60 };

  function makeDial(input) {
    var sunrise = input && input.sunrise != null ? Number(input.sunrise) : DEFAULT_DIAL.sunrise;
    var sunset = input && input.sunset != null ? Number(input.sunset) : DEFAULT_DIAL.sunset;
    if (isNaN(sunrise) || isNaN(sunset)) return { ok: false, field: "sunrise", reason: "the dial needs two times" };
    if (sunset <= sunrise) return { ok: false, field: "sunset", reason: "the sun has to set after it rises" };
    return { ok: true, dial: { sunrise: sunrise, sunset: sunset, span: sunset - sunrise } };
  }

  /* position: 0 at sunrise, 1 at sunset. One function, used by the hour marks AND by the shadows, so they
   * cannot disagree. */
  function timeAt(dial, position) {
    var p = Math.min(1, Math.max(0, Number(position) || 0));
    return dial.sunrise + p * dial.span;
  }
  function positionOf(dial, minutes) {
    var m = Math.min(dial.sunset, Math.max(dial.sunrise, Number(minutes)));
    return (m - dial.sunrise) / dial.span;
  }

  /* The dial's own hour marks. */
  function hourMarks(dial) {
    var out = [];
    for (var h = Math.ceil(dial.sunrise / 60); h <= Math.floor(dial.sunset / 60); h++) {
      out.push({ hour: h, label: pad(h) + ":00", minutes: h * 60, position: positionOf(dial, h * 60) });
    }
    return out;
  }

  /* An event is a shadow: a start position on the arc and a length in minutes. */
  function addEvent(dial, state, input) {
    var name = clean(input && input.name);
    if (!name) return { ok: false, field: "name", reason: "an event with no name is refused" };
    var startMin = input && input.startMinutes != null ? Number(input.startMinutes) : timeAt(dial, input && input.position);
    if (isNaN(startMin)) return { ok: false, field: "position", reason: "a shadow needs a position on the dial" };
    var length = Number(input && input.minutes);
    if (isNaN(length) || length <= 0) return { ok: false, field: "minutes", reason: "an event needs a length, more than zero" };
    if (startMin < dial.sunrise || startMin > dial.sunset) return { ok: false, field: "startMinutes", reason: "an event has to fall inside the dial, between sunrise and sunset" };
    var s = clone(state);
    var e = {
      id: "s" + ((s.events || []).length + 1) + "-" + Math.round(startMin),
      name: name, startMinutes: Math.round(startMin), minutes: Math.round(length),
      position: positionOf(dial, startMin)
    };
    s.events.push(e);
    s.events.sort(function (a, b) { return a.startMinutes - b.startMinutes; });
    return { ok: true, state: s, event: e, says: name + " at " + hhmm(e.startMinutes) + " for " + e.minutes + " min." };
  }

  /* Dragging: a new position changes the start, and the duration is untouched. */
  function moveEvent(dial, state, input) {
    var s = clone(state);
    var id = clean(input && input.id);
    var idx = s.events.map(function (e) { return e.id; }).indexOf(id);
    if (idx < 0) return { ok: false, field: "id", reason: "there is no such shadow on the dial" };
    var pos = Number(input && input.position);
    if (isNaN(pos)) return { ok: false, field: "position", reason: "a drag needs a position" };
    var before = s.events[idx];
    var startMin = Math.round(timeAt(dial, pos));
    s.events[idx] = {
      id: before.id, name: before.name,
      startMinutes: startMin, minutes: before.minutes,          /* the length is carried over untouched */
      position: positionOf(dial, startMin)
    };
    s.events.sort(function (a, b) { return a.startMinutes - b.startMinutes; });
    return {
      ok: true, state: s, event: s.events.filter(function (e) { return e.id === before.id; })[0],
      movedFrom: before.startMinutes, durationUnchanged: true,
      says: before.name + " moved to " + hhmm(startMin) + " and still lasts " + before.minutes + " min."
    };
  }

  /* The shadow as a shape: where it starts, where it ends, and how long it is. */
  function shadow(dial, event) {
    var end = Math.min(dial.sunset, event.startMinutes + event.minutes);
    return {
      id: event.id, name: event.name,
      from: positionOf(dial, event.startMinutes), to: positionOf(dial, end),
      starts: hhmm(event.startMinutes), ends: hhmm(end), minutes: event.minutes,
      clipped: event.startMinutes + event.minutes > dial.sunset
    };
  }

  function clone(state) {
    var s = state || { events: [] };
    return { events: (s.events || []).map(function (e) { return { id: e.id, name: e.name, startMinutes: e.startMinutes, minutes: e.minutes, position: e.position }; }) };
  }

  function serialize(state) { return JSON.stringify({ version: VERSION, format: "sundial-1", state: clone(state) }, null, 2); }
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "the dial is empty on this device", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) { return { ok: false, unreadable: true, reason: "The saved dial cannot be read. It was NOT replaced with an empty one \u2014 an empty dial looks like a clear day. Export it to keep it.", raw: raw }; }
    if (!data || !data.state || !Array.isArray(data.state.events)) return { ok: false, unreadable: true, reason: "The saved file holds no dial. Nothing was started over it; export it to keep it.", raw: raw };
    return { ok: true, state: clone(data.state), raw: raw };
  }
  function stamp(when) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated"; }
  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "day") { name = "sundial-" + stamp(meta.when) + ".json"; body = serialize(payload.state); }
    else if (what === "raw") { name = "sundial-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return { version: VERSION, DEFAULT_DIAL: DEFAULT_DIAL, makeDial: makeDial, timeAt: timeAt, positionOf: positionOf,
    hourMarks: hourMarks, addEvent: addEvent, moveEvent: moveEvent, shadow: shadow,
    serialize: serialize, parseState: parseState, exportFile: exportFile };
});
