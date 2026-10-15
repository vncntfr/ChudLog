import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { ArrowRight, CircleNotch, SignOut, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { FoodLogger, SleepLogger } from './Loggers';
import { GymWorkspace } from './GymWorkspace';
import { GroupView } from './Community';
import { QueueBanner } from './data';
import { Auth } from './Auth';
import { Group, Profile, Today, useWibTime } from './Dashboard';
import { Avatar, navigation, Wordmark } from './ui';
import { api, type Me } from './types';
import { t } from './i18n';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './app.css';

const useSession = create<{ me: Me | null; setMe: (me: Me | null) => void }>(set => ({ me: null, setMe: me => set({ me }) }));

function Shell({ me, onDone, onLogout }: { me: Me; onDone: () => Promise<void>; onLogout: () => Promise<void> }) {
  const location = useLocation();
  const now = useWibTime();
  const active = navigation.find(item => item.path === location.pathname);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" to="/" aria-label={t('brand')}><Wordmark /></Link>
      <div className="sidebar-section-label">{t('yourWorkspace')}<span>01</span></div>
      <nav className="desktop-nav" aria-label={t('mainNavigation')}>{navigation.map(({ key, path, Icon }, index) => <NavLink end key={key} to={path}><Icon size={21} weight="duotone" /><span>{t(key)}</span><span className="nav-number">{String(index + 1).padStart(2, '0')}</span></NavLink>)}</nav>
      <Link to="/group" className="sidebar-group"><div><UsersThree size={21} /><span className="tiny-square" /></div><span>{t('yourCircle')}</span><strong>{me.group.name}</strong><span className="sidebar-group-link">{t('openGroup')}<ArrowRight size={16} /></span></Link>
      <div className="sidebar-footer"><div className="edition"><span className="status-light" />{t('privateEdition')}</div><p>{t('builtForConsistency')}</p></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><Link className="mobile-brand brand" to="/"><Wordmark /></Link><div className="breadcrumb"><span>{t('workspace')}</span><span>/</span><b>{t(active?.key ?? 'today')}</b></div>
        <div className="topbar-right"><span className="local-clock">{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)} <span>WIB</span></span><Link className="account-chip" to="/profile" aria-label={t('profile')}><Avatar name={me.user.display_name} /><span>{me.user.display_name}</span></Link><button className="icon-button logout-button" aria-label={t('logout')} title={t('logout')} onClick={onLogout}><SignOut size={19} /></button></div>
      </header>
      <main className="dashboard-content" key={location.pathname} id="main-content"><QueueBanner user={me.user.id}/><Routes>
        <Route path="/" element={<Today me={me} />} />
        <Route path="/profile" element={<Profile me={me} onDone={onDone} />} />
        <Route path="/group" element={<GroupView me={me} />} />
        <Route path="/food" element={<FoodLogger me={me} onDone={onDone}/>}/><Route path="/sleep" element={<SleepLogger me={me} onDone={onDone}/>}/><Route path="/gym" element={<GymWorkspace me={me} onDone={onDone}/>}/>
        <Route path="*" element={<div className="empty-panel"><h1>{t('pageNotFound')}</h1><Link className="primary link-button" to="/">{t('backToToday')}<ArrowRight /></Link></div>} />
      </Routes></main>
      <nav className="mobile-nav" aria-label={t('mobileNavigation')}>{navigation.map(({ key, path, Icon }) => <NavLink end key={key} to={path}><Icon size={22} weight="duotone" /><span>{t(key)}</span></NavLink>)}</nav>
    </div>
  </div>;
}

function App() {
  const { me, setMe } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin' });
      if (response.status === 401) { setMe(null); setError(''); return; }
      if (!response.ok) throw new Error(t('error'));
      const data=await response.json();setMe(data);setError('');
      if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(registration=>registration?.active?.postMessage({type:'owner',user:data.user.id}));
    } catch { setError(t('error')); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('chudlog-sync', refresh);
    return () => {window.removeEventListener('focus', refresh);window.removeEventListener('chudlog-sync',refresh);};
  }, []);
  async function logout() {
    try {
      if ('serviceWorker' in navigator) {
        const registration=await navigator.serviceWorker.getRegistration();
        const subscription=await registration?.pushManager.getSubscription();
        if(subscription){await api('/push/subscribe',{endpoint:subscription.endpoint},'DELETE');await subscription.unsubscribe();}
        registration?.active?.postMessage({type:'owner',user:null});
      }
      await api('/auth/logout', {}); setMe(null);
    }
    catch { setError(t('error')); }
  }
  return <>
    <a href="#main-content" className="skip-link">{t('skipToContent')}</a>
    {error ? <main className="error-screen" id="main-content"><WarningCircle size={52} weight="duotone" /><h1>{t('connectionLost')}</h1><p role="alert">{error}</p><button className="primary" onClick={() => void load()}>{t('retry')}<ArrowRight /></button></main>
      : loading ? <main className="loading-screen" id="main-content" aria-busy="true"><Wordmark /><div className="loading-line" /><p><CircleNotch size={16} />{t('loading')}</p></main>
      : me ? <Shell me={me} onDone={load} onLogout={logout} />
      : <><header className="auth-header"><Link className="brand" to="/"><Wordmark /></Link><span className="eyebrow">{t('clock')}</span></header><Auth onDone={load} /></>}
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
