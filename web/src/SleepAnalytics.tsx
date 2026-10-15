import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Check, Minus } from '@phosphor-icons/react';
import { t } from './i18n';
import { clockTime, durationText, monthDays, shiftMonth, sleepChecks, sleepDays, type SleepNight } from './sleep-data';

const colors=['green','yellow','red'] as const;
export function SleepAnalytics({entries,today}:{entries:SleepNight[];today:string}) {
  const [month,setMonth]=useState(today.slice(0,7)),[range,setRange]=useState(30),[selected,setSelected]=useState(today);
  const chartScroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{const chart=chartScroll.current;if(chart)chart.scrollLeft=chart.scrollWidth;},[range,entries]);
  const lookup=useMemo(()=>new Map(entries.map(night=>[night.date,night])),[entries]);
  const days=useMemo(()=>sleepDays(entries,today,range),[entries,today,range]);
  const recorded=days.flatMap(day=>day.night?[day.night]:[]),night=lookup.get(selected);
  const counts=colors.map(color=>({color,count:recorded.filter(night=>night.color===color).length}));
  const maxHours=Math.max(12,Math.ceil(Math.max(0,...recorded.map(night=>night.duration_min/60))/4)*4);
  const monthTitle=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
  const label=(night:SleepNight)=>`${night.date} · ${durationText(night.duration_min)} · ${t(night.color)} · ${clockTime(night.bed_ts)} → ${clockTime(night.wake_ts)} WIB`;
  return <section id="sleep-insights" className="sleep-analytics" aria-label={t('sleepInsights')}>
    <div className="section-heading sleep-insights-heading"><div><p className="eyebrow">{t('sleepPatternEyebrow')}</p><h2>{t('sleepInsights')}</h2></div><span>WIB</span></div>
    <div className="sleep-analysis-grid">
      <section className="chart-panel sleep-calendar-panel"><div className="section-heading"><h3>{t('sleepHeatmap')}</h3><div className="sleep-month-controls"><button className="icon-button" aria-label={t('previousMonth')} disabled={month<='2020-01'} onClick={()=>setMonth(shiftMonth(month,-1))}><CaretLeft size={16}/></button><strong>{monthTitle}</strong><button className="icon-button" aria-label={t('nextMonth')} disabled={month>=today.slice(0,7)} onClick={()=>setMonth(shiftMonth(month,1))}><CaretRight size={16}/></button></div></div>
        <p>{t('sleepHeatmapHelp')}</p><div className="sleep-calendar" aria-label={`${t('sleepHeatmap')} · ${monthTitle}`}>
          {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day=><span className="sleep-weekday" key={day} title={t(day)}>{t(day).slice(0,2)}</span>)}
          {monthDays(month).map((date,index)=>{if(!date)return <span key={`blank-${index}`} aria-hidden="true"/>;const entry=lookup.get(date);return <button key={date} className={`sleep-calendar-day ${entry?`sleep-${entry.color}`:'sleep-missing'}`} data-selected={date===selected} data-today={date===today} aria-pressed={date===selected} disabled={date>today} aria-label={entry?label(entry):`${date} · ${date>today?t('futureNight'):t('noSleepEntry')}`} onClick={()=>setSelected(date)}><span>{Number(date.slice(-2))}</span>{entry?<small>{(entry.duration_min/60).toFixed(1)}h</small>:<small>—</small>}</button>;})}
        </div><div className="sleep-color-legend">{colors.map(color=><span key={color} className={`sleep-${color}`}><i/>{t(color)}</span>)}<span className="sleep-missing"><i/>{t('noSleepEntry')}</span></div>
      </section>
      <section className={`chart-panel sleep-night-detail ${night?`sleep-${night.color}`:''}`} aria-live="polite" aria-atomic="true"><p className="eyebrow">{t('selectedNight')}</p><div className="sleep-detail-date"><h3>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${selected}T00:00:00Z`))}</h3><span className="sleep-verdict">{night?t(night.color):t('noSleepEntry')}</span></div>
        {night?<><strong className="sleep-detail-duration">{durationText(night.duration_min)}</strong><p>{clockTime(night.bed_ts)} → {clockTime(night.wake_ts)} WIB</p><p className="sleep-verdict-reason">{t(night.color==='green'?'sleepGreenReason':night.color==='red'?'sleepRedReason':'sleepYellowReason')}</p><ul className="sleep-rule-checks">{(Object.entries(sleepChecks(night)) as Array<['duration'|'bed'|'wake',boolean]>).map(([key,passed])=><li key={key} data-pass={passed}>{passed?<Check size={16}/>:<Minus size={16}/>}<span>{t(key==='duration'?'sleepDurationRule':key==='bed'?'sleepBedRule':'sleepWakeRule')}</span><b>{passed?t('withinWindow'):t('outsideWindow')}</b></li>)}</ul><p>{t('sleepColorCompliance')}</p></>:<div className="sleep-no-night"><Minus size={32}/><p>{t('sleepMissingExplanation')}</p></div>}
        <p className="sleep-rule-note">{t('sleepProductRule')}</p>
      </section>
    </div>
    <section className="chart-panel sleep-trend-panel"><div className="section-heading"><div><h3>{t('sleepDurationTrend')}</h3><p>{t('sleepTrendHelp')}</p></div><select className="range-select" aria-label={t('sleepChartRange')} value={range} onChange={e=>setRange(Number(e.target.value))}>{[7,30,90].map(value=><option value={value} key={value}>{value} {t('days')}</option>)}</select></div>
      <div className="sleep-period-summary">{counts.map(({color,count})=><div key={color} className={`sleep-${color}`}><strong>{count}</strong><span>{t(color)} {t('nights')}</span></div>)}<div><strong>{range-recorded.length}</strong><span>{t('notRecorded')}</span></div><div><strong>{recorded.length?durationText(Math.round(recorded.reduce((sum,night)=>sum+night.duration_min,0)/recorded.length)):'—'}</strong><span>{t('averageRecordedNight')}</span></div></div>
      {!recorded.length?<p className="empty-copy">{t('noSleepChartData')}</p>:<div className="sleep-duration-plot"><div className="sleep-y-axis" aria-hidden="true">{[maxHours,maxHours*2/3,maxHours/3,0].map(value=><span key={value}>{Math.round(value*10)/10}h</span>)}</div><div className="sleep-chart-scroll" ref={chartScroll} tabIndex={0} role="region" aria-label={t('sleepChartScroll')}><div className="sleep-chart-canvas" style={{minWidth:Math.max(240,range*28)}}><div className="sleep-target-band" style={{bottom:`${7/maxHours*100}%`,height:`${3/maxHours*100}%`}} aria-hidden="true"/><div className="sleep-chart-columns" style={{gridTemplateColumns:`repeat(${range},minmax(0,1fr))`}}>{days.map(day=>day.night?<button className={`sleep-chart-day sleep-${day.night.color}`} key={day.date} aria-label={label(day.night)} aria-pressed={selected===day.date} onClick={()=>{setSelected(day.date);setMonth(day.date.slice(0,7));}} title={label(day.night)}><i style={{height:`${day.night.duration_min/60/maxHours*100}%`}}/><small>{Number(day.date.slice(-2))}</small></button>:<div className="sleep-chart-day sleep-chart-missing" key={day.date} title={`${day.date} · ${t('noSleepEntry')}`}><span>—</span><small>{Number(day.date.slice(-2))}</small></div>)}</div></div></div></div>}
      <div className="sleep-chart-caption"><span>{days[0]?.date} — {today}</span><span><i/>{t('sleepTargetBand')}</span></div><p className="sleep-chart-footnote">{t('sleepGapExplanation')}</p>
    </section>
  </section>;
}
