// Tests for the F1Core race logic shipped inside the game HTML.
// Run from the project folder with:  node --test tests/
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GAME_FILE = process.env.BRICKWAY_HTML ||
  path.join(__dirname, 'index.html');

function loadF1Core() {
  const html = fs.readFileSync(GAME_FILE, 'utf8');
  const m = html.match(/<script id="f1-core">([\s\S]*?)<\/script>/);
  assert.ok(m, 'F1Core block <script id="f1-core"> must exist in the game file');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  return vm.runInContext('F1Core', ctx);
}

const F = loadF1Core();
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);
// Values created inside the vm sandbox come from another realm, so normalise before comparing.
const deq = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));

describe('difficulty and points', () => {
  test('legend preset keeps the original tuning values', () => {
    const d = F.difficultyFor('legend');
    assert.equal(d.paceMult, 1.30);
    assert.equal(d.gripAdd, 0.055);
    assert.equal(d.rubberMult, 1.55);
  });
  test('unknown difficulty falls back to pro', () => {
    assert.equal(F.difficultyFor('nope').key, 'pro');
  });
  test('easy is slower than pro is slower than legend', () => {
    assert.ok(F.difficultyFor('easy').paceMult < F.difficultyFor('pro').paceMult);
    assert.ok(F.difficultyFor('pro').paceMult < F.difficultyFor('legend').paceMult);
  });
  test('points follow the 25-18-15-12-10-8-6-4-2-1 table', () => {
    deq(F.POINTS, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
    assert.equal(F.pointsFor(1), 25);
    assert.equal(F.pointsFor(10), 1);
    assert.equal(F.pointsFor(11), 0);
    assert.equal(F.pointsFor(0), 0);
  });
});

describe('formatting', () => {
  test('lap times render as M:SS.mmm', () => {
    assert.equal(F.formatLapTime(83.4567), '1:23.457');
    assert.equal(F.formatLapTime(5), '0:05.000');
  });
  test('rounding never produces 60.000 seconds', () => {
    assert.equal(F.formatLapTime(59.9996), '1:00.000');
    assert.equal(F.formatLapTime(119.9996), '2:00.000');
  });
  test('invalid times render as placeholders', () => {
    assert.equal(F.formatLapTime(NaN), '--:--.---');
    assert.equal(F.formatLapTime(-1), '--:--.---');
    assert.equal(F.formatLapTime(Infinity), '--:--.---');
  });
  test('gaps show LEADER at zero and a signed interval otherwise', () => {
    assert.equal(F.formatGap(0), 'LEADER');
    assert.equal(F.formatGap(1.5), '+1.500');
    assert.equal(F.formatGap(NaN), '—');
  });
});

describe('ranking and timing', () => {
  const racers = [
    { id: 'p', name: 'YOU', progress: 2.4, finished: false, finishTime: 0 },
    { id: 'a', name: 'A', progress: 2.9, finished: false, finishTime: 0 },
    { id: 'b', name: 'B', progress: 2.1, finished: false, finishTime: 0 },
  ];
  test('unfinished cars rank by progress, highest first', () => {
    deq(F.rankRacers(racers).map((r) => r.id), ['a', 'p', 'b']);
  });
  test('finished cars rank above unfinished and by finish time', () => {
    const list = [
      { id: 'x', progress: 3, finished: true, finishTime: 200 },
      { id: 'y', progress: 3, finished: true, finishTime: 190 },
      { id: 'z', progress: 3.5, finished: false, finishTime: 0 },
    ];
    deq(F.rankRacers(list).map((r) => r.id), ['y', 'x', 'z']);
  });
  test('ranking does not mutate its input', () => {
    const copy = JSON.stringify(racers);
    F.rankRacers(racers);
    assert.equal(JSON.stringify(racers), copy);
  });
  test('timing table gives positions, gap to leader and interval to car ahead', () => {
    const table = F.timingTable(F.rankRacers(racers), 80);
    deq(table.map((r) => r.position), [1, 2, 3]);
    assert.equal(table[0].gapToLeader, 0);
    near(table[1].gapToLeader, 0.5 * 80);
    near(table[2].gapToLeader, 0.8 * 80);
    near(table[2].gapToAhead, 0.3 * 80);
  });
  test('gap between two finished cars uses finish times', () => {
    const a = { progress: 3, finished: true, finishTime: 200 };
    const b = { progress: 3, finished: true, finishTime: 203.5 };
    near(F.timeBetween(a, b, 80), 3.5);
  });
  test('gap falls back to 80s reference when the reference lap is missing', () => {
    const a = { progress: 1.0, finished: false };
    const b = { progress: 0.5, finished: false };
    near(F.timeBetween(a, b, undefined), 40);
  });
});

describe('DRS and slipstream', () => {
  test('straight detection finds long low-sharpness runs', () => {
    const s = [];
    for (let i = 0; i < 100; i++) s.push(i >= 10 && i < 40 ? 0.001 : 0.5);
    const zones = F.detectStraights(s, 0.01, 0.1);
    assert.equal(zones.length, 1);
    near(zones[0][0], 0.10);
    near(zones[0][1], 0.39);
  });
  test('short runs below the minimum fraction are ignored', () => {
    const s = new Array(100).fill(0.5);
    s[5] = s[6] = 0;
    deq(F.detectStraights(s, 0.01, 0.1), []);
  });
  test('zone lookup handles wrap-around past the start line', () => {
    const zones = [[0.9, 0.1]];
    assert.equal(F.inZones(0.95, zones), true);
    assert.equal(F.inZones(0.05, zones), true);
    assert.equal(F.inZones(0.5, zones), false);
  });
  test('DRS needs a zone, lap 2+, and a gap under one second', () => {
    assert.equal(F.drsOpen({ inZone: true, lap: 2, gapAheadSec: 0.6 }), true);
    assert.equal(F.drsOpen({ inZone: false, lap: 2, gapAheadSec: 0.6 }), false);
    assert.equal(F.drsOpen({ inZone: true, lap: 1, gapAheadSec: 0.6 }), false);
    assert.equal(F.drsOpen({ inZone: true, lap: 2, gapAheadSec: 1.2 }), false);
    assert.equal(F.drsOpen({ inZone: true, lap: 2, gapAheadSec: -1 }), false);
  });
  test('slipstream scales with closeness and is off beyond the window', () => {
    assert.equal(F.slipstreamPowerMult(2), 1);
    near(F.slipstreamPowerMult(0), 1 + F.SLIPSTREAM.maxBonus);
    assert.ok(F.slipstreamPowerMult(0.2) > F.slipstreamPowerMult(0.6));
    assert.equal(F.slipstreamPowerMult(NaN), 1);
  });
});

describe('tyres and pit stops', () => {
  test('wear accumulates per lap and clamps at 1', () => {
    near(F.applyLapWear(0, 'medium'), 0.077);
    near(F.applyLapWear(0.9, 'soft'), 1);
  });
  test('softs wear faster than mediums, mediums faster than hards', () => {
    assert.ok(F.TYRES.soft.wearPerLap > F.TYRES.medium.wearPerLap);
    assert.ok(F.TYRES.medium.wearPerLap > F.TYRES.hard.wearPerLap);
  });
  test('power drops as tyres wear out', () => {
    assert.ok(F.tyrePowerMult('medium', 0.8) < F.tyrePowerMult('medium', 0));
  });
  test('compound cycles soft -> medium -> hard -> soft', () => {
    assert.equal(F.nextCompound('soft'), 'medium');
    assert.equal(F.nextCompound('medium'), 'hard');
    assert.equal(F.nextCompound('hard'), 'soft');
  });
  test('pit zone is the stretch before the start line only', () => {
    assert.equal(F.inPitZone(0.95), true);
    assert.equal(F.inPitZone(0.5), false);
    assert.equal(F.inPitZone(0.01), false);
  });
  test('a pit stop resets wear, changes compound and costs time', () => {
    const tyre = { compound: 'soft', wear: 0.7, stops: 0, temperature: 111, surface: 'damp' };
    const lost = F.performPitStop(tyre);
    assert.equal(tyre.compound, 'medium');
    assert.equal(tyre.wear, 0);
    assert.equal(tyre.stops, 1);
    assert.equal(tyre.temperature, F.freshTyreTemperature('medium'));
    assert.equal(tyre.surface, 'damp');
    assert.equal(lost, F.PIT.stopSec);
  });
});

describe('penalties', () => {
  test('light impacts are ignored', () => {
    const st = {};
    assert.equal(F.registerBarrierHit(st, 10, 1), null);
    assert.equal(st.warnings, undefined);
  });
  test('heavy impacts add warnings, and every third one adds a penalty', () => {
    const st = {};
    assert.equal(F.registerBarrierHit(st, 60, 0), 'warning');
    assert.equal(F.registerBarrierHit(st, 60, 10), 'warning');
    assert.equal(F.registerBarrierHit(st, 60, 20), 'penalty');
    assert.equal(st.penaltySec, F.PENALTY.penaltySec);
    assert.equal(st.penalties, 1);
  });
  test('hits inside the cooldown are not double counted', () => {
    const st = {};
    F.registerBarrierHit(st, 60, 5);
    assert.equal(F.registerBarrierHit(st, 60, 5.5), null);
    assert.equal(st.warnings, 1);
  });
});

describe('start lights', () => {
  test('lights come on one at a time, then GO', () => {
    assert.equal(F.startLights(0).lit, 0);
    assert.equal(F.startLights(0.6).lit, 1);
    assert.equal(F.startLights(2.5).lit, 4);
    assert.equal(F.startLights(3.0).lit, 5);
    assert.equal(F.startLights(3.0).go, false);
    assert.equal(F.startLights(3.2).go, true);
  });
  test('negative elapsed time is treated as zero', () => {
    assert.equal(F.startLights(-5).lit, 0);
  });
});

describe('lap and sector timing', () => {
  test('completing a lap records its time and best lap', () => {
    const t = F.createLapTimer();
    F.startLap(t, 0);
    const a = F.finishLap(t, 85);
    assert.equal(a.lapNumber, 1);
    near(a.time, 85);
    assert.equal(a.isBest, true);
    F.startLap(t, 85);
    const b = F.finishLap(t, 85 + 90);
    assert.equal(b.isBest, false);
    near(t.bestLap, 85);
  });
  test('sector splits are recorded when u crosses a sector boundary', () => {
    const t = F.createLapTimer();
    F.startLap(t, 0);
    assert.equal(F.markSector(t, 0.1, 10), null);
    const s = F.markSector(t, 0.4, 30);
    assert.equal(s.sector, 0);
    near(s.time, 30);
    assert.equal(s.isBest, true);
    assert.equal(F.sectorIndexOf(0.99), 2);
  });
  test('a sector time only becomes best when it beats the previous best', () => {
    const t = F.createLapTimer();
    F.startLap(t, 0);
    F.markSector(t, 0.4, 30);
    F.markSector(t, 0.7, 60);
    F.finishLap(t, 90);
    F.startLap(t, 90);
    F.markSector(t, 0.4, 120);
    const slow = F.markSector(t, 0.7, 150);
    assert.equal(slow.isBest, false);
  });
  test('current lap time is zero before the first lap starts', () => {
    assert.equal(F.currentLapTime(F.createLapTimer(), 50), 0);
  });
});

describe('ghost car', () => {
  test('recorder samples at the configured rate', () => {
    const rec = F.createGhostRecorder(10);
    for (let i = 0; i < 30; i++) F.recordGhostSample(rec, 1 / 60, i / 60, i, i, 0);
    assert.ok(rec.frames.length >= 4 && rec.frames.length <= 6, `got ${rec.frames.length}`);
  });
  test('playback interpolates between frames', () => {
    const frames = [{ t: 0, x: 0, z: 0, yaw: 0 }, { t: 1, x: 10, z: 20, yaw: 1 }];
    const f = F.ghostFrameAt(frames, 0.5);
    near(f.x, 5); near(f.z, 10); near(f.yaw, 0.5);
  });
  test('playback clamps before the start and after the end', () => {
    const frames = [{ t: 1, x: 1, z: 1, yaw: 0 }, { t: 2, x: 2, z: 2, yaw: 0 }];
    assert.equal(F.ghostFrameAt(frames, 0).x, 1);
    assert.equal(F.ghostFrameAt(frames, 9).x, 2);
  });
  test('no frames means no ghost', () => {
    assert.equal(F.ghostFrameAt([], 1), null);
  });
  test('yaw interpolation takes the short way round', () => {
    const frames = [{ t: 0, x: 0, z: 0, yaw: Math.PI - 0.1 }, { t: 1, x: 0, z: 0, yaw: -Math.PI + 0.1 }];
    const f = F.ghostFrameAt(frames, 0.5);
    near(Math.abs(f.yaw), Math.PI, 1e-6);
  });
});

describe('qualifying and grid', () => {
  test('faster qualifying times start further forward', () => {
    const g = F.planGrid([
      { id: 'a', qualiTime: 82 },
      { id: 'b', qualiTime: 79 },
      { id: 'c', qualiTime: 80 },
    ]);
    deq(g.map((e) => e.id), ['b', 'c', 'a']);
    deq(g.map((e) => e.grid), [1, 2, 3]);
  });
  test('missing times go to the back in their input order', () => {
    const g = F.planGrid([
      { id: 'x', qualiTime: undefined },
      { id: 'y', qualiTime: 90 },
      { id: 'z', qualiTime: undefined },
    ]);
    deq(g.map((e) => e.id), ['y', 'x', 'z']);
  });
  test('bot quali time is fastest for the quickest pace', () => {
    assert.equal(F.botQualiTime(126, 126, 80), 80);
    assert.ok(F.botQualiTime(116, 126, 80) > 80);
  });
});

describe('championship', () => {
  const drivers = [{ id: 'p', name: 'YOU' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  test('a new season starts with zero points and no rounds run', () => {
    const s = F.createSeason(5, drivers);
    assert.equal(s.round, 0);
    assert.equal(s.totals.p, 0);
  });
  test('scoring a round awards points by finishing position', () => {
    const s = F.scoreRound(F.createSeason(5, drivers), ['p', 'a', 'b'], null);
    assert.equal(s.totals.p, 25);
    assert.equal(s.totals.a, 18);
    assert.equal(s.totals.b, 15);
    assert.equal(s.round, 1);
  });
  test('fastest lap adds a bonus point only inside the top ten', () => {
    const s = F.scoreRound(F.createSeason(5, drivers), ['a', 'p', 'b'], 'b');
    assert.equal(s.totals.b, 15 + F.FASTEST_LAP_BONUS);
  });
  test('fastest lap bonus is not awarded to a car outside the top ten or not classified', () => {
    const s = F.scoreRound(F.createSeason(5, drivers), ['p', 'a', 'b'], 'ghost');
    assert.equal(s.totals.ghost, undefined);
  });
  test('scoring stops once the season is complete', () => {
    let s = F.createSeason(1, drivers);
    s = F.scoreRound(s, ['p', 'a', 'b'], null);
    assert.equal(F.isSeasonComplete(s), true);
    const before = JSON.stringify(s.totals);
    F.scoreRound(s, ['b', 'a', 'p'], null);
    assert.equal(JSON.stringify(s.totals), before);
  });
  test('standings sort by points then name', () => {
    let s = F.createSeason(3, drivers);
    s = F.scoreRound(s, ['a', 'b', 'p'], null);
    deq(F.seasonStandings(s).map((d) => d.id), ['a', 'b', 'p']);
  });
  test('season round-trips through JSON and rejects junk', () => {
    const s = F.scoreRound(F.createSeason(5, drivers), ['p', 'a', 'b'], null);
    const back = F.parseSeason(F.serializeSeason(s));
    deq(back.totals, s.totals);
    assert.equal(F.parseSeason('not json'), null);
    assert.equal(F.parseSeason('{"foo":1}'), null);
  });
});

describe('rival profiles and energy recovery', () => {
  test('gives Hamilton the most powerful car, Verstappen the most corner speed and Leclerc the longest defence', () => {
    const [hamilton, verstappen, leclerc] = F.drivers;
    assert.equal(hamilton.number, 44);
    assert.equal(verstappen.number, 1);
    assert.equal(leclerc.number, 16);
    assert.equal(Math.max(...F.drivers.map(driver => driver.power)), hamilton.power);
    assert.equal(Math.max(...F.drivers.map(driver => driver.corner)), verstappen.corner);
    assert.equal(Math.max(...F.drivers.map(driver => driver.defence)), leclerc.defence);
    assert.ok(verstappen.power > leclerc.power);
    assert.ok(hamilton.wear < verstappen.wear);
  });

  test('drains boost under deployment, regenerates under braking and clamps at both limits', () => {
    const deploy = F.energyStep(.5, 1, true, false);
    const regen = F.energyStep(.5, 1, false, true);
    assert.ok(deploy < .5);
    assert.ok(regen > F.energyStep(.5, 1, false, false));
    assert.equal(F.energyStep(.01, 1, true, false), 0);
    assert.equal(F.energyStep(.99, 1, false, true), 1);
  });
});

describe('Formula Sim handling', () => {
  test('shares longitudinal and lateral grip while preserving full grip at zero demand', () => {
    assert.equal(F.tractionShare(0), 1);
    assert.ok(F.tractionShare(.4) > F.tractionShare(.8));
    assert.ok(F.tractionShare(1) > 0);
    assert.equal(F.tractionShare(2), F.tractionShare(1));
  });

  test('slick compound grip changes launch, braking and cornering in the dry', () => {
    const [soft, medium, hard] = ['soft','medium','hard'].map(compound=>({compound,surface:'dry',wear:0}));
    const launch = tyre=>F.drive(0,160,.05,tyre);
    const stop = tyre=>F.drive(100,0,.05,tyre);
    const corner = tyre=>F.yawRate(100,1,tyre);
    assert.ok(launch(soft)>launch(medium)&&launch(medium)>launch(hard));
    assert.ok(stop(soft)<stop(medium)&&stop(medium)<stop(hard));
    assert.ok(corner(soft)>corner(medium)&&corner(medium)>corner(hard));
    assert.ok(launch(soft)>launch(hard)*1.15);
    assert.ok(F.grip({...soft,wear:.65})<F.grip({...hard,wear:.25}));
  });

  test('intermediates lead in damp conditions and full wets lead in heavy rain', () => {
    for (const [surface,best] of [['dry','soft'],['damp','intermediate'],['wet','wet']]) {
      const tyres=Object.keys(F.TYRES).map(compound=>({compound,surface,wear:0}));
      assert.equal(tyres.sort((a,b)=>F.grip(b)-F.grip(a))[0].compound,best);
    }
    const wet={compound:'wet',surface:'wet',wear:0};
    const slick={compound:'soft',surface:'wet',wear:0};
    assert.ok(F.drive(0,110,.05,wet)>F.drive(0,110,.05,slick));
    assert.ok(F.drive(90,0,.05,wet)<F.drive(90,0,.05,slick));
    assert.ok(F.tyreWearRate('wet',6,'dry')>2*F.tyreWearRate('wet',6,'wet'));
    assert.ok(F.tyreWearRate('intermediate',6,'dry')>F.tyreWearRate('intermediate',6,'damp'));
  });

  test('softs warm up more quickly than hards under the same load', () => {
    const soft={compound:'soft',surface:'dry'};
    const hard={compound:'hard',surface:'dry'};
    const warmup=tyre=>F.updateTyreTemperature(tyre,2,120,.45,.1,1)-F.freshTyreTemperature(tyre.compound);
    assert.ok(warmup(soft)>warmup(hard));
  });

  test('warms loaded tyres, cools parked tyres, and rewards the compound window', () => {
    const tyre = {compound:'medium', surface:'dry', wear:0, temperature:F.freshTyreTemperature('medium')};
    const coldGrip = F.grip(tyre);
    for(let i=0;i<100;i++) F.updateTyreTemperature(tyre,.05,135,.50,.10,1);
    assert.ok(F.grip(tyre)>coldGrip);
    const warm=tyre.temperature;
    for(let i=0;i<100;i++) F.updateTyreTemperature(tyre,.05,0,0,0,0);
    assert.ok(tyre.temperature<warm);
    assert.ok(F.grip({...tyre,temperature:90})>F.grip({...tyre,temperature:124}));
    assert.ok(F.tyreWindow('wet')<F.tyreWindow('medium'));
  });
});

test('short race presets preserve proportional wear and give rivals a pit window', () => {
  for (const laps of [3, 6, 8]) near(F.tyreWearRate('medium',laps)*laps,F.tyreWearRate('medium',20)*20);
  assert.ok(F.tyreWearRate('soft',3)>F.tyreWearRate('hard',3));
  const driver=F.drivers[0];
  assert.equal(F.strategy({compound:'wet',surface:'wet',wear:.63,stops:0},driver,2,5),'wet');
  assert.equal(F.strategy({compound:'medium',surface:'dry',wear:.63,stops:0},driver,.3,5),null);
  assert.equal(F.strategy({compound:'intermediate',surface:'damp',wear:.66,stops:1},F.drivers[1],1.08,5),'intermediate');
});

test('critical tyre wear reduces braking, cornering and acceleration', () => {
  const newTyre={compound:'medium',wear:0};
  const worn={compound:'medium',wear:.95};
  assert.ok(F.lateralLimit(100,worn)<.5*F.lateralLimit(100,newTyre));
  assert.ok(F.drive(0,90,.05,worn)<F.drive(0,90,.05,newTyre));
  assert.ok(F.drive(90,0,.05,worn)>F.drive(90,0,.05,newTyre));
});
