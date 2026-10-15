import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Eye, EyeSlash, Fingerprint, ShieldCheck } from '@phosphor-icons/react';
import { api } from './types';
import { RecoveryForm } from './RecoveryForm';
import { RankSculpture } from './ui';
import { t } from './i18n';

export function Auth({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'join' | 'create'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recover,setRecover]=useState(false),[notice,setNotice]=useState('');

  function changeMode(next: typeof mode) { setMode(next);setRecover(false);setNotice(''); setError(''); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const body = {
        email: form.get('email'), password: form.get('password'),
        ...(mode === 'login' ? {} : {
          display_name: form.get('name'),
          ...(mode === 'create' ? { group_create: { name: form.get('group') } } : { group_join: { code: form.get('invite') } }),
        }),
      };
      await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, body);
      await onDone();
    } catch (err) { setError(err instanceof Error ? err.message : t('error')); }
    finally { setBusy(false); }
  }

  return <main className="auth-layout" id="main-content">
    <section className="auth-story">
      <div className="edition"><span className="status-light" />{t('privateEdition')}</div>
      <h1>{t('earnYour')}<br /><span>{t('fireWord')}</span><span className="title-period">.</span></h1>
      <p className="auth-manifesto">{t('authManifesto')}</p>
      <div className="auth-sculpture"><RankSculpture /></div>
      <div className="auth-principles"><span>01 <b>{t('food')}</b></span><span>02 <b>{t('sleep')}</b></span><span>03 <b>{t('gym')}</b></span></div>
      <div className="auth-story-footer"><ShieldCheck size={18} />{t('clock')}</div>
    </section>
    <section className="auth-panel">
      <div className="auth-panel-top"><Fingerprint size={28} weight="light" /><span>{t('membersAccess')}</span><span>01</span></div>
      <h2>{t(recover?'recoveryTitle':mode === 'login' ? 'welcomeBack' : mode === 'create' ? 'startYourCircle' : 'findYourPeople')}</h2>
      <p>{t(mode === 'login' ? 'loginIntro' : 'registerIntro')}</p>
      <div className="switch" aria-label={t('accountAction')}>
        <button aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>{t('login')}</button>
        <button aria-pressed={mode === 'join'} onClick={() => changeMode('join')}>{t('register')}</button>
        <button aria-pressed={mode === 'create'} onClick={() => changeMode('create')}>{t('createGroup')}</button>
      </div>
      {recover?<RecoveryForm onBack={success=>{setRecover(false);setMode('login');setNotice(success?t('recoverySuccess'):'');}}/>:<form onSubmit={submit}>
        <label>{t('email')}<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
        <label>{t('password')}<span className="password-field"><input aria-label={t('password')} name="password" type={showPassword ? 'text' : 'password'} minLength={mode === 'login' ? 1 : 8} maxLength={256} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          <button type="button" className="icon-button" aria-label={t(showPassword ? 'hidePassword' : 'showPassword')} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}</button>
        </span></label>
        {mode !== 'login' && <>
          <label>{t('name')}<input name="name" maxLength={24} autoComplete="nickname" required /></label>
          <label>{t(mode === 'create' ? 'groupName' : 'invite')}<input key={mode} name={mode === 'create' ? 'group' : 'invite'} maxLength={mode === 'create' ? 40 : 8} minLength={mode === 'create' ? 1 : 8} required /></label>
          <details className="privacy-details"><summary>{t('visibilityDetails')}</summary><p>{t('privacy')}</p></details>
          <label className="consent"><input type="checkbox" required />{t('consent')}</label>
        </>}
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}><span>{t(busy ? 'saving' : mode === 'login' ? 'enterDashboard' : 'submit')}</span><ArrowRight size={22} aria-hidden="true" /></button>
      </form>}
      {notice&&<p className="save-status" role="status">{notice}</p>}
      {!recover&&mode==='login'&&<button className="subtle-button recovery-link" onClick={()=>setRecover(true)}>{t('recoverAccount')}</button>}
      <div className="auth-panel-bottom"><ShieldCheck size={16} /><span>{t('privateCircle')}</span><ArrowUpRight size={16} /></div>
    </section>
  </main>;
}
