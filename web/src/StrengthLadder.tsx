import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from './data';
import { t } from './i18n';
interface Ladder {standard_version:string;profile_ready:boolean;caveat:string;exercises:Array<{exercise:string;source:string;load:string}>;results:Array<{exercise:string;score:number;rankLabel:string;e1rmKgbw:number;source:string;load:string}>}
export function StrengthLadder() {
  const result=useData<Ladder>('/gym/ladder');const [search,setSearch]=useState('');
  return <section className="chart-panel strength-ladder"><h2>{t('ladderA')}</h2><p>{result.data?.caveat}</p>{result.error&&<p className="error">{result.error}</p>}{result.data&&!result.data.profile_ready&&<p className="warning-line">{t('ladderProfile')} <Link to="/profile">{t('profile')} →</Link></p>}<label>{t('searchExercises')}<input value={search} onChange={e=>setSearch(e.target.value)}/></label>{result.data?.exercises.filter(exercise=>exercise.exercise.toLowerCase().includes(search.toLowerCase())).map(exercise=>{const score=result.data!.results.find(row=>row.exercise===exercise.exercise);return <article className="strength-row" key={exercise.exercise}><div><strong>{exercise.exercise}</strong><a href={exercise.source} target="_blank" rel="noreferrer">{t('benchmarkSource')} · {exercise.load==='per-hand'?t('perHand'):t('totalLoad')}</a></div><span>{score?`${score.score} / 1000`:'–'}</span><b>{score?.rankLabel??t('unscored')}</b></article>;})}<p className="field-note">{result.data?.standard_version}</p></section>;
}
