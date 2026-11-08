import { Button } from '@/design-system/ventura-6bef42/components/ui/button';
import { Check, Lock, Target, Lightbulb, ChartNoAxesCombined, Users, UserPlus, Rocket, Coins, Presentation, Plane, ShoppingBag, TrendingUp, Trophy, Gift, ArrowDown } from 'lucide-react';
import { CHAPTERS, LEVELS, type Progress } from './journey-data';
import companion from '@/design-system/ventura-6bef42/assets/journey-companion.png';
const ICONS = [Target, Lightbulb, ChartNoAxesCombined, Users, UserPlus, Rocket, Coins, Presentation, Plane, ShoppingBag, TrendingUp, Trophy];
export function JourneyMap({progress,onSelect}:{progress:Progress;onSelect:(index:number)=>void}) {
  const points = LEVELS.map((_,i)=>({x: i%4 === 0 ? 300 : i%4 === 1 ? 470 : i%4 === 2 ? 310 : 145, y: 170+i*225}));
  const road = points.map((p,i)=>i===0?`M ${p.x} ${p.y}`:`C ${points[i-1].x} ${p.y-110}, ${p.x} ${p.y-110}, ${p.x} ${p.y}`).join(' ');
  return <div className="journey-world"><div className="journey-map-heading"><span className="journey-eyebrow">YOUR FOUNDER ADVENTURE</span><h1>Small steps. <span>Big ambitions.</span></h1><p>Every great company starts somewhere. This is your path.</p></div>
    <div className="journey-track">
      <svg className="journey-road" viewBox="0 0 620 3000" preserveAspectRatio="none" aria-hidden="true"><path d={road} className="road-shadow"/><path d={road} className="road-base"/><path d={road} className="road-dashes"/></svg>
      {CHAPTERS.map((c,i)=><div className={`chapter-marker chapter-${i}`} key={c.name} id={`chapter-${i}`}><span>0{i+1}</span><div><strong>{c.name}</strong><small>{c.subtitle}</small></div></div>)}
      {LEVELS.map((level,i)=>{ const Icon=ICONS[i]; const done=i<progress.completed; const active=i===progress.completed; return <div className={`journey-stop stop-${i%4} ${done?'is-done':active?'is-current':'is-locked'}`} id={`level-${i}`} key={level.title} style={{top:170+i*225}}>
        {active&&<div className="start-bubble">LET’S GO! <ArrowDown size={13}/></div>}
        <Button variant="ghost" className="level-node" aria-label={`Level ${i+1}: ${level.title}${done?', completed':active?', current':', locked'}`} onClick={()=>onSelect(i)}><Icon/>{done?<span className="node-status"><Check/></span>:!active?<span className="node-status"><Lock/></span>:null}</Button>
        <div className="level-label"><small>LEVEL {i+1} {done?'· COMPLETE':active?'· YOUR NEXT STEP':''}</small><strong>{level.short}</strong><span>{level.detail}</span>{active&&<em>+50 XP · 5 min</em>}</div>
        {i===2&&<img className="map-companion" src={companion} loading="lazy" width={1024} height={1024} alt="Pip, your startup adventure companion"/>}
        {(i===4||i===8)&&<div className="road-chest" title="Milestone reward"><Gift/><span>REWARD AHEAD</span></div>}
      </div>;})}
      <div className={`journey-summit ${progress.completed===12?'summit-complete':''}`} id="journey-summit"><div className="summit-trophy"><Trophy/></div><span className="journey-eyebrow">THE NEXT CHAPTER</span><h2>Ready for lift-off.</h2><p>Your fundraising adventure begins here.</p></div>
    </div>
  </div>;
}
