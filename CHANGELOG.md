# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- The day as an **arc from sunrise to sunset**, with hour marks computed from the same function the
  shadows use — so a position and a time cannot disagree.
- **Events as shadows**: a position on the arc and a length in minutes.
- **Dragging** a shadow changes when it starts and leaves the duration untouched.
- A shadow that would run past sunset is **clipped and marked**, not extended.
- Refusals: no name, no length, a zero length, an event outside the dial, a dial where the sun sets before
  it rises, dragging a shadow that is not there.
- An unreadable day is reported and offered for export, **never** replaced with an empty one — an empty
  dial looks like a clear day.
- A failed save says **NOT SAVED** and leaves the dial unchanged.
- PWA shell, CI (51 engine assertions + 17 in jsdom + page smoke), and the app-builder pipeline pinned to
  the canonical SHA for the EXE/APK/Linux release.

### Not built
- Real solar geometry. The arc is a window between two times, not a computed sunrise for a latitude.
