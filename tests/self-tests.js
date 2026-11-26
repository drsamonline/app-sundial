#!/usr/bin/env node
/* self-tests — Sundial. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Done-means: a shadow at a known position back-solves to the time it represents; a quarter of the arc
 * further is proportionally later and agrees with the dial's hour marks; dragging changes the start and
 * leaves the duration unchanged; events survive a reload. */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var S = require(path.join(ROOT, "docs", "play", "sundial-core.js"));
var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(n, c, d) { if (c) { passed++; return; } failed.push(group + " :: " + n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var dial = S.makeDial({ sunrise: 6 * 60, sunset: 18 * 60 }).dial;   /* 06:00 – 18:00, 12 hours */

section("done means — a shadow at a known position back-solves to its time");
eq("the start of the arc is sunrise", S.timeAt(dial, 0), 360);
eq("half way is midday", S.timeAt(dial, 0.5), 720);
eq("the end of the arc is sunset", S.timeAt(dial, 1), 1080);
eq("a position back-solves from a time", S.positionOf(dial, 540), 0.25);
eq("and round-trips", S.timeAt(dial, S.positionOf(dial, 900)), 900);

section("done means — a quarter of the arc further is proportionally later, agreeing with the hour marks");
var a = S.timeAt(dial, 0.25), b = S.timeAt(dial, 0.5);
eq("a quarter further is three hours later", b - a, 180);
eq("at 09:00", a, 540);
eq("and 12:00", b, 720);
var marks = S.hourMarks(dial);
eq("thirteen hour marks from sunrise to sunset", marks.length, 13);
eq("the 12:00 mark sits at half the arc", marks.filter(function (m) { return m.hour === 12; })[0].position, 0.5);
eq("the 09:00 mark sits at a quarter", marks.filter(function (m) { return m.hour === 9; })[0].position, 0.25);
ok("every mark's position matches timeAt exactly", marks.every(function (m) { return Math.abs(S.timeAt(dial, m.position) - m.minutes) < 0.001; }));

section("done means — dragging changes the start and leaves the duration unchanged");
var made = S.addEvent(dial, { events: [] }, { name: "standup", position: 0.25, minutes: 30 });
eq("the event is drawn", made.ok, true);
eq("at 09:00", made.event.startMinutes, 540);
var moved = S.moveEvent(dial, made.state, { id: made.event.id, position: 0.5 });
eq("it moves to 12:00", moved.event.startMinutes, 720);
eq("and still lasts 30 minutes", moved.event.minutes, 30);
eq("the app says the duration is unchanged", moved.durationUnchanged, true);
ok("and says so in words", /still lasts 30 min/.test(moved.says), moved.says);
var again = S.moveEvent(dial, moved.state, { id: moved.event.id, position: 0.75 });
eq("moving twice still keeps the duration", again.event.minutes, 30);
eq("and lands at 15:00", again.event.startMinutes, 900);

section("the shadow is a shape with a start and an end");
var sh = S.shadow(dial, moved.event);
eq("it starts at 12:00", sh.starts, "12:00");
eq("and ends at 12:30", sh.ends, "12:30");
ok("its from and to are on the arc", sh.from >= 0 && sh.to <= 1 && sh.to > sh.from);
var late = S.addEvent(dial, { events: [] }, { name: "late", position: 0.99, minutes: 120 });
ok("a shadow running past sunset is clipped, not extended", S.shadow(dial, late.event).clipped === true);

section("done means — events survive a reload with the network off");
var two = S.addEvent(dial, made.state, { name: "review", position: 0.6, minutes: 45 }).state;
var back = S.parseState(S.serialize(two));
eq("both events come back", back.state.events.length, 2);
eq("with their times", back.state.events[0].startMinutes, 540);
eq("and their lengths", back.state.events[1].minutes, 45);
ok("no network code anywhere", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(read("docs/play/sundial-core.js") + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("bad input");
eq("an event with no name is refused", S.addEvent(dial, { events: [] }, { position: 0.5, minutes: 30 }).field, "name");
eq("an event with no length is refused", S.addEvent(dial, { events: [] }, { name: "x", position: 0.5 }).field, "minutes");
eq("a zero length is refused", S.addEvent(dial, { events: [] }, { name: "x", position: 0.5, minutes: 0 }).field, "minutes");
eq("an event outside the dial is refused", S.addEvent(dial, { events: [] }, { name: "x", startMinutes: 100, minutes: 30 }).field, "startMinutes");
eq("a dial where the sun sets before it rises is refused", S.makeDial({ sunrise: 1080, sunset: 360 }).field, "sunset");
eq("dragging a shadow that is not there is refused", S.moveEvent(dial, { events: [] }, { id: "nope", position: 0.5 }).field, "id");

section("must-not — it must not grow a second job");
var core = read("docs/play/sundial-core.js");
ok("no tags, folders, reminders or search", !/\b(tags|labels|folders|reminder|search)\s*[:=]/i.test(core));
ok("no second store", (core.match(/localStorage/g) || []).length === 0);

section("storage");
var bad = S.parseState("{ broken dial");
eq("a broken dial is reported", bad.ok, false);
eq("it is marked unreadable", bad.unreadable, true);
ok("it was not replaced with an empty one", /NOT replaced with an empty one/.test(bad.reason), bad.reason);
ok("and says why an empty dial is worse", /looks like a clear day/.test(bad.reason), bad.reason);
eq("an empty dial on a fresh device is distinguished", S.parseState("").empty, true);
var thrown = S.exportFile("day", { state: two }, { when: "26/11/2026" }, function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; });
eq("a failed write is reported", thrown.ok, false);
ok("the export is dated", /sundial-2026-11-26\.json/.test(S.exportFile("day", { state: two }, { when: "26/11/2026" }, function () { return true; }).filename));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (x) { ok("script src resolves: " + x, fs.existsSync(path.join(ROOT, "docs", "play", x.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));
ok("the web manifest exists", fs.existsSync(path.join(ROOT, "docs", "play", "manifest.webmanifest")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("self-tests: " + passed + "/" + total + " assertions passed");
