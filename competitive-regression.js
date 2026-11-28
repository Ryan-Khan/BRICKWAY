// Headless Chromium runs the production simulation at a deterministic step.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function exercise(mobile) {
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

    check(!document.getElementById('gp-phone-position')&&!shown('f1-live-ranks')&&!shown('f1-race-hud'),'mobile has no live ranking');
    const originalLeft=widget.getBoundingClientRect().left;
    openSettings();phoneHudOpen.click();
    const pitHandle=phoneHudEditor.querySelector('[data-target="#tyre-logo-widget"]');
    const movePit=()=>pitHandle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true}));
    const pitLeft=()=>widget.getBoundingClientRect().left;
    check(phoneHudEditor.open&&settingsOpen&&!pitHandle.hidden,'editing shows the live HUD and keeps the game paused');
    movePit();
    check(Math.abs(pitLeft()-originalLeft+20)<1,'moving the pit panel updates its live preview');
    document.getElementById('phone-hud-cancel').click();
    check(!phoneHudEditor.open&&Math.abs(pitLeft()-originalLeft)<1,'cancel restores the saved layout');
    phoneHudOpen.click();movePit();
    document.getElementById('phone-hud-save').click();
    const savedLayout=JSON.parse(localStorage.getItem('brickway-settings-v2')).phoneHudLayouts;
    check(savedLayout.f1race['#tyre-logo-widget'][0]<0&&Math.abs(pitLeft()-originalLeft+20)<1,'save persists a race-specific layout');
    phoneHudOpen.click();
    document.getElementById('phone-hud-reset').click();
    document.getElementById('phone-hud-save').click();
    check(Math.abs(pitLeft()-originalLeft)<1,'reset restores the default pit panel location');
    closeSettings();
    const pitButton=document.getElementById('tyre-pit-btn');
    check(shown('tyre-pit-controls')&&pitButton.disabled&&pitButton.getBoundingClientRect().height>=44,'mobile pit button is visible and thumb-sized');
    gpTyre.wear=.5;gpPitHUD();check(!pitButton.disabled,'mobile pit unlocks when tyres wear');
    initSound();
    await gpCrashIntroDecode;
    check(gpCrashIntroBuffer?.duration>2.5&&gpCrashIntroBuffer.duration<3,'crash cue is predecoded with padding removed');
    for(const voice of audio.voices)voice.gain.gain.setTargetAtTime(.25,audio.ctx.currentTime,.01);
    gpTyre.wear=1;updateF1Race(.05);
    check(!gpTyreCrash&&document.getElementById('message').textContent.includes('TYRES WORN OUT'),'zero tyre health warns before triggering a crash');
    for(let i=1;i<49;i++)updateF1Race(.05);
    check(!gpTyreCrash,'worn-out tyres give the driver a brief chance to make pit entry');
    updateF1Race(.05);
    check(F1_TOTAL_LAPS===3,'mobile race defaults to three laps');
    check(f1RaceFinished&&speed===0&&gpTyreCrash&&!deathScreenOpen,'zero tyre health starts the crash before showing results');
    const intro=gpTyreCrash.introSound;
    check(intro?.buffer===gpCrashIntroBuffer&&!intro.loop,'crash cue starts immediately as a one-shot');
    const introEnded=new Promise(resolve=>intro.addEventListener('ended',resolve,{once:true}));
    for(let i=0;i<4;i++)frame(prev+50);
    check(gpCrashRig.wheelFire.every(flames=>flames.visible)&&formulaPlayer.wheels.every(wheel=>wheel.visible)&&!gpCrashRig.fire.visible,'tyres ignite while still attached');
    for(let i=0;i<22;i++)frame(prev+50);
    check(gpCrashRig.wheels.every(wheel=>wheel.visible)&&gpCrashRig.wheelFire.every(flames=>flames.visible)&&formulaPlayer.wheels.every(wheel=>!wheel.visible),'burning wheels detach');
    check(formulaPlayer.group.position.y>6&&!gpCrashRig.fire.visible,'car lifts off before it catches fire');
    check(!gpTyreCrash.fireSound,'fire audio waits for the cue');
    await introEnded;
    check(audio.voices.every(voice=>voice.gain.gain.value===0)&&audio.windGain.gain.value===0,'driving audio remains silent while the crash plays');
    for(let i=0;i<18;i++)frame(prev+50);
    check(formulaPlayer.group.position.y<1&&gpCrashRig.fire.visible,'the body ignites after touchdown');
    check(!gpTyreCrash.introSound&&gpTyreCrash.fireSound?.loop,'fire audio starts after the cue ends');
    for(let i=0;i<56;i++)frame(prev+50);
    check(!deathScreenOpen&&gpCrashRig.fire.visible,'fire remains on screen for at least five seconds of crash time');
    for(let i=0;i<8;i++)frame(prev+50);
    const end=gpCurve.getPointAt(gpIncrease(gpTyreCrash.startU,gpTyreCrash.travel/race.length,1));
    check(Math.hypot(formulaPlayer.group.position.x-end.x,formulaPlayer.group.position.z-end.z)>F1Core.widthAt(gpIncrease(gpTyreCrash.startU,gpTyreCrash.travel/race.length,1))/2,'car slides beyond the track edge');
    check(deathScreenOpen&&document.querySelector('#death-overlay.race-death.open')&&!gpTyreCrash.fireSound,'shared death screen follows the crash and stops fire audio');
    check(document.getElementById('death-reason').textContent==='You died due to lack of INTELLIGENCE'&&document.getElementById('death-race-quote').textContent==='"thats why she left u !!"'&&!shown('death-score'),'F1 death screen shows the racing text');
    document.getElementById('death-respawn-btn').click();
    check(!f1RaceFinished&&gpTyre.wear===0&&!gpTyreCrash&&!gpCrashRig.fire.visible&&gpCrashRig.wheelFire.every(flames=>!flames.visible)&&gpCrashRig.wheels.every(wheel=>!wheel.visible)&&formulaPlayer.wheels.every(wheel=>wheel.visible)&&!deathScreenOpen&&!document.querySelector('#death-overlay.open'),'restart clears the failed tyre and restores all wheels');
    for(let i=0;i<70;i++)updateF1Countdown(.05);
    await audio.ctx.resume();
    for(const voice of audio.voices)voice.gain.gain.setTargetAtTime(.25,audio.ctx.currentTime,.01);
    f1RaceTime=90;
    f1Bots[0].finished=true;f1Bots[0].finishTime=89;f1Bots[0].progress=F1_TOTAL_LAPS;
    f1Bots[1].finished=true;f1Bots[1].finishTime=Infinity;f1Bots[1].progress=1;
    gpDist=F1_TOTAL_LAPS-.0001;gpCompleted=F1_TOTAL_LAPS-1;gpTimingU=.9999;gpWallU=.0001;
    const crossingPoint=gpCurve.getPointAt(gpWallU),crossingHeading=gpCurve.getTangentAt(gpWallU);
    pos.set(crossingPoint.x,0,crossingPoint.z);
    speed=95;velocityX=95*crossingHeading.x;velocityZ=95*crossingHeading.z;
    updateF1Race(.05);
    const standings=document.getElementById('f1-standings');
    const title=document.getElementById('f1-finish-title');
    check(f1RaceFinished&&gpPlayerDone&&title.textContent.includes('YOU FINISHED 2ND'),'final lap immediately locks the P2 result');
    check(gpFinishSequence&&!gpFinishBanner.hidden&&gpFinishBanner.textContent.includes('P2')&&!document.querySelector('#f1-finish-overlay.open'),'checkered finish is shown before the results board');
    check(GP_FINISH_SECONDS===6.2&&gpFinishCue?.flybyTail?.buffer&&gpFinishCue.nodes.length>4,'the 6.2-second clip schedules fanfare and a pass-by');
    const cueEnded=new Promise(resolve=>gpFinishCue.flybyTail.addEventListener('ended',resolve,{once:true}));
    check(!document.getElementById('gp-watch-replay'),'Grand Prix results offer no replay');
    check(standings.textContent.includes('ON TRACK')&&standings.lastElementChild.textContent.includes('DNF'),'unfinished rivals and retirees have distinct statuses');
    const finishTime=f1RaceTime;
    const finalRows=gpFinishRows;
    const beforeCoast=formulaPlayer.group.position.clone(),beforeWheel=formulaPlayer.wheels[0].rotation.x;
    for(let i=0;i<16;i++)frame(prev+40);
    check(formulaPlayer.group.position.distanceTo(beforeCoast)>25&&formulaPlayer.wheels[0].rotation.x>beforeWheel,'the actual car and wheels animate through the finish coast');
    for(let i=0;i<100;i++)frame(prev+40);
    const roadside=camera.position.clone(),atRoadside=formulaPlayer.group.position.clone();
    for(let i=0;i<24;i++)frame(prev+40);
    check(gpFinishSequence&&camera.position.distanceTo(roadside)<.001&&formulaPlayer.group.position.distanceTo(atRoadside)>40,'the car accelerates away from the fixed roadside camera');
    for(let i=0;i<25&&gpFinishSequence;i++)frame(prev+40);
    check(!gpFinishSequence&&gpFinishBanner.hidden&&document.querySelector('#f1-finish-overlay.open'),'results appear when the finish sequence ends');
    updateF1Race(1);
    check(f1RaceTime===finishTime&&gpFinishRows===finalRows&&speed===0&&gameplayAudioBlocked(),'finish coast leaves race simulation and results frozen');
    await cueEnded;
    check(!gpFinishCue,'fanfare and pass-by both finish and release their audio nodes');
    await audio.ctx.suspend();
    initSound();syncGameplayAudio();
    check(audio.ctx.state==='suspended'&&audio.voices.every(voice=>voice.gain.gain.value===0),'audio stays silent on the results board');
    document.getElementById('f1-restart-btn').click();
    await audio.ctx.resume();
    check(!gameplayAudioBlocked()&&audio.ctx.state==='running','audio returns after starting the next race');
    updateF1Countdown(3.21);
    gpDist=F1_TOTAL_LAPS-.0001;gpCompleted=F1_TOTAL_LAPS-1;gpTimingU=.9999;gpWallU=.0001;
    pos.set(crossingPoint.x,0,crossingPoint.z);
    speed=95;velocityX=95*crossingHeading.x;velocityZ=95*crossingHeading.z;
    updateF1Race(.05);
    check(gpFinishCue?.flybyTail,'a subsequent finish schedules a fresh pass-by');
    const hidden=Object.getOwnPropertyDescriptor(document,'hidden');
    try {
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      syncGameplayAudio();
      check(!gpFinishCue,'hiding the tab cancels the fanfare and pending pass-by');
    } finally {
      if(hidden)Object.defineProperty(document,'hidden',hidden);
      else delete document.hidden;
    }
    document.getElementById('f1-restart-btn').click();
    return {viewport:[innerWidth,innerHeight],joystickWidth:box.width,brakeWidth:brake.width};
  }
  const tyreTrial=(compound,surface='dry')=>{
    document.getElementById('btn-mode-f1race').click();
    const config=document.getElementById('gp-setup-screen');
    config.querySelector('[name="gp-session"][value="qualifying"]').checked=true;
    config.querySelector('#gp-surface').value=surface;
    config.querySelector('#gp-surface').dispatchEvent(new Event('change',{bubbles:true}));
    config.querySelector(`[name="gp-compound"][value="${compound}"]`).checked=true;
    config.querySelector('#gp-launch').click();
    updateF1Countdown(3.21);
    check(gpTyre.compound===compound&&gpTyre.surface===surface,'setup fits the selected compound and surface');
    gpTyre.temperature=F1Core.tyreWindow(compound);
    keys={KeyW:true};
    frame(prev+50);
    const launch=speed;
    const setSpeed=value=>{
      speed=value;
      velocityX=Math.sin(yaw)*value;
      velocityZ=Math.cos(yaw)*value;
    };
    setSpeed(65);
    keys={Space:true};
    frame(prev+50);
    const braking=65-speed;
    setSpeed(105);
    const heading=yaw;
    gpSteering=1;
    keys={ArrowRight:true};
    frame(prev+50);
    const turn=Math.abs(yaw-heading);
    returnToStartScreen();
    return {launch,braking,turn};
  };
  const soft=tyreTrial('soft'),medium=tyreTrial('medium'),hard=tyreTrial('hard');
  for(const stat of ['launch','braking','turn']){
    check(soft[stat]>medium[stat]&&medium[stat]>hard[stat],'dry compounds change actual player '+stat+': '+JSON.stringify({soft,medium,hard}));
  }
  const wet=tyreTrial('wet','wet'),wetSlick=tyreTrial('soft','wet');
  for(const stat of ['launch','braking','turn']){
    check(wet[stat]>wetSlick[stat],'full wets outperform slicks in the rain for '+stat);
  }

  for (const [laps, difficulty, compound,surface] of [[3,'easy','soft','dry'],[6,'pro','medium','dry'],[8,'legend','hard','dry'],[3,'pro','intermediate','damp'],[6,'legend','wet','wet']]) {
    document.getElementById('btn-mode-f1race').click();
    document.getElementById('gp-distance').value = laps;
    document.getElementById('gp-surface').value=surface;
    document.getElementById('gp-surface').dispatchEvent(new Event('change',{bubbles:true}));
    const stats=document.querySelector(`[name="gp-compound"][value="${compound}"]`).parentElement.querySelector('.gp-tyre-stats').textContent;
    const wear=Math.round(100*F1Core.tyreWearRate(compound,laps,surface));
    check(stats.includes('Wear '+wear+'%/lap'),'setup shows wear at the selected race length and surface');
    for (const [name,value] of [['difficulty',difficulty],['compound',compound],['session','championship']]) {
      document.querySelector('input[name="gp-'+name+'"][value="'+value+'"]').checked = true;
    }
    document.getElementById('gp-launch').click();
    check(f1CountdownActive && F1_TOTAL_LAPS === laps,'grid and distance');
    check(getComputedStyle(document.getElementById('f1-live-ranks')).display!=='none','desktop retains full live ranks');
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
    let sawPlayerSwap=false,sawRelease=false;
    do {
      if(gpPitPhase==='service')stationary+=.025;
      const oldYaw=yaw;
      if(!sawPlayerSwap&&gpPitPhase==='service'&&gpPitRemaining<1.18){
        updateF1Countdown(3.21);
        frame(prev+25);
        check(formulaPlayer.wheels.every(wheel=>!wheel.visible),'the render loop keeps all four detached player wheels hidden');
        check(gpPitCrew.every(crew=>crew.newWheel.visible)&&gpPitJack.visible,'the crew installs Formula wheels while the chassis is lifted');
        sawPlayerSwap=true;
      }else gpPitTick(.025);
      if(gpPitPhase==='service'&&gpPitCrew.every(crew=>crew.lamp.visible)){
        check(formulaPlayer.wheels.every(wheel=>wheel.visible)&&gpPitCrew.every(crew=>!crew.newWheel.visible),'the release lights only appear after the last new wheel seats');
        sawRelease=true;
      }
      transit+=.025;
      largestYawStep=Math.max(largestYawStep,Math.abs(Math.atan2(Math.sin(yaw-oldYaw),Math.cos(yaw-oldYaw))));
    } while(gpPitPhase!=='idle'&&transit<60);
    check(sawPlayerSwap&&sawRelease,'the player pit approach, service and release animate in order');
    check(largestYawStep<.20,'pit path does not snap the car heading');
    check(gpTyre.stops===1&&gpTyre.compound==='hard'&&gpTyre.wear===0&&gpTyre.temperature===F1Core.freshTyreTemperature('hard'),'tyre replacement and temperature reset');
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
    let sawRivalTyreSwap=false;
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
      if(!gpPlayerDone&&gpTyre.wear>=.45&&gpWallU>=GP_PIT_ENTRY&&gpWallU<=GP_PIT_LAST_ENTRY){
        F1Core.performPitStop(gpTyre,compound);
      }
      check(f1Bots.filter(bot=>bot.pit&&!bot.pit.done&&bot.u>=GP_PIT_BOX-1e-6).length<=1,'only one AI receives service at a time');
      const swapping=f1Bots.find(bot=>bot.pit&&!bot.pit.done&&bot.pit.service>1.15&&bot.pit.service<1.5);
      if(swapping){
        check(swapping.group.position.y>.15&&swapping.wheels.some(wheel=>!wheel.visible)&&gpPitCrew.some(member=>member.oldWheel.visible||member.newWheel.visible),'the shared crew animates the rival tyre swap');
        sawRivalTyreSwap=true;
      }
      check(f1Bots.every(bot=>!bot.pit?.done||bot.wheels.every(wheel=>wheel.visible)),'leaving rivals have all four replacement wheels visible');
      const order=f1Bots.slice().sort((a,b)=>b.progress-a.progress).map(b=>b.name).join(',');
      if(previousOrder&&order!==previousOrder)orderChanges++;
      previousOrder=order;
      for(const bot of f1Bots){
        check(Number.isFinite(bot.progress)&&Number.isFinite(bot.x),'AI navigation');
        if(bot.passTarget)passZones.add(Math.floor(bot.u*12));
      }
    }
    check(f1RaceFinished&&gpFinishRows.length===6&&gpCompleted===laps,'race classification '+JSON.stringify({laps,compound,surface,completed:gpCompleted,finished:f1RaceFinished,rows:gpFinishRows.length,wear:gpTyre.wear,progress:f1PlayerProgress,bots:f1Bots.map(b=>[b.lap,b.tyre.stops,b.tyre.wear])}));
    check(gpSeason.round>=1&&Object.values(gpSeason.totals).some(v=>v>=25),'championship scoring');
    check(orderChanges>0&&passZones.size>=3,'overtaking opportunities');
    check(f1Bots.every(b=>b.tyre.stops>0&&!b.pit),'each AI driver finishes a tyre change and rejoins');
    const topRivals=gpFinishRows.filter(row=>row.id!=='p').slice(0,2);
    check(topRivals.some(row=>row.name===hamilton.name)&&topRivals.some(row=>row.name===max.name),'Expected Hamilton and Verstappen in '+laps+'-lap '+surface+' race. '+JSON.stringify(gpFinishRows.map(r=>({name:r.name,time:r.finishTime,progress:r.progress}))));
    check(sawRivalTyreSwap,'at least one rival pit animation played');
    results.push({laps,difficulty,compound,surface,orderChanges,attackSectors:passZones.size,
      topRivals:topRivals.map(row=>row.name),rivalGapSeconds:Number(F1Core.timeBetween(topRivals[0],topRivals[1],gpReference).toFixed(2)),stops:f1Bots.map(b=>b.tyre.stops),serviceSeconds:stationary,pitSeconds:transit});
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
  check(f1Bots.every(b=>!b.group.visible),'solo qualifying');
  gpTimingU=gpDist=.9995;gpWallU=.0005;f1RaceTime=48;
  updateF1Race(.05);
  check(gpQualiTime>48&&f1RaceFinished&&gpFinishRows.length===6,'qualifying classification');
  check(document.querySelector('#f1-finish-overlay.open')&&!document.getElementById('gp-watch-replay')&&!document.getElementById('gp-replay-controls'),'qualifying results offer no replay');
  document.getElementById('f1-restart-btn').click();
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
  const leftTurn=turnWith('KeyA'),rightTurn=turnWith('KeyD');
  check(leftTurn>.02&&rightTurn<-.02&&Math.abs(leftTurn-turnWith('ArrowLeft'))<.00001&&Math.abs(rightTurn-turnWith('ArrowRight'))<.00001,'Open World keyboard steering uses the full turn rate and agrees with the arrow keys');
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

async function exerciseController(mobile) {
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const buttons=Array.from({length:17},()=>({pressed:false,value:0}));
  const vibration=[];
  const pad={index:0,id:'BRICKWAY test pad',mapping:'standard',axes:[0,0],buttons,
    vibrationActuator:{effects:['trigger-rumble'],playEffect:(effect,options)=>vibration.push({effect,options})}};
  const spare={index:1,id:'Spare standard pad',mapping:'standard',axes:[0,0],buttons:buttons.map(button=>({...button}))};
  let devices=[pad];
  const prior=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>devices});
  const step=()=>frame(prev+50);
  const press=index=>{
    buttons[index].pressed=true;buttons[index].value=1;step();
    buttons[index].pressed=false;buttons[index].value=0;step();
  };
  const navigate=id=>{
    for(let i=0;i<35&&document.activeElement.id!==id;i++)press(13);
    check(document.activeElement.id===id,'controller can reach '+id);
  };
  try{
    buttons[0].pressed=true;step();
    check(controllerPrompt.open&&!controllerEnabled&&document.body.classList.contains('controller-detected')&&getComputedStyle(document.querySelector('.controller-menu-legend')).display==='flex','controller detection turns on the legend and opens the prompt');
    buttons[0].pressed=false;step();
    press(1);
    check(!controllerPrompt.open&&!readDrivingPad(devices,pad),'declining keeps current controls');
    devices=[];step();devices=[pad];step();
    check(controllerPrompt.open,'reconnecting prompts again');
    press(0);
    check(controllerEnabled&&!controllerPrompt.open,'accepting enables the controller');
    if(document.querySelector('#fs-lock.open')){
      press(0);
      check(!document.querySelector('#fs-lock.open'),'controller can continue without fullscreen');
    }
    navigate('btn-mode-f1race');press(0);
    check(!document.getElementById('gp-setup-screen').hidden,'D-pad and confirm open Grand Prix setup');
    navigate('gp-distance');press(15);
    check(document.getElementById('gp-distance').value==='6'&&document.getElementById('gp-summary').textContent.includes('6 laps'),'controller selects race distance');
    navigate('gp-launch');press(0);
    check(gameStarted&&gameMode==='f1race'&&F1_TOTAL_LAPS===6,'controller launches the selected race');
    updateF1Countdown(3.3);
    check(!controllerLegend.hidden&&getComputedStyle(controllerLegend).display==='flex','F1 driving legend displays automatically');
    pad.axes[0]=.05;check(readDrivingPad(devices,pad).steer===0,'small stick noise stays in the deadzone');
    buttons[15].pressed=true;check(readDrivingPad(devices,pad).steer===1,'right D-pad steers in the same direction as a right stick input');
    buttons[15].pressed=false;
    buttons[7].value=1;check(!readDrivingPad(devices,pad).boost,'digital throttle does not trigger boost');
    buttons[7].value=.65;check(!readDrivingPad(devices,pad).boost,'analog throttle stays independent of boost');
    buttons[7].value=.97;check(readDrivingPad(devices,pad).boost,'full analog throttle activates boost');
    buttons[7].value=.85;check(readDrivingPad(devices,pad).boost,'trigger boost stays stable inside the hysteresis band');
    buttons[7].value=.76;check(!readDrivingPad(devices,pad).boost,'easing off the analog trigger disengages boost');
    pad.axes[0]=.75;buttons[7].value=.9;
    for(let i=0;i<10;i++)step();
    check(speed>5&&gpSteering>.1,'positive analog steering and acceleration drive the F1 car');
    check(vibration.some(entry=>entry.effect==='trigger-rumble'&&entry.options.rightTrigger>0&&entry.options.duration===120),'driving sends sustained trigger haptics');
    const before=speed;
    buttons[6].value=.9;step();
    check(speed<before,'left trigger brakes while the accelerator is held');
    pad.axes[0]=0;buttons[7].value=buttons[6].value=0;
    const compound=tyreNextSelect.value;press(4);
    check(tyreNextSelect.value!==compound&&document.getElementById('gp-next').value===tyreNextSelect.value,'left bumper cycles the active pit compound');
    gpTyre.wear=.5;press(5);
    check(gpPitPhase==='queued','right bumper requests a pit stop');
    press(5);
    check(gpPitPhase==='idle','right bumper cancels a pit request');
    press(9);check(settingsOpen&&gameplayAudioBlocked(),'Start pauses and silences driving audio');
    press(4);check(document.querySelector('.settings-tabs .active').dataset.tab==='controls','shoulder buttons switch settings tabs');
    navigate('set-controllerRumble');press(15);
    check(controllerRumbleOff,'controller vibration can be disabled with the controller');
    press(14);check(!controllerRumbleOff,'controller vibration can be re-enabled');
    const testButton=document.getElementById('test-controllerRumble');
    const status=document.getElementById('controller-rumble-status');
    const originalActuator=pad.vibrationActuator;
    const effects=[];
    pad.vibrationActuator={effects:['trigger-rumble','dual-rumble'],playEffect(type,options){
      effects.push({type,options});
      if(type==='trigger-rumble')return Promise.reject(new DOMException('Unsupported','NotSupportedError'));
      return Promise.resolve('complete');
    }};
    navigate('test-controllerRumble');press(0);
    await new Promise(resolve=>setTimeout(resolve,0));
    check(effects.map(e=>e.type).join(',')==='trigger-rumble,dual-rumble'&&status.textContent.includes('Test pulse sent'),'a rejected trigger effect falls back to handle rumble');
    for(let i=0;i<2;i++){
      rumbleAt=0;
      await controllerRumble(pad,performance.now(),.4,.5,120);
    }
    check(effects.map(e=>e.type).join(',')==='trigger-rumble,dual-rumble,trigger-rumble,dual-rumble,dual-rumble','repeat failures cool down while handle rumble keeps working');
    check(effects[1].options.duration===480&&effects[1].options.weakMagnitude>.95,'the settings pulse is long and strong');
    delete pad.vibrationActuator;
    const legacy=[];
    pad.hapticActuators=[{pulse:(strength,duration)=>{legacy.push({strength,duration});return Promise.resolve(true);}}];
    testButton.click();
    await new Promise(resolve=>setTimeout(resolve,0));
    check(legacy.length===1&&legacy[0].duration===480&&legacy[0].strength>.95&&status.textContent.includes('Test pulse sent'),'pulse-only controllers receive a settings test');
    delete pad.hapticActuators;
    testButton.click();
    await new Promise(resolve=>setTimeout(resolve,0));
    check(status.textContent.includes('does not pass vibration'),'the game explains when the browser exposes no haptics');
    pad.vibrationActuator=originalActuator;
    rumbleSession=null;rumbleAt=0;
    if(mobile){
      navigate('gp-phone-settings-tab');press(0);
      navigate('phone-hud-open');press(0);
      const handle=phoneHudHandles.find(item=>item.selector==='#tyre-logo-widget').handle;
      check(phoneHudEditor.open&&document.activeElement===handle,'controller opens the HUD editor');
      press(0);press(14);press(0);
      check(phoneHudDraft['#tyre-logo-widget'][0]<0,'controller places a HUD widget');
      navigate('phone-hud-save');press(0);
      check(!phoneHudEditor.open,'controller saves HUD changes');
    }
    press(1);check(!settingsOpen,'Back resumes gameplay');
    press(8);check(controllerActions.open,'View opens driving actions');
    const pausedRaceTime=f1RaceTime;step();
    check(f1RaceTime===pausedRaceTime,'driving actions pause the race');
    navigate('controller-switch-modes');press(0);
    check(!gameStarted&&!controllerActions.open,'controller switches modes');
    navigate('btn-mode-openworld');press(0);
    check(gameStarted&&gameMode==='openworld','controller starts Open World');
    press(8);navigate('controller-time-attack');press(0);
    check(raceOn&&!controllerActions.open,'controller starts Time Attack');
    buttons[2].pressed=true;check(readDrivingPad(devices,pad).handbrake,'face button maps to the handbrake');
    devices=[spare];step();
    check(!controllerEnabled&&settingsOpen&&controllerPrompt.open,'losing the active pad pauses even with a spare attached');
    devices=[];step();
    check(!controllerEnabled&&!controllerPrompt.open&&controllerLegend.hidden&&!readDrivingPad(devices,null),'disconnect releases the controller and hides its legend');
    devices=[pad,spare];step();
    const choices=document.getElementById('controller-choices');
    check(controllerPrompt.open&&!choices.hidden&&choices.children.length===2,'detection lists the two named controllers');
    press(13);press(13);press(13);press(0);
    check(controllerEnabled&&drivingController(devices)===spare,'D-pad can choose the second controller');
    devices=[];step();
    const generic={...pad,index:2,id:'Third-party USB pad',mapping:''};
    devices=[generic];step();
    check(controllerPrompt.open&&drivingController(devices)===generic,'a usable third-party pad with an empty mapping is detected');
    press(0);
    check(controllerEnabled&&readDrivingPad(devices,generic),'the generic pad can be enabled through its own buttons');
    return {raceLaps:6,controller:true,disconnected:true};
  }finally{
    if(prior)Object.defineProperty(navigator,'getGamepads',prior);
    else delete navigator.getGamepads;
  }
}

async function run() {
  const origin='http://brickway.test';
  const modes=process.argv.includes('--controller')?['controller','controller-mobile']:process.argv.includes('--mobile')?['mobile']:process.argv.includes('--city')?['city']:['race','mobile','city','controller','controller-mobile'];
  const threeRoot=process.env.THREE_ROOT||path.dirname(path.dirname(require.resolve('three')));
  const original=fs.readFileSync(process.env.BRICKWAY_TEST_HTML||path.join(__dirname,'index.html'),'utf8');
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
      const mobile=mode==='mobile'||mode==='controller-mobile';
      const page=await browser.newPage(mobile?{
        viewport:{width:932,height:480},isMobile:true,hasTouch:true,
        userAgent:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/132.0 Mobile Safari/537.36'
      }:{viewport:{width:960,height:540}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const exerciseCode=mode==='city'?exerciseCity.toString():mode.startsWith('controller')?exerciseController.toString():exercise.toString();
      const injection=`window.runBrickwayRegression=async()=>{
 const raf=window.requestAnimationFrame,render=renderGameScene;
 window.requestAnimationFrame=()=>0;
 renderGameScene=()=>{};
 try{return await (${exerciseCode})(${mobile});}
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
      if(mode==='mobile')await page.click('#fs-skip');
      const result=await page.evaluate(()=>window.runBrickwayRegression());
      if(mode==='mobile'){
        await page.tap('#settings-open');
        await page.click('#phone-hud-open');
        const handle=page.locator('[data-target="#tyre-logo-widget"]');
        const before=await handle.boundingBox();
        await page.mouse.move(before.x+before.width/2,before.y+before.height/2);
        await page.mouse.down();
        await page.mouse.move(before.x+before.width/2-80,before.y+before.height/2-20,{steps:4});
        await page.mouse.up();
        const after=await handle.boundingBox();
        assert.ok(Math.abs(after.x-before.x+80)<2&&Math.abs(after.y-before.y+20)<2,'pointer drag moves the pit panel in both directions');
        await page.click('#phone-hud-save');
      }
      assert.deepEqual(errors,[],mode+' browser errors');
      console.log(mode,JSON.stringify(result));
      await page.close();
    }
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
