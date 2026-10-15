import { useState,type FormEvent } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { api } from './types';
import { t } from './i18n';
export function RecoveryForm({onBack}:{onBack:(success:boolean)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
    try{await api('/auth/reset',{token:form.get('token'),password:form.get('password')});onBack(true);}
    catch(err){setError(err instanceof Error?err.message:t('error'));}finally{setBusy(false);}
  }
  return <><p className="field-note">{t('recoveryExplanation')}</p><form onSubmit={submit}><label>{t('recoveryToken')}<input name="token" required minLength={40} maxLength={128} autoComplete="off"/></label><label>{t('newPassword')}<input name="password" type="password" minLength={8} maxLength={256} required autoComplete="new-password"/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{t(busy?'saving':'resetPassword')}<ArrowRight size={20}/></button></form><button className="subtle-button" onClick={()=>onBack(false)}>{t('backToSignIn')}</button></>;
}
