import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Bell, Check, Fire, ShieldCheck } from '@phosphor-icons/react';
import { tdee } from '@chudlog/shared';
import { api, type Me } from './types';
import { useData, useWrite, WriteFeedback } from './data';
import { t } from './i18n';
interface TodayData {date:string;restore:{date:string;month:string}|null;nudges:Array<{local_hour:number;status:string;attempts:number}>}
export function Accountability({me,onDone}:{me:Me;onDone?:()=>Promise<void>}) {
  const state=useData<TodayData>('/today');
  const write=useWrite(me.user.id,async()=>{await state.reload();await onDone?.();});
  const last=state.data?.nudges.at(-1);
  return <section className="accountability-strip"><div><Bell size={19}/><span><strong>{t('hourlyAccountability')}</strong><small>08:00–23:00 WIB · {last?`${last.local_hour}:00 ${last.status}`:t('noPushAttempts')}</small></span></div>{state.data?.restore&&<button className="secondary-button" disabled={write.busy} onClick={()=>void write.save('/streak/restore',{date:state.data!.restore!.date},t('streak'))}><Fire size={18}/>{t('restoreStreak')}</button>}<WriteFeedback {...write}/></section>;
}
export function PushControls({user}:{user:string}) {
  const state=useData<{configured:boolean;subscriptions:number}>('/push/status');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function enable() {
    setBusy(true);setMessage('');
    try {
      if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error(t('pushUnsupported'));
      if(!state.data?.configured)throw new Error(t('pushServerMissing'));
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error(t('pushPermissionDenied'));
      const {vapidPublicKey}=await api('/meta/vapid');
      const registration=await navigator.serviceWorker.ready;
      registration.active?.postMessage({type:'owner',user});
      const padded=vapidPublicKey+'='.repeat((4-vapidPublicKey.length%4)%4),binary=atob(padded.replace(/-/g,'+').replace(/_/g,'/'));
      const key=Uint8Array.from(binary,(ch:string)=>ch.charCodeAt(0));
      const sub=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      const json=sub.toJSON();await api('/push/subscribe',{endpoint:json.endpoint,keys:json.keys});await state.reload();setMessage(t('pushEnabled'));
    }catch(err){setMessage(err instanceof Error?err.message:t('error'));}finally{setBusy(false);}
  }
  async function test() {
    setBusy(true);try{const result=await api('/push/test',{});setMessage(`${result.accepted} ${t('pushAccepted')}`);}catch(err){setMessage(err instanceof Error?err.message:t('error'));}finally{setBusy(false);}
  }
  return <section className="settings-panel push-settings"><div className="section-heading"><h2>{t('notifications')}</h2><Bell size={22}/></div><p>{t('pushExplanation')}</p><p className="field-note">{t('iosInstall')}</p><p>{state.data?.subscriptions??0} {t('registeredDevices')}</p><div className="button-row"><button className="secondary-button" disabled={busy} onClick={()=>void enable()}>{t('enablePush')}</button><button className="subtle-button" disabled={busy||!state.data?.subscriptions} onClick={()=>void test()}>{t('testPush')}</button></div><p role="status" className="field-note">{message}</p></section>;
}
export function GoalSettings({me,onDone}:{me:Me;onDone:()=>Promise<void>}) {
  const [mode,setMode]=useState(me.user.calorie_goal_mode??'maintain'),[warning,setWarning]=useState('');
  const write=useWrite(me.user.id,onDone);
  const profile=me.user;
  const calculatedWarning=(profile.sex==='m'||profile.sex==='f')&&profile.bodyweight_kg&&profile.height_cm&&profile.age&&profile.calorie_goal!==null?tdee.belowBmrWarning(tdee.bmrMifflin(profile.sex,profile.bodyweight_kg,profile.height_cm,profile.age),profile.calorie_goal):null;
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setWarning('');
    const f=new FormData(event.currentTarget),plates=String(f.get('plates')).split(',').map(item=>Number(item.trim())).filter(value=>value>0);
    const body={sex:f.get('sex')||null,age:f.get('age')?Number(f.get('age')):null,height_cm:f.get('height')?Number(f.get('height')):null,activity_factor:f.get('activity'),calorie_goal_mode:mode,...(mode==='custom'?{calorie_goal:Number(f.get('calories'))}:{}),bar_weight_kg:Number(f.get('bar')),plates_kg:plates};
    await write.save('/me',body,t('profile'),'PUT');
  }
  return <section className="settings-panel goals-settings"><h2>{t('goalsEquipment')}</h2><p className="field-note">{t('sensitiveInputs')}</p><form onSubmit={save}><div className="form-columns"><label>{t('sexForCalculation')}<select name="sex" defaultValue={me.user.sex??''}><option value="">{t('notSet')}</option><option value="m">{t('male')}</option><option value="f">{t('female')}</option></select></label><label>{t('age')}<input name="age" type="number" min="1" max="120" defaultValue={me.user.age??''}/></label></div><label>{t('heightCm')}<input name="height" type="number" min="90" max="250" defaultValue={me.user.height_cm??''}/></label><label>{t('activityFactor')}<select name="activity" defaultValue={String(me.user.activity_factor??1.375)}>{[1.2,1.375,1.55,1.725,1.9].map(factor=><option key={factor}>{factor}</option>)}</select></label><label>{t('calorieMode')}<select value={mode} onChange={e=>setMode(e.target.value)}>{['maintain','mild','loss','extreme','custom'].map(mode=><option key={mode} value={mode}>{t(mode as 'maintain'|'mild'|'loss'|'extreme'|'custom')}</option>)}</select></label>{mode==='custom'&&<label>{t('calories')}<input name="calories" required type="number" min="1" max="20000" defaultValue={me.user.calorie_goal??''}/></label>}<div className="form-columns"><label>{t('barWeight')}<input name="bar" type="number" min="0" max="50" step="0.5" defaultValue={me.user.bar_weight_kg??20} required/></label><label>{t('plateDenominations')}<input name="plates" defaultValue={(me.user.plates_kg??[20,10,5,2.5,1.25]).join(', ')}/></label></div><button className="primary" disabled={write.busy}>{t('saveGoals')}<ArrowRight size={20}/></button><WriteFeedback {...write}/>{(calculatedWarning||warning)&&<p className="warning-line">{calculatedWarning||warning}</p>}</form></section>;
}
export function ProfileSummary() {
  const summary=useData<{lit_days:number;consistency_90:number;sleep_30:{average_duration_min:number|null;green_percent:number|null};gym:{workouts:number;total_volume:number;top_prs:Array<{exercise:string;e1rm:number}>}}>('/me/summary');
  if(!summary.data)return null;const data=summary.data;
  return <section className="settings-panel profile-summary"><div className="section-heading"><h2>{t('yourRecord')}</h2><a className="subtle-button" href="/api/me/export" download>{t('exportMyData')}</a></div><div className="member-summary-grid"><div><b>{data.lit_days}</b><span>{t('litDays')}</span></div><div><b>{data.consistency_90}%</b><span>{t('consistency')}</span></div><div><b>{data.gym.workouts}</b><span>{t('workouts')}</span></div><div><b>{Math.round(data.gym.total_volume).toLocaleString()}</b><span>{t('volume')} (kg)</span></div></div><p>{t('averageNight')}: {data.sleep_30.average_duration_min??'–'} min · {t('greenNights')}: {data.sleep_30.green_percent??'–'}%</p><div className="pr-list">{data.gym.top_prs.map(pr=><div key={pr.exercise}><span>{pr.exercise}</span><strong>{pr.e1rm} kg</strong></div>)}</div></section>;
}
export function PlateCalculator({me}:{me:Me}) {
  const bar=me.user.bar_weight_kg??20,plates=[...new Set(me.user.plates_kg??[20,10,5,2.5,1.25])].sort((a,b)=>b-a);
  const [target,setTarget]=useState(60);
  let remaining=Math.max(0,(target-bar)/2);const needed:Array<{plate:number;count:number}>=[];
  for(const plate of plates){const count=Math.floor((remaining+.00001)/plate);if(count){needed.push({plate,count});remaining-=plate*count;}}
  return <details className="plate-calculator"><summary>{t('plateCalculator')}</summary><label>{t('targetWeight')}<input type="number" min={bar} max="1000" step="0.5" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label><p>{bar} kg {t('barWeight')} · {t('eachSide')}: {needed.map(row=>`${row.count} × ${row.plate} kg`).join(' + ')||t('emptyBar')}</p>{remaining>0.001&&<p className="warning-line">{t('plateRemainder')}: {Math.round(remaining*2*100)/100} kg</p>}<p className="field-note">{t('plateAssumption')}</p></details>;
}
