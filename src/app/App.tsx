import {DEFAULT_DUEL_DISTANCE,type DuelDistance} from '../config/duel';
import {useEffect,useRef,useState} from 'react';
import {BUILD_LABEL} from '../config/version';
import {Canvas} from '@react-three/fiber';
import type {GameEngine} from '../core/GameEngine';
import type {InitialPose} from '../config/behaviour';
import {loadGameRuntime,type GameRuntime} from '../core/GameRuntime';
import {GameErrorBoundary} from '../ui/GameErrorBoundary';
import {SimulationLoop} from '../core/SimulationLoop';
import {AudioSystem} from '../core/AudioSystem';
import {modelAssets,useAssetFailures,type AssetStatus} from '../rendering/AssetModels';
import {Scene} from '../rendering/Scene';
import {DebugPanel} from '../ui/DebugPanel';
import {DuelHUD} from '../ui/DuelHUD';
import {DEFAULT_DEBUG_SETTINGS,type DebugSettings} from '../rendering/DebugSettings';
const audio=new AudioSystem();
const CAMERA={position:[3,2.1,6] as [number,number,number],fov:34,near:.04,far:150};
export function App(){
 const [duelDistance,setDuelDistance]=useState<DuelDistance>(DEFAULT_DUEL_DISTANCE);
 const runtime=useRef<GameRuntime|null>(null);
 const assetFailures=useAssetFailures();
 const [session,setSession]=useState<{engine:GameEngine;loop:SimulationLoop}|null>(null);
 const [debug,setDebug]=useState(false),[active,setActive]=useState(true),[,refresh]=useState(0);
 const [mode,setMode]=useState<'lab'|'duel'>('lab'),[view,setView]=useState<'front'|'side'|'back'>('front');
 const [error,setError]=useState('');
 const [modelStatus,setModelStatus]=useState<AssetStatus>('loading');
 const [muted,setMuted]=useState(false);
 const [settings,setSettings]=useState<DebugSettings>({...DEFAULT_DEBUG_SETTINGS});
 useEffect(()=>{
  let live=true;
  loadGameRuntime().then(loaded=>{if(live){runtime.current=loaded;const engine=loaded.createEngine(1,'standing','lab');setSession({engine,loop:new SimulationLoop(engine)})}}).catch(error=>setError(String(error)));
  const timer=setInterval(()=>refresh(t=>t+1),100);
  return()=>{live=false;clearInterval(timer)};
 },[]);
 function reset(nextMode=mode,initialPose:InitialPose=nextMode==='duel'?'standing':session?.engine.initialPose??'standing',distance=duelDistance){
  if(!session||!runtime.current)return;
  const engine=runtime.current.createEngine(session.engine.seed,initialPose,nextMode,nextMode==='duel'?distance:DEFAULT_DUEL_DISTANCE);engine.mode=nextMode;engine.rig.energyMode=nextMode===mode?session.engine.rig.energyMode:nextMode==='duel'?'LOW':'HIGH';
  engine.rig.active=initialPose==='supine'||nextMode==='duel'?true:active;
  if(initialPose==='supine'){setActive(true);engine.rig.aiming=nextMode==='lab'}
  const loop=new SimulationLoop(engine);
  loop.timeScale=nextMode===mode?session.loop.timeScale:1;
  setSession({engine,loop});
 }
 function changeDistance(distance:DuelDistance){if(session?.engine.rules.phase!=='idle'||distance===duelDistance)return;setDuelDistance(distance);reset('duel','standing',distance)}
 function changeMode(next:'lab'|'duel'){if(next===mode)return;setMode(next);setDebug(false);reset(next,'standing')}
 function toggleDebug(){if(!debug&&mode==='duel'&&session)session.loop.paused=true;setDebug(d=>!d)}
 function pause(){if(session){session.loop.paused=!session.loop.paused;refresh(t=>t+1)}}
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement;
   if(target?.isContentEditable||target?.matches?.('input,textarea,select')||event.repeat)return;
   if(event.code==='Space'&&target?.closest?.('button'))return;
   if(['KeyD','KeyR','KeyP'].includes(event.code))event.preventDefault();
   if(event.code==='KeyD')toggleDebug();
   if(event.code==='KeyR')reset();
   if(event.code==='KeyP')pause();
   if(event.code==='Space'&&mode==='lab'){event.preventDefault();session?.engine.rig.queue(()=>session.engine.rig.impulse(25))}
  };
  const blur=()=>{if(session){session.loop.paused=true;refresh(t=>t+1)}};
  const visibility=()=>{if(document.hidden)blur()};
  window.addEventListener('keydown',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility)};
 },[session,mode,active,debug]);
 useEffect(()=>{
  if(!session)return;
  const offShot=session.engine.events.on('shot',shot=>{audio.shot(shot.origin.z<session.engine.duelDistance/2);refresh(t=>t+1)});
  const offPhase=session.engine.events.on('phaseChanged',event=>{if(event.to==='signal')audio.signal();else if(event.to==='won'||event.to==='lost')audio.result(event.to==='won'?true:event.to==='lost'?false:null);refresh(t=>t+1)});
  const offAction=session.engine.events.on('playerAction',event=>{if(event.action==='draw')audio.draw();else if(event.action==='empty')audio.dry();refresh(t=>t+1)});
  return()=>{offShot();offPhase();offAction()};
 },[session]);
 const engine=session?.engine,rig=engine?.rig,paused=session?.loop.paused??false;
 return <main className={mode==='duel'?'duel-mode':''} onPointerDown={()=>audio.unlock()}><header><a className="brand" href="#" onClick={e=>e.preventDefault()}>LAST DRAW<span>ACTIVE RAGDOLL / {BUILD_LABEL}</span></a><nav><button className={mode==='lab'?'current':''} onClick={()=>changeMode('lab')}>Лаборатория</button><button className={mode==='duel'?'current':''} onClick={()=>changeMode('duel')}>Дуэль ↗</button></nav><div className="header-actions"><button className="sound-toggle" aria-label={muted?'Включить звук':'Выключить звук'} aria-pressed={!muted} onClick={()=>{audio.muted=!muted;setMuted(!muted)}}>{muted?'Звук выкл.':'Звук вкл.'}</button><button className="outline" onClick={toggleDebug}>⌘ &nbsp; Диагностика <kbd>D</kbd></button></div></header>{mode==='lab'&&<div className="title"><div className="eyebrow">ЛАБОРАТОРИЯ / ACTIVE RAGDOLL</div><h1>Сила. Равновесие.<br/><em>Последний шанс.</em></h1><p>Виртуальные мышцы. Реальная опора.<br/>Падение — следствие физики и повреждений.</p></div>}<div className="canvas">{session?<GameErrorBoundary key="renderer" onError={()=>{session.loop.paused=true;session.engine.dispose();setSession(null);setError('Ошибка графики или сцены. Повторите запуск; проверьте WebGL и аппаратное ускорение, если ошибка сохраняется.')}}><Canvas shadows dpr={[1,1.5]} camera={CAMERA} onCreated={({camera})=>camera.lookAt(0,.9,0)}><Scene engine={session.engine} loop={session.loop} debug={debug} duel={mode==='duel'} settings={settings} view={view} onAssetStatus={setModelStatus} weaponProfile={session.engine.rig.energyMode}/></Canvas></GameErrorBoundary>:<div className="loading" role="status">{error?<div><strong>Не удалось запустить игру</strong><p>{error}</p><button className="primary" onClick={()=>window.location.reload()}>Повторить запуск</button></div>:'Загрузка физики…'}</div>}</div>{session&&(!settings.mannequin&&modelStatus!=='ready'||assetFailures.failedUrls.length>0)&&<div className={'asset-status '+(assetFailures.failedUrls.length?'error':'')} role="status">{assetFailures.failedUrls.length?<>{'Часть моделей не загрузилась. Показана упрощённая графика. '}<button onClick={modelAssets.retry}>Повторить загрузку</button></>:modelStatus==='loading'?'Загрузка модели противника…':'Модель не загрузилась.'}</div>}{engine&&session&&<>{mode==='lab'?<><div className="scene-label"><span className="plus">+</span> SUBJECT 01 <small>16 SEGMENTS / {rig!.parts.reduce((s,p)=>s+p.mass,0).toFixed(1)} KG</small></div><aside><div className="eyebrow">КОНТРОЛЬ СИМУЛЯЦИИ</div><h2>Испытание равновесия</h2><p className="verified">✓ Стойка 30 с · восстановление после импульса</p><p>Проверьте реакцию тела. Откройте диагностику для тестовых попаданий и пробития.</p><div className="switchrow"><span>Виртуальные мышцы<small>Quaternion PD · bounded torque</small></span><button className={'switch '+(active?'on':'')} aria-label="Переключить мышцы" aria-pressed={active} onClick={()=>{setActive(!active);rig!.active=!active}}><i/></button></div><button className="secondary" disabled={!rig!.grip.holstered} onClick={()=>{rig!.aiming=true;rig!.draw.request(rig!.time)}}>{rig!.grip.holstered?'Достать револьвер из кобуры':'Револьвер в руке / освобождён'}</button><button className="primary" onClick={()=>rig!.queue(()=>rig!.impulse(25))}>↗ &nbsp; Импульс в грудь <kbd>SPACE</kbd></button><button className="secondary" onClick={()=>rig!.queue(()=>rig!.impulse(60))}>Сильный импульс <span>60 N·s</span></button><div className="duo"><button onClick={pause}>{paused?'▶ Продолжить':'Ⅱ Пауза'}</button><button onClick={()=>reset()}>↻ Сброс <kbd>R</kbd></button></div><div className="divider"/><div className="eyebrow">ТЕЛЕМЕТРИЯ В РЕАЛЬНОМ ВРЕМЕНИ</div><dl><div><dt>Время симуляции</dt><dd>{rig!.time.toFixed(2)} <small>s</small></dd></div><div><dt>Общий такт / подшаги</dt><dd>120 <small>Hz × 4</small></dd></div><div><dt>Опора стоп</dt><dd>{rig!.contacts} <small>/ 2</small></dd></div><div><dt>Высота таза</dt><dd>{rig!.parts[0].body.translation().y.toFixed(3)} <small>m</small></dd></div></dl><div className="status"><i/>{paused?'Симуляция приостановлена':!rig!.active?'Пассивная динамика':rig!.balance.state==='falling'?'На земле':rig!.balance.state==='recovering'?'Восстановление баланса':'Активное управление'}</div>{debug&&<DebugPanel engine={engine} loop={session.loop} settings={settings} onSettingsChange={setSettings} onChange={()=>refresh(t=>t+1)} onGroundScenario={()=>reset(mode,'supine')}/>}<button className="secondary" onClick={()=>changeMode('duel')}>Испытать в дуэли <span>↗</span></button></aside></>:<><DuelHUD engine={engine} onDistanceChange={changeDistance} reset={()=>reset(mode,'standing')} skip={()=>engine.start(true)}/>{debug&&<aside className="duel-debug"><button className="secondary" onClick={()=>{if(engine.rules.phase==='idle')engine.start(true);else if(engine.rules.phase==='waiting')engine.rules.signalAt=engine.rules.elapsed}}>Пропустить ожидание</button><DebugPanel engine={engine} loop={session.loop} settings={settings} onSettingsChange={setSettings} onChange={()=>refresh(t=>t+1)} onGroundScenario={()=>reset(mode,'supine')}/></aside>}</>}{paused&&mode==='duel'&&(!engine?.rules.terminal||!engine.rules.resultVisible)&&<div className="pause-card"><strong>Пауза</strong><p>Выстрелы не принимаются.<br/>В диагностике доступен один такт.</p><button className="primary" onClick={pause}>Продолжить</button></div>}</>}<footer><span><i/> RAPIER PHYSICS <b>FIXED Δt · 1/120 s × 4</b></span><div className="views">{mode==='lab'?<><button className={view==='front'?'selected':''} onClick={()=>setView('front')}>01 / ОБЩИЙ ВИД</button><button className={view==='side'?'selected':''} onClick={()=>setView('side')}>02 / ПРОФИЛЬ</button><button className={view==='back'?'selected':''} onClick={()=>setView('back')}>03 / СПИНА</button></>:<span>ЛКМ · ДОСТАТЬ / ВЫСТРЕЛ &nbsp; ПКМ · ПРИЦЕЛ &nbsp; P · ПАУЗА</span>}</div><span>BUILD <strong>{BUILD_LABEL}</strong></span></footer></main>
}
