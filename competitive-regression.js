// Headless Chromium runs the production simulation at a deterministic step.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

function exercise(mobile) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  const [hamilton,max,leclerc]=F1Core.drivers;
  check(hamilton.number===44&&max.number===1&&hamilton.power>max.power&&max.power>leclerc.power,'rival power order');
  check(max.corner>hamilton.corner&&hamilton.wear<max.wear&&leclerc.defence>max.defence,'distinct rival strengths');
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
    const boxEdges=gpBarrierEdges(GP_PIT_BOX);
    check(boxEdges.divider===null&&boxEdges.positive>pitOffset(GP_PIT_BOX)+GP_PIT_HALF_WIDTH,'widened race boundary encloses the pit lane');
    check(gpBarrierEdges(GP_PIT_ENTRY).divider===null&&gpBarrierEdges(GP_PIT_EXIT).divider===null,'open merges');
    check(gpFootprint(Math.PI/4,0)>gpFootprint(0,0)+3,'angled footprint includes the nose and tail');
    const u=.055,t=gpCurve.getTangentAt(u),edge=gpBarrierEdges(u).positive,contact=gpPitPoint(u,edge-2);
    yaw=Math.atan2(t.x,t.z)+Math.PI/4;
    gpWallU=u;pos.set(contact.x,0,contact.z);velocityX=t.z*140;velocityZ=-t.x*140;
    gpApplyBoundary(.05,0,0,true);
    const corrected=gpNearestSegment(gpProfile.pts,pos.x,pos.z,u);
    check(corrected.lat<edge-7&&Math.abs(velocityX*t.z-velocityZ*t.x)<1,'angled high-speed impact removes outward velocity');
    gpWallU=GP_PIT_ENTRY;
    const entry=gpPitPoint(gpWallU,0);
    pos.set(entry.x,0,entry.z);yaw=Math.atan2(entry.t.x,entry.t.z);speed=95;velocityX=95;
    gpRequestPit();check(gpPitPhase==='idle','fresh tyres lock pit requests');
    gpTyre.wear=.71;
    gpRequestPit();check(gpPitPhase==='queued','pit request unlocks below 30% health');gpRequestPit();check(gpPitPhase==='idle','cancel');
    gpRequestPit();document.getElementById('tyre-next-select').value='hard';
    let stationary=0,transit=0,largestYawStep=0;
    do {
      if(gpPitPhase==='service')stationary+=.025;
      const oldYaw=yaw;
      gpPitTick(.025);transit+=.025;
      largestYawStep=Math.max(largestYawStep,Math.abs(Math.atan2(Math.sin(yaw-oldYaw),Math.cos(yaw-oldYaw))));
    } while(gpPitPhase!=='idle'&&transit<60);
    check(largestYawStep<.20,'pit path does not snap the car heading');
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
    const topRivals=gpFinishRows.filter(row=>row.id!=='p').slice(0,2);
    check(topRivals.some(row=>row.name===hamilton.name)&&topRivals.some(row=>row.name===max.name),'Hamilton and Verstappen are the top rated rivals in each scenario');
    results.push({laps,difficulty,compound,surface,orderChanges,attackSectors:passZones.size,
      topRivals:topRivals.map(row=>row.name),rivalGapSeconds:Number((topRivals[1].finishTime-topRivals[0].finishTime).toFixed(2)),stops:f1Bots.map(b=>b.tyre.stops),serviceSeconds:stationary,pitSeconds:transit});
    returnToStartScreen();
  }
  document.getElementById('btn-mode-f1race').click();
  document.querySelector('[name="gp-session"][value="qualifying"]').checked=true;
  document.getElementById('gp-launch').click();
  updateF1Countdown(3.21);
  settingsControls.camera.value='3';settingsControls.camera.dispatchEvent(new Event('input'));
  frame(prev+.040*1000);
  check(formulaCockpit.group.visible&&!formulaPlayer.face.visible&&camera.position.distanceTo(formulaPlayer.group.position)<4,'driving from inside the formula car');
  check(formulaCockpit.wheel.children.some(mesh=>mesh.material?.map===formulaCockpit.dialTex),'formula instruments follow the wheel');
  check(formulaCockpit.dialTex.version>0&&cinematicPass.uniforms.uCockpit.value===1,'formula display updates with clear cockpit post-processing');
  f1RaceTime+=.12;recordRaceReplay();
  check(f1Bots.every(b=>!b.group.visible),'solo qualifying');
  gpTimingU=gpDist=.9995;gpWallU=.0005;f1RaceTime=48;
  updateF1Race(.05);
  check(gpQualiTime>48&&f1RaceFinished&&gpFinishRows.length===6,'qualifying classification');
  check(!document.getElementById('gp-watch-replay').hidden,'replay available after classification');
  document.getElementById('gp-watch-replay').click();
  check(raceReplay.active&&!replayPanel.hidden,'race replay starts');
  replaySeek.value='500';replaySeek.dispatchEvent(new Event('input'));
  check(!raceReplay.playing&&Number.isFinite(camera.position.x),'replay seeking');
  document.getElementById('gp-replay-close').click();
  check(!raceReplay.active&&replayPanel.hidden,'replay restores results');
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
function exerciseCity() {
  const check=(condition,message)=>{if(!condition)throw new Error(message);};
  document.getElementById('btn-mode-openworld').click();
  check(harborRoot.visible&&paths.length>=23,'expanded Open World');
  check(crossings.map(bridge=>bridge.style).join(',')==='suspension,truss','crossings have distinct visual designs');
  const turnWith=key=>{
    reset();speed=55;
    const start=yaw;
    keys={[key]:true};frame(prev+40);keys={};
    return yaw-start;
  };
  const keyboardTurn=turnWith('KeyA'),arrowTurn=turnWith('ArrowRight');
  check(Math.abs(keyboardTurn)>.02&&Math.abs(keyboardTurn-arrowTurn)<.00001,'Open World keyboard steering uses the full turn rate');
  reset();
  for(const {points} of cityJobs)for(const point of points){
    for(const [x,z] of Array.isArray(point[0])?point:[point]){
      check(onRoadAt(x,z),'job destination remains on a drivable road');
    }
  }
  for(const bridge of crossings){
    let lastHeight=bridgeHeight(bridge,bridgeStart);
    for(let x=bridgeStart+2;x<=bridgeEnd;x+=2){
      const current=worldGround(x,bridge.z);
      check(current&&Math.abs(current.y-lastHeight)<.5,'bridge ramp has a continuous driving surface');
      lastHeight=current.y;
    }
    const x=(bridgeStart+bridgeEnd)/2;
    const deck=confineWorld(x,bridge.z,x-2,bridge.z,4.7);
    const rail=confineWorld(x,bridge.z+bridge.width,x,bridge.z,4.7);
    check(deck.y>11&&rail.z<bridge.z+bridge.width*.5,'bridge has height and solid rails');
    if(bridge.style==='truss'){
      const overhead=harborRoot.children.filter(mesh=>mesh.position.z===bridge.z&&mesh.scale.z>=bridge.width-2&&
        mesh.position.y>bridgeHeight(bridge,mesh.position.x)+5);
      check(overhead.length>=4&&overhead.every(mesh=>{
        const edge=mesh.scale.x/2;
        const deckY=Math.max(bridgeHeight(bridge,mesh.position.x-edge),bridgeHeight(bridge,mesh.position.x+edge));
        return mesh.position.y-mesh.scale.y/2-deckY>13;
      }),'Dockside portal beams clear the raised roadway by at least 13 units');
    }
  }
  check(worldGround(1010,0)===null,'channel is water between crossings');
  check(policeWaypoint({x:809,z:-340},1400,-350).z===-350,'police select a bridge');
  check(policeWaypoint({x:970,z:440},980,443).x===980,'cruisers follow a target on the same bridge');
  const obstacle=harborRouteLots.find(lot=>lot.x>1360&&lot.z>70&&lot.z<395);
  const left={x:obstacle.x-obstacle.w/2-10,z:obstacle.z};
  const right={x:obstacle.x+obstacle.w/2+10,z:obstacle.z};
  check(harborPathBlocked(left.x,left.z,right.x,right.z),'cargo obstructs a direct chase');
  const detour=harborPoliceRoute(left.x,left.z,right);
  check(detour.length>2&&detour.slice(1).every((node,i)=>!harborPathBlocked(detour[i].x,detour[i].z,node.x,node.z,7)),'harbor police navigate around cargo');

  check(isCovered(safehouses[0].x,safehouses[0].z),'safehouse has cover');
  check(harborElevation(1536,-545)>25&&harborElevation(1310,-545)===0,'switchbacks rise into and descend from the hills');
  pos.set(1645,0,-350);updateHarborTraffic(.05,false);
  check(harborTraffic.length===0,'harbor AI traffic is disabled');
  reset();
  check(!copCanSee({x:-80,z:0},{x:0,z:0},true),'covered player breaks visual contact');
  bankedStuds=1200;
  check(!document.getElementById('city-open')&&!document.getElementById('city-walk'),'City and walking quick controls are hidden');
  // Exercise the retained garage and walking logic directly.
  openCity();
  check(cityPanel.open,'garage opens when parked');
  [...document.querySelectorAll('#city-garage button')].find(button=>button.textContent==='950 STUDS').click();
  check(streetCarId==='v12'&&ownedStreetCars.has('v12')&&bankedStuds===250,'garage buys and equips a distinct car');
  const save=JSON.parse(localStorage.getItem('bw-city-v1'));
  check(save.selected==='v12'&&save.balance===250,'garage purchase is saved atomically');
  document.getElementById('city-close').click();
  toggleWalk();
  check(onFoot&&walker.visible,'exit the car');
  const start=walker.position.clone();
  keys.KeyW=true;updateWalker(.05,prev+50);keys={};
  check(walker.position.distanceTo(start)>.1,'walking moves the avatar');
  toggleWalk();
  check(!onFoot&&!walker.visible,'get back into car');
  settingsControls.camera.value='3';settingsControls.camera.dispatchEvent(new Event('input'));
  frame(prev+40);
  check(streetCockpit.group.visible&&!sports.helmetGroup.visible,'street car cockpit');
  check(streetCockpit.dialTex.version>0&&cinematicPass.uniforms.uCockpit.value===1,'street instruments update in cockpit view');
  settingsControls.camera.value='0';settingsControls.camera.dispatchEvent(new Event('input'));
  frame(prev+40);
  check(!streetCockpit.group.visible&&cinematicPass.uniforms.uCockpit.value===0,'chase camera exits cockpit rendering');
  check(beginCityJob(cityJobs[0]),'start a courier job');
  for(const [x,z] of cityJobs[0].points){pos.set(x,0,z);updateCityJob(.05);}
  updateCityJob(.05);
  check(!activeCityJob&&bankedStuds>650,'courier pays and saves a best time');
  check(beginCityJob(cityJobs[1]),'start a getaway job');
  const [x,z]=cityJobs[1].points[0];pos.set(x,0,z);
  frame(prev+40);
  check(wanted===3&&activeCityJob.started&&policePool.some(c=>c.active),'cargo pickup dispatches police');
  escapeTimer=9.95;policeMemory.x=0;policeMemory.z=0;
  for(const cop of policePool){if(cop.active){cop.x=750;cop.z=-350;}}
  frame(prev+50);
  check(wanted===3&&escapeTimer<9.95&&Math.hypot(pos.x-policeMemory.x,pos.z-policeMemory.z)<.1,'harbor pursuit stays active across the channel');
  const leadCop=policePool.find(cop=>cop.active);
  for(const cop of policePool)if(cop!==leadCop)cop.active=false;
  Object.assign(leadCop,{x:790,z:440,yaw:Math.PI/2,vx:0,vz:0,speed:45});
  for(let step=0;step<320&&leadCop.x<=bridgeEnd;step++)frame(prev+40);
  check(leadCop.x>bridgeEnd&&wanted===3,'a pursuing cruiser drives the full Dockside crossing');


  const heat=wanted;
  pos.set(1510,0,226);updateCityJob(.05);
  check(jobWaypoints(activeCityJob).length===2,'cargo job offers both crossings');
  pos.set(748,0,-350);updateCityJob(.05);updateCityJob(.05);
  check(activeCityJob&&wanted>0,'crossing does not pay until the pursuit is lost');
  clearPolice();updateCityJob(.05);
  check(!activeCityJob&&Number.isFinite(cityTimes.dock),'getaway pays after escape');
  return {crossings:crossings.length,cars:Object.keys(streetCars).length,jobs:cityJobs.length,traffic:harborTraffic.length,heat};
}

async function run() {
  const origin='http://brickway.test';
  const modes=process.argv.includes('--mobile')?['mobile']:process.argv.includes('--city')?['city']:['race','mobile','city'];
  const threeRoot=process.env.THREE_ROOT||path.dirname(path.dirname(require.resolve('three')));
  const original=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const html=original.replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/',origin+'/three/');
  const marker='requestAnimationFrame(frame);\n})();';
  assert(html.includes(marker),'module startup');
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||undefined,
    args:['--enable-unsafe-swiftshader'],
    env:{...process.env,XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/brickway-chromium-config'}
  });
  try {
    for(const mode of modes){
      const mobile=mode==='mobile';
      const page=await browser.newPage(mobile?{
        viewport:{width:932,height:480},isMobile:true,hasTouch:true,
        userAgent:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/132.0 Mobile Safari/537.36'
      }:{viewport:{width:960,height:540}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const exerciseCode=mode==='city'?exerciseCity.toString():exercise.toString();
      const injection=`window.runBrickwayRegression=()=>{
 const raf=window.requestAnimationFrame,render=renderGameScene;
 window.requestAnimationFrame=()=>0;
 renderGameScene=()=>{};
 try{return (${exerciseCode})(${mobile});}
 finally{window.requestAnimationFrame=raf;renderGameScene=render;}
};
})();`;
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname==='/')return route.fulfill({body:html.replace(marker,()=>injection),contentType:'text/html'});
        if(url.pathname.startsWith('/three/'))return route.fulfill({path:path.join(threeRoot,url.pathname.slice(7)),contentType:'text/javascript'});
        return route.fulfill({status:404});
      });
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!window.runBrickwayRegression);
      const result=await page.evaluate(()=>window.runBrickwayRegression());
      assert.deepEqual(errors,[],mode+' browser errors');
      console.log(mode,JSON.stringify(result));
      await page.close();
    }
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
