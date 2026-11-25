// Chrome runs the real race loop with a scripted player and five production AI drivers.
// Set CHROME_BIN to your Chromium executable and THREE_ROOT to an unpacked three@0.160.0.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

function exercise(mobile) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  if(mobile){
    document.getElementById('btn-mode-f1race').click();
    document.getElementById('gp-launch').click();
    const joy=document.getElementById('mc-joy-base'),pedal=document.getElementById('mc-pedal-drift');
    const box=joy.getBoundingClientRect(),brake=pedal.getBoundingClientRect();
    check(isPhoneDevice&&box.width>0&&brake.width>0&&brake.right<=innerWidth+2,'landscape controls');
    for(let i=0;i<65;i++)updateF1Countdown(.05);
    updateJoystickFromClient(box.x+box.width*.70,box.y);
    check(keys.KeyW&&joySteerValue>0,'analogue throttle and steering');
    speed=60;frame(prev+40);const before=speed;
    pedal.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true}));
    frame(prev+40);
    check(pedal.textContent.includes('BRAKE')&&speed<before&&!playerBoostActive,'touch brake overrides boost');
    pedal.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}));
    resetJoystick();check(!keys.KeyW&&joySteerValue===0&&!phoneDriftPointers.size,'touch release');
    return {viewport:[innerWidth,innerHeight],joystickWidth:box.width,brakeWidth:brake.width};
  }
  for (const [laps, difficulty, compound,surface] of [[12,'easy','soft','dry'],[20,'pro','medium','dry'],[30,'legend','hard','dry'],[12,'pro','intermediate','damp'],[20,'legend','wet','wet']]) {
    document.getElementById('btn-mode-f1race').click();
    document.getElementById('gp-distance').value = laps;
    document.getElementById('gp-surface').value=surface;
    document.getElementById('gp-surface').dispatchEvent(new Event('change',{bubbles:true}));
    for (const [name,value] of [['difficulty',difficulty],['compound',compound],['session','championship']]) {
      document.querySelector('input[name="gp-'+name+'"][value="'+value+'"]').checked = true;
    }
    document.getElementById('gp-launch').click();
    check(f1CountdownActive && F1_TOTAL_LAPS === laps,'grid and distance');
    for(let i=0;i<65;i++) updateF1Countdown(.05);
    check(!f1CountdownActive,'countdown');
    const tyre = {compound,wear:0};
    check(F1Core.drive(1,0,.05,tyre)===0,'brake cannot reverse');
    check(F1Core.drive(0,160,.05,tyre)>0,'acceleration');
    check(F1Core.yawRate(45,1,tyre)>F1Core.yawRate(160,1,tyre),'speed-sensitive steering');
    check(F1Core.yawRate(160,1,tyre)>F1Core.yawRate(160,1,{compound,wear:1}),'worn grip');
    check(gpCurve.getPointAt(0).distanceTo(gpCurve.getPointAt(1))<.001,'seam');
    for(let i=0;i<GP_N;i++){
      const j=(i+1)%GP_N,d=gpProfile.pts[i].distanceTo(gpProfile.pts[j]);
      check(Math.abs(d-gpProfile.ds)<.25,'waypoint spacing');
      check(gpProfile.tans[i].dot(gpProfile.tans[j])>.94,'corner continuity');
      check(F1Core.widthAt(i/GP_N)<=60.9&&F1Core.widthAt(i/GP_N)>=35,'road width');
    }
    check(gpZones.length>=2,'DRS opportunities');
    check(F1Core.grip({compound:'wet',surface:'wet',wear:0})>F1Core.grip({compound:'soft',surface:'wet',wear:0}),'wet tread');
    check(F1Core.grip({compound:'intermediate',surface:'damp',wear:0})>F1Core.grip({compound:'wet',surface:'damp',wear:0}),'damp tread');
    const wall=gpResolveWall(gpProfile.pts,gpProfile.pts[0].x,gpProfile.pts[0].z+58,0,90,0,27);
    check(wall.hit&&wall.impact>40&&Math.sqrt(wall.proj.d2)<27.1,'barrier projects and removes outward speed');
    check(pitOffset(GP_PIT_BOX)>F1Core.widthAt(GP_PIT_BOX)/2+5.5,'pit separation');
    check(pitOffset(GP_PIT_ENTRY)===0&&pitOffset(GP_PIT_EXIT)===0,'pit merges');
    gpWallU=GP_PIT_ENTRY;
    const entry=gpPitPoint(gpWallU,0);
    pos.set(entry.x,0,entry.z);speed=95;velocityX=95;
    gpRequestPit();gpRequestPit();check(gpPitPhase==='idle','cancel');
    gpRequestPit();document.getElementById('gp-next').value='hard';
    let stationary=0,transit=0;
    do {
      if(gpPitPhase==='service')stationary+=.025;
      gpPitTick(.025);transit+=.025;
    } while(gpPitPhase!=='idle'&&transit<60);
    check(gpTyre.stops===1&&gpTyre.compound==='hard'&&gpTyre.wear===0,'tyre replacement');
    check(stationary>=2.99&&stationary<3.06&&transit>6&&gpPitCrew.length===4,'physical service');
    setupF1RaceGrid();
    for(const [impact,label] of [[42,'YELLOW FLAG'],[72,'VSC'],[110,'SAFETY CAR']]){
      incident(impact);
      check(gpFlag===label,'incident '+label);
      const first=f1Bots.slice().sort((a,b)=>b.progress-a.progress);
      const leader=first[0],follower=first[1];leader.speed=50;
      const pace=neutralSpeed(leader.name,leader.progress);
      if(label==='SAFETY CAR')check(neutralSpeed(follower.name,leader.progress-.1)>pace,'field closes under safety car');
      if(label==='VSC')check(pace===78,'VSC limiter');
      gpRaceAssist();check(!gpDRS&&gpDraft===1,'neutralised DRS');
      f1RaceTime=gpFlagUntil;updateF1Race(.05);check(!gpFlag,'green');
      f1RaceTime=gpNextIncident+1;
    }
    setupF1RaceGrid();
    const clockStep=.05;
    let previousOrder='',orderChanges=0;
    const passZones=new Set();
    for(let tick=0;tick<laps*1800&&!f1RaceFinished;tick++){
      if(!gpPlayerDone){
        // Deterministic timing driver. Steering feel is tested separately.
        const progress=(f1PlayerProgress+clockStep*100/race.length)%1;
        const point=gpCurve.getPointAt(progress);
        pos.set(point.x,0,point.z);gpWallU=progress;
        const heading=gpCurve.getTangentAt(progress);
        velocityX=100*heading.x;velocityZ=100*heading.z;
      }
      updateF1Race(clockStep);
      const order=f1Bots.slice().sort((a,b)=>b.progress-a.progress).map(b=>b.name).join(',');
      if(previousOrder&&order!==previousOrder)orderChanges++;
      previousOrder=order;
      for(const bot of f1Bots){
        check(Number.isFinite(bot.progress)&&Number.isFinite(bot.x),'AI navigation');
        if(bot.passTarget)passZones.add(Math.floor(bot.u*12));
      }
    }
    check(f1RaceFinished&&gpFinishRows.length===6&&gpCompleted===laps,'race classification');
    check(gpSeason.round>=1&&Object.values(gpSeason.totals).some(v=>v>=25),'championship scoring');
    check(orderChanges>0&&passZones.size>=3,'overtaking opportunities');
    if(surface==='dry'||laps>=20)check(f1Bots.some(b=>b.tyre.stops>0),'AI pit decisions');
    results.push({laps,difficulty,compound,surface,orderChanges,attackSectors:passZones.size,
      stops:f1Bots.map(b=>b.tyre.stops),serviceSeconds:stationary,pitSeconds:transit});
    returnToStartScreen();
  }
  document.getElementById('btn-mode-f1race').click();
  document.querySelector('[name="gp-session"][value="qualifying"]').checked=true;
  document.getElementById('gp-launch').click();
  updateF1Countdown(3.21);
  check(f1Bots.every(b=>!b.group.visible),'solo qualifying');
  gpTimingU=gpDist=.9995;gpWallU=.0005;f1RaceTime=48;
  updateF1Race(.05);
  check(gpQualiTime>48&&f1RaceFinished&&gpFinishRows.length===6,'qualifying classification');
  document.getElementById('f1-replay-btn').click();
  check(gpSession==='race'&&f1CountdownActive,'qualified race restart');
  updateF1Countdown(3.21);
  for(let i=0;i<3;i++){
    const t=gpCurve.getTangentAt(0),p=gpCurve.getPointAt(0),off=F1Core.widthAt(0)/2+3;
    pos.set(p.x,0,p.z);gpWallU=0;gpApplyBoundary(.05,1,0);
    pos.set(p.x+t.z*off,0,p.z-t.x*off);gpApplyBoundary(.05,1,0);
    f1RaceTime+=3;
  }
  check(gpPenalty.limits===3&&gpPenalty.penaltySec===3,'three separate limit excursions');
  returnToStartScreen();
  document.getElementById('btn-mode-openworld').click();
  check(gameMode==='openworld'&&paths.length>1,'Open World transition');
  return results;
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'brickway-regression-'));
try {
  let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  if(process.env.THREE_ROOT)html=html.replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/',pathToFileURL(path.resolve(process.env.THREE_ROOT)+'/').href);
  const marker='requestAnimationFrame(frame);\n})();';
  assert(html.includes(marker),'module startup');
  const mobile=process.argv.includes('--mobile');
  const run='try{document.documentElement.dataset.result=JSON.stringify(('+exercise.toString()+')('+mobile+'));}catch(e){document.documentElement.dataset.failure=e.stack;}';
  html=html.replace(marker,()=>run+'\n})();');
  const file=path.join(temp,'test.html');fs.writeFileSync(file,html);
  const mac=process.platform==='darwin';
  const chrome=process.env.CHROME_BIN||(mac?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'google-chrome');
  const result=spawnSync(chrome,['--headless','--allow-file-access-from-files','--enable-unsafe-swiftshader',
    ...(mac?['--use-gl=angle','--use-angle=metal']:[]),'--disable-background-networking',
    ...(mobile?['--window-size=932,480','--touch-events=enabled','--user-agent=Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/132.0 Mobile Safari/537.36']:[]),'--user-data-dir='+path.join(temp,'profile'),'--dump-dom',pathToFileURL(file).href],
    {encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  const tag=result.stdout.match(/<html[^>]*>/)?.[0]||'';
  assert(tag.includes('data-result='),tag+'\n'+result.stderr.slice(-1400));
  console.log(tag.match(/data-result="([^"]+)"/)[1].replaceAll('&quot;','"'));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
