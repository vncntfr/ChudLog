import { useState, type ChangeEvent } from 'react';
import { ArrowRight, FileArrowUp, FloppyDisk, Play, Trash } from '@phosphor-icons/react';
import type { Me } from './types';
import { api } from './types';
import { GymLogger, type ExerciseDraft } from './Loggers';
import { StrengthLadder } from './StrengthLadder';
import { GymStats } from './GymStats';
import { useData, useWrite, WriteFeedback } from './data';
import { submitWrite } from './queue';
import { t } from './i18n';
export function GymWorkspace({me,onDone}:{me:Me;onDone:()=>Promise<void>}) {
  const [tab,setTab]=useState<'log'|'stats'|'ladder'|'import'>('log');
  return <><div className="feature-tabs" aria-label={t('gymSections')}>{(['log','stats','ladder','import'] as const).map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{t(item==='log'?'trainingLog':item==='stats'?'trainingStats':item==='ladder'?'ladderA':'importWorkouts')}</button>)}</div><div hidden={tab!=='log'}><GymLogger me={me} onDone={onDone}/></div>{tab==='stats'&&<GymStats/>}{tab==='ladder'&&<StrengthLadder/>}{tab==='import'&&<ImportWorkouts me={me} onDone={onDone}/>}</>;
}
interface Routine {id:string;name:string;kind:string;weekday:number|null;sequence:number|null;exercises:Array<{exercise:string;muscle:string;sets:Array<{kg:number|null;reps:number;rir?:string;warmup?:boolean}>}>}
export function RoutineControls({me,blocks,choose}:{me:Me;blocks:ExerciseDraft[];choose:(blocks:ExerciseDraft[])=>void}) {
  const routines=useData<{routines:Routine[];suggested:Routine|null}>('/gym/routines');
  const [editing,setEditing]=useState<string|null>(null);
  const [name,setName]=useState(''),[kind,setKind]=useState<'weekday'|'rotation'>('weekday'),[weekday,setWeekday]=useState(1),[sequence,setSequence]=useState(0);
  const write=useWrite(me.user.id,routines.reload);
  function start(routine:Routine){choose(routine.exercises.map(block=>({...block,sets:block.sets.map(set=>({kg:set.kg===null?'':String(set.kg),reps:String(set.reps),rir:set.rir??'',warmup:!!set.warmup}))})));}
  async function save() {
    if(!name.trim())return;
    await write.save('/gym/routines',{...(editing?{id:editing}:{}),name,kind,...(kind==='weekday'?{weekday}:{sequence}),exercises:blocks.map(block=>({...block,sets:block.sets.map(set=>({kg:set.kg===''?null:Number(set.kg),reps:Number(set.reps),...(set.rir?{rir:set.rir}:{}),warmup:set.warmup}))}))},t('routines'));
  }
  return <section className="routine-section"><div className="section-heading"><h3>{t('routines')}</h3><span>{t('planningOnly')}</span></div>{routines.data?.suggested&&<p className="field-note">{t('suggestedRoutine')}: {routines.data.suggested.name}</p>}{routines.data?.routines.map(routine=><div className="routine-row" key={routine.id}><button className="subtle-button" onClick={()=>start(routine)}><Play size={15}/>{routine.name}</button><button className="subtle-button" onClick={()=>{start(routine);setEditing(routine.id);setName(routine.name);setKind(routine.kind as 'weekday'|'rotation');setWeekday(routine.weekday??1);setSequence(routine.sequence??0);}}>{t('edit')}</button><span>{routine.kind==='weekday'?`${t('weekday')} ${routine.weekday}`:`${t('rotation')} ${routine.sequence}`}</span><button className="icon-button" aria-label={`${t('deleteRoutine')} ${routine.name}`} onClick={()=>void write.save(`/gym/routines/${routine.id}`,{},t('routines'),'DELETE')}><Trash size={15}/></button></div>)}
    <details open={editing?true:undefined}><summary>{t('saveCurrentRoutine')}</summary>{editing&&<button className="subtle-button" onClick={()=>{setEditing(null);setName('');}}>{t('cancelEdit')}</button>}<label>{t('routineName')}<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label><div className="form-columns"><label>{t('schedule')}<select value={kind} onChange={e=>setKind(e.target.value as 'weekday'|'rotation')}><option value="weekday">{t('weekday')}</option><option value="rotation">{t('rotation')}</option></select></label>{kind==='weekday'?<label>{t('weekday')}<select value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{[1,2,3,4,5,6,7].map(day=><option key={day} value={day}>{t((['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const)[day-1]!)}</option>)}</select></label>:<label>{t('rotationOrder')}<input type="number" min="0" max="100" value={sequence} onChange={e=>setSequence(Number(e.target.value))}/></label>}</div><button className="secondary-button" disabled={write.busy||!name.trim()} onClick={()=>void save()}><FloppyDisk size={17}/>{t(editing?'updateRoutine':'saveRoutine')}</button><p className="field-note">{t('routineTargets')}</p></details><WriteFeedback {...write}/></section>;
}
interface ImportReport {id:string;status:string;rows:number;workouts:Array<{date:string;exercises:unknown[]}>;errors:Array<{row:number;message:string}>;skipped:Array<{row:number;message:string}>;conflicts:string[];assumed_timezone:string}
function ImportWorkouts({me,onDone}:{me:Me;onDone:()=>Promise<void>}) {
  const [source,setSource]=useState<'hevy'|'strong'>('hevy'),[report,setReport]=useState<ImportReport|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[skipped,setSkipped]=useState(false),[conflicts,setConflicts]=useState(false),[message,setMessage]=useState('');
  async function select(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];if(!file)return;
    setError('');setReport(null);setMessage('');setBusy(true);setSkipped(false);setConflicts(false);
    try {
      if(file.size>5*1024*1024)throw new Error(t('csvTooLarge'));
      const response=await fetch(`/api/gym/import/${source}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'text/csv'},body:await file.text()});
      const data=await response.json();if(!response.ok)throw new Error(data.error??t('error'));setReport(data);
    }catch(err){setError(err instanceof Error?err.message:t('error'));}finally{setBusy(false);}
  }
  async function confirm() {
    if(!report)return;setBusy(true);setError('');
    try {
      const status=await submitWrite(me.user.id,`/gym/import/${source}/confirm`,{id:report.id,skip_conflicts:conflicts,accept_skipped:skipped},t('importWorkouts'));
      setMessage(t(status==='synced'?'importComplete':'logQueued'));if(status==='synced'){setReport({...report,status:'confirmed'});await onDone();}
    }catch(err){setError(err instanceof Error?err.message:t('error'));}finally{setBusy(false);}
  }
  return <section className="entry-panel import-panel"><h2>{t('importWorkouts')}</h2><p>{t('importWarning')}</p><label>{t('exportSource')}<select value={source} disabled={busy} onChange={e=>{setSource(e.target.value as 'hevy'|'strong');setReport(null);}}><option value="hevy">Hevy</option><option value="strong">Strong</option></select></label><label className="file-picker"><FileArrowUp size={30}/>{t('chooseCsv')}<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void select(e)}/></label>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="save-status" role="status">{message}</p>}{report&&<div className="import-report"><h3>{t('importPreview')}</h3><p>{report.rows} {t('csvRows')} · {report.workouts.length} {t('workoutDays')}</p><p>{report.assumed_timezone}</p><div className="import-days">{report.workouts.map(workout=><div key={workout.date}><strong>{workout.date}</strong><span>{workout.exercises.length} {t('exercises')}{report.conflicts.includes(workout.date)?` · ${t('existingDay')}`:''}</span></div>)}</div>{report.errors.map((row,index)=><p className="error" key={index}>{t('row')} {row.row}: {row.message}</p>)}{report.skipped.map((row,index)=><p className="field-note" key={index}>{t('row')} {row.row}: {row.message}</p>)}<label className="consent"><input type="checkbox" checked={skipped} onChange={e=>setSkipped(e.target.checked)}/>{t('acceptSkipped')}</label><label className="consent"><input type="checkbox" checked={conflicts} onChange={e=>setConflicts(e.target.checked)}/>{t('skipConflicts')}</label><button className="primary" disabled={busy||report.status==='confirmed'||!!report.errors.length||!report.workouts.length||!!report.skipped.length&&!skipped||!!report.conflicts.length&&!conflicts} onClick={()=>void confirm()}>{t(report.status==='confirmed'?'importComplete':'confirmImport')}<ArrowRight size={20}/></button></div>}
  </section>;
}
