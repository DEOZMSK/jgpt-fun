import assert from "node:assert/strict";
import test from "node:test";
import { dashaOffsetLabel, formatDashaInstant } from "./astrology/dasha-display";

test("dasha display applies positive, negative and zero saved offsets across date boundaries", () => {
  assert.equal(formatDashaInstant("2000-01-01T22:30:45.987Z", 360), "2000-01-02 04:30:45");
  assert.equal(formatDashaInstant("2000-01-01T00:30:45.987Z", -300), "1999-12-31 19:30:45");
  assert.equal(formatDashaInstant("2000-01-01T00:30:45.987Z", 0), "2000-01-01 00:30:45");
  assert.equal(formatDashaInstant("2000-02-29T23:59:59.000Z", 345), "2000-03-01 05:44:59");
  assert.equal(dashaOffsetLabel(360), "UTC+06:00");
  assert.equal(dashaOffsetLabel(-300), "UTC−05:00");
  assert.equal(dashaOffsetLabel(345), "UTC+05:45");
  assert.equal(dashaOffsetLabel(0), "UTC");
});

test("the same birth offset applies in winter and summer without timezone reinterpretation", () => {
  assert.equal(formatDashaInstant("2000-01-01T12:00:00.000Z", -300), "2000-01-01 07:00:00");
  assert.equal(formatDashaInstant("2000-07-01T12:00:00.000Z", -300), "2000-07-01 07:00:00");
  // Historical saved offsets may include seconds; their label must not lose them.
  assert.equal(formatDashaInstant("1900-01-01T00:00:00.000Z", 9.35), "1900-01-01 00:09:21");
  assert.equal(dashaOffsetLabel(9.35), "UTC+00:09:21");
});

test("dasha display rejects a local timestamp and invalid offsets instead of using the device zone", () => {
  assert.throws(() => formatDashaInstant("2000-01-01T12:00:00", 0));
  assert.throws(() => formatDashaInstant("invalidZ", 0));
  for (const offset of [NaN, Infinity, 841, -841]) {
    assert.throws(() => formatDashaInstant("2000-01-01T12:00:00.000Z", offset));
    assert.throws(() => dashaOffsetLabel(offset));
  }
});
