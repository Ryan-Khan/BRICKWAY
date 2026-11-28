const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.BRICKWAY_HTML || path.join(__dirname, 'index.html'), 'utf8');
function inlineCore(id, name) {
  const source = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
  assert.ok(source, id + ' is included in the game');
  return vm.runInNewContext(source[1] + '\n' + name);
}

const show = inlineCore('show-core', 'ShowCore');
const rumble = inlineCore('rumble-core', 'RumbleCore');

test('the finish car slows before accelerating away, and the pass-by fills the final shot', () => {
  const { seconds, holdAt } = show.FINISH;
  assert.equal(seconds, 6.2);
  assert.equal(show.finishSpeedFactor(0), 1);
  assert.ok(show.finishSpeedFactor(holdAt) < 0.4);
  assert.ok(show.finishSpeedFactor(1) > 2);
  assert.equal(show.finishDistance(0, 80), 0);
  assert.ok(show.finishDistance(1, 80) > show.finishDistance(0.9, 80));
  assert.equal(show.finishZoom(holdAt), 0);
  assert.equal(show.finishZoom(1), 1);
  assert.ok(show.passWindow().start > 1);
  assert.equal(show.passWindow().end, seconds);
  const curve = show.passCurve(48);
  assert.ok(curve[0].ratio > curve[24].ratio && curve[24].ratio > curve[48].ratio);
  assert.ok(curve[0].pan < 0 && curve[48].pan > 0);
  assert.ok(curve[24].gain > curve[0].gain);
  assert.equal(curve[48].gain, 0);
});

test('all four wheels leave, seat, then show the release signal within the pit clock', () => {
  assert.equal(show.PIT.seconds, 3);
  assert.ok(show.jackLift(0.7) > 0.35);
  assert.equal(show.jackLift(show.PIT.lamp[0] + 0.1), 0);
  for (let corner = 0; corner < 4; corner++) {
    const removed = show.removeAt(corner);
    const fitted = show.installAt(corner) + show.PIT.installSpan;
    assert.ok(fitted < show.PIT.lamp[0]);
    assert.equal(show.carWheelHidden(removed - 0.01, corner), false);
    assert.equal(show.carWheelHidden(removed + 0.01, corner), true);
    assert.ok(show.oldWheelPose(removed + 0.3, corner, 0.38).x > 4.23);
    assert.equal(show.carWheelHidden(fitted, corner), false);
    assert.equal(show.newWheelPose(fitted, corner, 0.38).visible, false);
  }
});

test('F1 braking responds to pedal position, tyre grip and corner load without adding speed', () => {
  const stop = (demand, grip, cornerTraction) => show.brakeSpeed(86, 80, 0.05, demand, grip, cornerTraction);
  assert.ok(stop(1, 1, 1) < stop(0.5, 1, 1));
  assert.ok(stop(1, 1, 1) < stop(1, 0.6, 1));
  assert.ok(stop(1, 1, 1) < stop(1, 1, 0));
  assert.equal(show.brakeSpeed(3, 0, 0.05, 1, 1, 1), 0);
  assert.equal(show.brakeSpeed(-2, -4, 0.05, 1, 1, 1), -4);
});

test('rumble falls back to legacy pulses, then retries the preferred output after cooldown', async () => {
  const standard = { id: 'standard', mapping: 'standard', buttons: [{}] };
  const generic = { id: 'generic', mapping: '', buttons: [{}] };
  assert.equal(rumble.pickDrivingPad([generic, standard], null, pad => pad.id).pad, standard);
  assert.equal(rumble.pickDrivingPad([generic, standard], 'generic', pad => pad.id).pad, generic);
  const player = {
    vibrationActuator: { effects: ['trigger-rumble'], playEffect() {} },
    hapticActuators: [{ pulse() {} }],
  };
  const channel = rumble.createChannel();
  const effects = rumble.hapticOutputs(player);
  const seen = [];
  const send = ({ type }) => {
    seen.push(type);
    return type === 'pulse';
  };
  for (let now = 0; now < 3; now++) assert.equal(await rumble.deliver(effects, channel, now, send), 'sent');
  assert.deepEqual(seen, ['trigger-rumble', 'dual-rumble', 'pulse', 'trigger-rumble', 'dual-rumble', 'pulse', 'pulse']);
  seen.length = 0;
  await rumble.deliver(effects, channel, rumble.COOLDOWN_MS + 1, send);
  assert.deepEqual(seen, ['trigger-rumble', 'dual-rumble', 'pulse']);
});
