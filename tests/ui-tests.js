#!/usr/bin/env node
/* ui-tests — the Sundial page in a real DOM (jsdom). SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin */
"use strict";
var fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
var ROOT = path.join(__dirname, ".."), PLAY = path.join(ROOT, "docs", "play");
var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function build(seed) {
  var dom = new JSDOM(fs.readFileSync(path.join(PLAY, "index.html"), "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "sundial-core.js", "app.js"].forEach(function (f) { w.eval(fs.readFileSync(path.join(PLAY, f), "utf8")); });
  return dom;
}
var dom = build(null), w = dom.window, d = w.document, $ = function (id) { return d.getElementById(id); };
ok("the engine loaded", !!w.SundialCore);
eq("thirteen hour marks are drawn", d.querySelectorAll("#marks span").length, 13);

$("pos").value = "0.25"; $("pos").dispatchEvent(new w.Event("input"));
eq("the position label reads 09:00", $("posLabel").textContent, "09:00");

$("name").value = "standup"; $("mins").value = "30"; $("addBtn").click();
ok("a shadow is drawn", /standup at 09:00 for 30 min/.test($("status").textContent), $("status").textContent);
eq("one shadow on the dial", d.querySelectorAll("#shadowLayer .shadow").length, 1);
eq("one event listed", d.querySelectorAll("#eventList li").length, 1);

d.querySelector("#eventList button").click();
eq("selecting shows the drag control", $("moveWrap").hidden, false);
$("movePos").value = "0.5"; $("movePos").dispatchEvent(new w.Event("input"));
ok("the drag moves it to 12:00", /moved to 12:00/.test($("status").textContent), $("status").textContent);
ok("and keeps the duration", /still lasts 30 min/.test($("status").textContent));
ok("the list shows the new time", /12:00 for 30 min/.test($("eventList").textContent), $("eventList").textContent);

$("name").value = ""; $("addBtn").click();
ok("an event with no name is refused", /no name/.test($("status").textContent), $("status").textContent);

$("exportBtn").click();
ok("the day exports", /Wrote sundial-\d{4}-\d\d-\d\d\.json/.test($("ioNote").textContent), $("ioNote").textContent);
var saved = w.localStorage.getItem("sundial:day");
var dom2 = build({ "sundial:day": saved });
var d2 = dom2.window.document;
eq("the reload keeps the shadow", d2.querySelectorAll("#shadowLayer .shadow").length, 1);
ok("at its new time", /12:00 for 30 min/.test(d2.getElementById("eventList").textContent));

var dom3 = build({ "sundial:day": "{ broken dial" });
var d3 = dom3.window.document;
ok("a broken dial is reported", /cannot be read/.test(d3.getElementById("status").textContent));
ok("and not replaced with an empty one", /NOT replaced with an empty one/.test(d3.getElementById("status").textContent));

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} }; } });
d4.getElementById("name").value = "x"; d4.getElementById("addBtn").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
