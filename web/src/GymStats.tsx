import { useState } from 'react';
import { calendar } from '@chudlog/shared';
import { useData } from './data';
import { wibDate } from './queue';
import { t } from './i18n';
interface Point {label:string;value:number}
interface Stats {workouts:number;total_volume:number;total_sets:number;heatmap:Array<{date:string;volume:number;sets:number}>;muscles:Point[];weekly_muscles:Record<string,Record<string,number>>;weekly_volume:Point[];effort:Point[];structural:Point[];e1rm:Record<string,Array<{date:string;e1rm:number}>>;prs:Array<{exercise:string;e1rm:number;date:string}>;notes:string[]}
export function Bars({data}:{data:Point[]}) {
  const max=Math.max(1,...data.map(point=>point.value));
  return <div className="chart-bars">{data.map(point=><div key={point.label}><span>{point.label}</span><div><i style={{width:`${point.value/max*100}%`}}/></div><b>{Math.round(point.value*10)/10}</b></div>)}</div>;
}
export function Line({data,title=t('estimatedMax'),unit='kg'}:{data:Array<{label:string;value:number}>;title?:string;unit?:string}) {
  if(!data.length)return <p className="empty-copy">{t('noChartData')}</p>;
  const min=Math.min(...data.map(p=>p.value)),max=Math.max(...data.map(p=>p.value));
  const coords=data.map((p,i)=>`${28+i/Math.max(1,data.length-1)*544},${155-(p.value-min)/Math.max(1,max-min)*120}`);
  return <svg className="line-chart" viewBox="0 0 600 190" role="img" aria-label={title}><path d="M28 35H572M28 95H572M28 155H572" stroke="#ffffff12" fill="none"/><polyline fill="none" stroke="#ff8d48" strokeWidth="3" points={coords.join(' ')}/>{data.map((p,i)=><circle key={`${p.label}-${i}`} cx={coords[i]!.split(',')[0]} cy={coords[i]!.split(',')[1]} r="4" fill="#ffb27e"><title>{p.label}: {p.value}</title></circle>)}<text x="28" y="184">{data[0]!.label}</text><text x="572" y="184" textAnchor="end">{data.at(-1)!.label}</text><text x="28" y="20">{Math.round(max*10)/10} {unit}</text></svg>;
}
export function GymStats() {
  const [range,setRange]=useState(365),[exercise,setExercise]=useState('');
  const stats=useData<Stats>(`/gym/stats?range=${range}`);
  const data=stats.data,selected=exercise||(data?Object.keys(data.e1rm)[0]:undefined);
  const heat=new Map(data?.heatmap.map(day=>[day.date,day]));
  return <><div className="section-heading"><h2>{t('trainingStats')}</h2><select aria-label={t('statisticsRange')} className="range-select" value={range} onChange={e=>setRange(Number(e.target.value))}>{[30,90,365].map(days=><option key={days} value={days}>{days} {t('days')}</option>)}</select></div>{stats.error&&<p className="error">{stats.error}</p>}<div className="stats-totals"><div><b>{data?.workouts??0}</b><span>{t('workouts')}</span></div><div><b>{Math.round(data?.total_volume??0).toLocaleString()}</b><span>{t('volume')} (kg)</span></div><div><b>{data?.total_sets??0}</b><span>{t('workingSets')}</span></div></div>
    <section className="chart-panel"><h3>{t('activityHeatmap')}</h3><p>{t('heatmapHelp')}</p><div className="activity-heatmap" role="img" aria-label={t('activityHeatmap')}>{Array.from({length:range},(_,index)=>{const date=calendar.shiftLocalDate(wibDate(),-range+index+1,'Asia/Jakarta'),day=heat.get(date);return <span key={date} data-active={Boolean(day)} style={{opacity:day?Math.min(1,.3+day.sets/20):1}} title={`${date}: ${day?.sets??0} ${t('workingSets')}, ${Math.round(day?.volume??0)} kg`}/>;})}</div></section>
    <div className="charts-grid"><section className="chart-panel"><h3>{t('muscleBalance')}</h3><Bars data={data?.muscles??[]}/></section><section className="chart-panel"><h3>{t('weeklyVolume')}</h3><Bars data={data?.weekly_volume??[]}/></section>
      <section className="chart-panel"><h3>{t('exerciseTrend')}</h3><select aria-label={t('exercise')} value={selected??''} onChange={e=>setExercise(e.target.value)}><option value="">{t('chooseExercise')}</option>{Object.keys(data?.e1rm??{}).map(name=><option key={name}>{name}</option>)}</select><Line data={selected?(data?.e1rm[selected]??[]).map(point=>({label:point.date,value:point.e1rm})):[]}/></section>
      <section className="chart-panel"><h3>{t('effortDistribution')}</h3><Bars data={data?.effort??[]}/><p>{t('rirExplanation')}</p></section><section className="chart-panel"><h3>{t('structuralBalance')}</h3><Bars data={data?.structural??[]}/></section>
      <section className="chart-panel"><h3>{t('prHistory')}</h3><div className="pr-list">{data?.prs.slice(0,30).map((pr,index)=><div key={`${pr.exercise}-${index}`}><span>{pr.exercise}<small>{pr.date}</small></span><strong>{pr.e1rm} kg</strong></div>)}</div>{!data?.prs.length&&<p className="empty-copy">{t('noPrs')}</p>}</section></div>
    <section className="chart-panel"><h3>{t('weeklyMuscleVolume')}</h3>{Object.entries(data?.weekly_muscles??{}).map(([week,muscles])=><details key={week}><summary>{week}</summary><Bars data={Object.entries(muscles).map(([label,value])=>({label,value}))}/></details>)}</section><div className="stats-notes">{data?.notes.map(note=><p key={note}>{note}</p>)}</div>
  </>;
}
