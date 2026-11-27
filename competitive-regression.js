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
  check(!document.getElementById('fps-meter')&&!document.getElementById('set-fps'),'FPS display and setting are removed');
  const checkHeadlights=()=>{
    const oldTod=todIdx,sky=skyDome.material.uniforms.uNightFactor,oldNight=sky.value;
    todIdx=1;sky.value=0;updateEnvironment(1/60,prev);
    check(sky.value<.10&&formulaHeadlightLens.emissiveIntensity===.78,'lamps reach full brightness on the first frame of night');
    check(formulaHeadlightBeams.length===2&&formulaHeadlightBeams.every(beam=>beam.visible&&beam.intensity>0&&beam.map===formulaHeadlightProjector&&beam.target.position.y<beam.position.y),'both projectors cast a downward low beam');
    check(formulaPlayer.lightPool.visible&&formulaPlayer.lightPool.geometry.parameters.width>=42,'wide road spill is enabled');
    const pixels=formulaHeadlightProjector.image.data,size=formulaHeadlightProjector.image.width;
    const sample=(x,y)=>pixels[(y*size+x)*4];
    check(sample(32,26)>sample(0,26)&&sample(32,26)>sample(32,45)&&sample(48,34)>sample(16,34),'projector has a hotspot, smooth edges and an asymmetric cutoff');
    check(formulaHeadlightBeams.every(beam=>beam.color.r>beam.color.g&&beam.color.g>beam.color.b),'lamp light is warm white');
    todIdx=0;sky.value=1;updateEnvironment(1/60,prev);
    check(formulaHeadlightBeams.every(beam=>!beam.visible)&&!formulaPlayer.lightPool.visible,'headlights switch off in daylight');
    todIdx=oldTod;sky.value=oldNight;
    updateEnvironment(0,prev);
  };
  if(mobile){
    document.getElementById('btn-mode-f1race').click();
    document.getElementById('gp-launch').click();
    checkHeadlights();
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
    const shown=id=>getComputedStyle(document.getElementById(id)).display!=='none';
    check(shown('gp-phone-settings-tab')&&!document.querySelector('[data-tab=driving]')&&!document.getElementById('set-power'),'phone HUD settings replace the handling sliders');
    openSettings();document.getElementById('gp-phone-settings-tab').click();
    check(document.querySelector('[data-page=phone]').classList.contains('active'),'phone HUD settings open');
    const set=(key,value)=>{settingsControls[key].value=value;settingsControls[key].dispatchEvent(new Event('input'));};
    set('phoneOpacity','70');set('phonePitSize','large');set('phonePitPosition','mid');
    const widget=document.getElementById('tyre-logo-widget');
    const saved=JSON.parse(localStorage.getItem('brickway-settings-v2'));
    check(getComputedStyle(widget).opacity==='0.7'&&widget.getBoundingClientRect().width>=150&&document.body.classList.contains('gp-phone-pit-mid')&&saved.phonePitSize==='large','phone layout settings apply and persist');
    set('phoneOpacity','100');set('phonePitSize','standard');set('phonePitPosition','high');closeSettings();

    check(shown('gp-phone-position')&&!shown('f1-live-ranks')&&!shown('f1-race-hud'),'mobile timing displays only the solo position badge');
    const rank=document.getElementById('gp-phone-position').getBoundingClientRect();
    const pit=document.getElementById('tyre-logo-widget').getBoundingClientRect();
    check(rank.right<pit.left&&rank.left<innerWidth/2&&!document.getElementById('tyre-logo-widget').contains(document.getElementById('gp-phone-position')),'standalone left-side rank does not overlap the tyre panel');
    check(/^[1-6]\/6$/.test(document.getElementById('gp-phone-position').textContent),'mobile rank uses live timing');
    openSettings();phoneHudOpen.click();
    const rankHandle=phoneHudEditor.querySelector('[data-target="#gp-phone-position"]');
    const moveRank=()=>rankHandle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
    const rankLeft=()=>document.getElementById('gp-phone-position').getBoundingClientRect().left;
    check(phoneHudEditor.open&&settingsOpen&&!rankHandle.hidden,'editing shows the live HUD and keeps the game paused');
    moveRank();
    check(Math.abs(rankLeft()-rank.left-20)<1,'moving the rank updates its live preview');
    document.getElementById('phone-hud-cancel').click();
    check(!phoneHudEditor.open&&Math.abs(rankLeft()-rank.left)<1,'cancel restores the saved layout');
    phoneHudOpen.click();moveRank();
    document.getElementById('phone-hud-save').click();
    const savedLayout=JSON.parse(localStorage.getItem('brickway-settings-v2')).phoneHudLayouts;
    check(savedLayout.f1race['#gp-phone-position'][0]>0&&Math.abs(rankLeft()-rank.left-20)<1,'save persists a race-specific layout');
    phoneHudOpen.click();
    document.getElementById('phone-hud-reset').click();
    document.getElementById('phone-hud-save').click();
    check(Math.abs(rankLeft()-rank.left)<1,'reset restores the default rank location');
    closeSettings();
    const pitButton=document.getElementById('tyre-pit-btn');
    check(shown('tyre-pit-controls')&&pitButton.disabled&&pitButton.getBoundingClientRect().height>=44,'mobile pit button is visible and thumb-sized');
    gpTyre.wear=.5;gpPitHUD();check(!pitButton.disabled,'mobile pit unlocks when tyres wear');
    gpTyre.wear=1;updateF1Race(.05);
    check(f1RaceFinished&&speed===0&&document.querySelector('#f1-finish-overlay.tyre-failure.open')&&shown('gp-tyre-failure'),'zero tyre health retires the player and starts the animation');
    document.getElementById('f1-replay-btn').click();
    check(!f1RaceFinished&&gpTyre.wear===0&&!document.querySelector('#f1-finish-overlay.tyre-failure'),'restart clears the failed tyre');
    return {viewport:[innerWidth,innerHeight],joystickWidth:box.width,brakeWidth:brake.width};
  }
  for (const [laps, difficulty, compound,surface] of [[5,'easy','soft','dry'],[8,'pro','medium','dry'],[12,'legend','hard','dry'],[5,'pro','intermediate','damp'],[8,'legend','wet','wet']]) {
    document.getElementById('btn-mode-f1race').click();
    document.getElementById('gp-distance').value = laps;
    document.getElementById('gp-surface').value=surface;
    document.getElementById('gp-surface').dispatchEvent(new Event('change',{bubbles:true}));
    for (const [name,value] of [['difficulty',difficulty],['compound',compound],['session','championship']]) {
      document.querySelector('input[name="gp-'+name+'"][value="'+value+'"]').checked = true;
    }
    document.getElementById('gp-launch').click();
    check(f1CountdownActive && F1_TOTAL_LAPS === laps,'grid and distance');
    check(getComputedStyle(document.getElementById('f1-live-ranks')).display!=='none'&&
      getComputedStyle(document.getElementById('gp-phone-position')).display==='none','desktop retains full live ranks');
    for(let i=0;i<65;i++) updateF1Countdown(.05);
    check(!f1CountdownActive,'countdown');
    check(getComputedStyle(document.getElementById('gp-phone-settings-tab')).display==='none','desktop does not expose phone HUD settings');
    checkHeadlights();
    const sky=skyDome.material.uniforms.uNightFactor;
    const oldTod=todIdx,oldNight=sky.value;
    todIdx=1;sky.value=1;updateEnvironment(.05,prev);
    check(formulaHeadlightBeams.length===2&&formulaHeadlightBeams.every(beam=>beam.visible&&beam.intensity>0)&&formulaHeadlightBeams[0].position.x<0&&formulaHeadlightBeams[1].position.x>0&&formulaPlayer.lightPool.visible&&f1Bots.every(bot=>bot.lightPool.visible),'Formula headlights are subtle at night');
    todIdx=0;sky.value=0;updateEnvironment(.05,prev);
    check(formulaHeadlightBeams.every(beam=>!beam.visible)&&formulaHeadlightLens.emissiveIntensity===0&&[formulaPlayer,...f1Bots].every(car=>!car.lightPool.visible),'Formula headlights switch off in daylight');
    todIdx=oldTod;sky.value=oldNight;

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
    gpTyre.wear=.46;
    // An AI car occupying the service box holds the approaching player outside it.
    const blockingBot=f1Bots[0],oldBotU=blockingBot.u;
    blockingBot.u=GP_PIT_BOX;
    blockingBot.pit={ticket:++gpPitTicket,done:false};
    gpRequestPit();
    for(let i=0;i<480&&!gpPlayerPitWaiting;i++)gpPitTick(.025);
    check(gpPlayerPitWaiting&&gpPitPhase==='entry'&&gpPitSpeed===0&&gpTyre.stops===0,'player stops behind an occupied box');
    blockingBot.pit.done=true;blockingBot.u=GP_PIT_BOX+12/race.length;
    gpPitTick(.025);
    check(gpPitPhase==='entry'&&gpTyre.stops===0,'player does not start service before departure clearance');
    blockingBot.pit=null;blockingBot.u=oldBotU;
    setupF1RaceGrid();gpTyre.wear=.46;gpWallU=GP_PIT_ENTRY;
    pos.set(entry.x,0,entry.z);yaw=Math.atan2(entry.t.x,entry.t.z);speed=95;velocityX=95;

    gpRequestPit();check(gpPitPhase==='queued','pit request unlocks at 55% health');gpRequestPit();check(gpPitPhase==='idle','cancel');
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
      // The deterministic race fixture replenishes tyres at the pit entry.
      if(!gpPlayerDone&&gpTyre.wear>.6&&gpWallU>=GP_PIT_ENTRY&&gpWallU<=GP_PIT_LAST_ENTRY){
        F1Core.performPitStop(gpTyre,compound);
      }
      check(f1Bots.filter(bot=>bot.pit&&!bot.pit.done&&bot.u>=GP_PIT_BOX-1e-6).length<=1,'only one AI receives service at a time');
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
    check(f1Bots.every(b=>b.tyre.stops>0&&!b.pit),'each AI driver finishes a tyre change and rejoins');
    const topRivals=gpFinishRows.filter(row=>row.id!=='p').slice(0,2);
    check(topRivals.some(row=>row.name===hamilton.name)&&topRivals.some(row=>row.name===max.name),'Expected Hamilton and Verstappen in '+laps+'-lap '+surface+' race. '+JSON.stringify(gpFinishRows.map(r=>({name:r.name,time:r.finishTime}))));
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
  check(Number.isFinite(gpTyre.temperature)&&formulaCockpit.reading.endsWith('|'+Math.round(gpTyre.temperature)),'formula cockpit displays live tyre temperature');
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
  wanted=3;pos.set(1510,0,226);frame(prev+40);
  check(policePool.some(c=>c.active),'an ongoing pursuit replenishes missing cruisers');
  const oldPause=chaseSong.pause;
  let pauses=0;
  chaseSong.pause=function(){pauses++;return oldPause.call(this);};
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  try{
    keys.KeyW=true;
    document.dispatchEvent(new Event('visibilitychange'));
    check(gameplayAudioBlocked()&&pauses>0&&!keys.KeyW,'hiding the tab pauses chase audio and releases controls');
    const before=pursuitTimer;
    frame(prev+40);
    check(pursuitTimer===before,'hidden tab pauses pursuit simulation');
  }finally{
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }
  openDeathScreen('You Died','Test death.',0,0);
  check(gameplayAudioBlocked()&&chaseSong.paused&&!chaseWanted,'death clears chase audio');
  chaseSong.pause=oldPause;
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
      if(mobile)await page.click('#fs-skip');
      const result=await page.evaluate(()=>window.runBrickwayRegression());
      if(mobile){
        await page.tap('#settings-open');
        await page.click('#phone-hud-open');
        const handle=page.locator('[data-target="#gp-phone-position"]');
        const before=await handle.boundingBox();
        await page.mouse.move(before.x+before.width/2,before.y+before.height/2);
        await page.mouse.down();
        await page.mouse.move(before.x+before.width/2+80,before.y+before.height/2-20,{steps:4});
        await page.mouse.up();
        const after=await handle.boundingBox();
        assert.ok(Math.abs(after.x-before.x-80)<2&&Math.abs(after.y-before.y+20)<2,'pointer drag moves rank in both directions');
        await page.click('#phone-hud-save');
      }
      assert.deepEqual(errors,[],mode+' browser errors');
      console.log(mode,JSON.stringify(result));
      await page.close();
    }
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
