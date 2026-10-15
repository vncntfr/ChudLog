import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, Check, CloudSlash, WarningCircle } from '@phosphor-icons/react';
import { api } from './types';
import { flushWrites, queuedWrites, submitWrite, type QueuedWrite } from './queue';
import { t } from './i18n';

export function useData<T>(path:string) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState('');
  const load=useCallback(async()=>{try{setData(await api(path));setError('');}catch(err){setError(err instanceof Error?err.message:t('error'));}},[path]);
  useEffect(()=>{setData(null);void load();const refresh=()=>{void load();};window.addEventListener('focus',refresh);window.addEventListener('chudlog-sync',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('chudlog-sync',refresh);};},[load]);
  return {data,error,reload:load};
}
export function useWrite(user:string,onDone:()=>Promise<void>) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(path:string,body:Record<string,unknown>,label:string,method='POST') {
    setBusy(true);setMessage('');setError('');
    try{
      const status=await submitWrite(user,path,body,label,method);
      setMessage(t(status==='synced'?'logSaved':'logQueued'));
      if(status==='synced')await onDone();
      return true;
    }catch(err){setError(err instanceof Error?err.message:t('error'));return false;}
    finally{setBusy(false);}
  }
  return {busy,message,error,save};
}
export function WriteFeedback({message,error}:{message:string;error:string}) {return <>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="save-status" role="status">{message}</p>}</>;}
export function QueueBanner({user}:{user:string}) {
  const [items,setItems]=useState<QueuedWrite[]>([]);
  useEffect(()=>{
    const update=()=>{void queuedWrites(user).then(setItems).catch(()=>{});};
    const replay=()=>{void flushWrites(user).then(update);};
    update();replay();window.addEventListener('online',replay);window.addEventListener('focus',replay);window.addEventListener('chudlog-queue',update);
    return()=>{window.removeEventListener('online',replay);window.removeEventListener('focus',replay);window.removeEventListener('chudlog-queue',update);};
  },[user]);
  const pending=items.filter(item=>item.status!=='synced');
  if(!pending.length)return null;
  return <section className="queue-banner" aria-label={t('foregroundQueue')}><CloudSlash size={22}/><div><strong>{pending.length} {t('unsyncedWrites')}</strong>{pending.map(item=><p key={item.id}>{item.label}: {t(item.status==='failed'?'failed':'pending')}{item.error?` · ${item.error}`:''}</p>)}</div><button className="subtle-button" onClick={()=>void flushWrites(user,true)}><ArrowClockwise size={18}/>{t('retry')}</button></section>;
}
