import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Barbell, Check, Copy, Fire, ForkKnife, HourglassMedium, Lightning, MoonStars, ShieldCheck, UsersThree } from '@phosphor-icons/react';
import { points } from '@chudlog/shared';
import { api, type Me, type Tracker } from './types';
import { Avatar, RankDetails, RankSculpture } from './ui';
import { Accountability, GoalSettings, ProfileSummary, PushControls } from './AccountFeatures';
import { Flame } from './Flame';
import { t } from './i18n';

export function useWibTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // A local display clock; never polls the API.
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function deadlineIn(now: Date) {
  const shifted = new Date(now.getTime() + 7 * 3600000);
  const minutes = 24 * 60 - shifted.getUTCHours() * 60 - shifted.getUTCMinutes();
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const trackers = [
  { key: 'food', Icon: ForkKnife, symbol: '01', action: 'fuelUp', detail: 'foodDetail' },
  { key: 'sleep', Icon: MoonStars, symbol: '02', action: 'recoverHard', detail: 'sleepDetail' },
  { key: 'gym', Icon: Barbell, symbol: '03', action: 'putInWork', detail: 'gymDetail' },
] as const;

export function Today({ me }: { me: Me }) {
  const now = useWibTime();
  const completed = trackers.filter(tracker => me.today[tracker.key]).length;
  const rankIndex = points.tierIndex(me.rank_state.lifetime_tier);
  const rank = points.RANK_LADDER[rankIndex]!;
  const next = points.RANK_LADDER[rankIndex + 1];
  const score = me.rank_state.lifetime_points;
  const progress = next ? Math.min(100, (score - rank.min) / (next.min - rank.min) * 100) : 100;
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return <>
    <div className="page-heading"><div><p className="eyebrow">{date} <span className="orange-dot" /> WIB</p><h1>{t('overview')}</h1></div>
      <div className="deadline"><HourglassMedium size={19} /><div><span>{t('dayClosesIn')}</span><strong>{deadlineIn(now)}</strong></div></div>
    </div>
    <Accountability me={me}/><section className="hero-panel">
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-copy"><span className="hero-kicker"><span />{t('dailyDiscipline')}</span>
        <h2>{t('allIn')}<br /><span>{t('everyDay')}</span><span className="title-period">.</span></h2>
        <p>{t('missionCopy')}</p>
        <a className="hero-link" href="#daily-protocol">{t('viewProtocol')}<ArrowRight size={20} /></a>
      </div>
      <div className="hero-rank"><span className="rank-caption">{t('rankCaption')}</span><RankSculpture tier={rank.tier} /><div className="hero-rank-label"><span className="orange-line" />{rank.label}<span className="orange-line" /></div><span className="rank-edition">{t('rankEdition')} {String(rankIndex + 1).padStart(2, '0')}</span></div>
      <div className="hero-bottom"><div><span className="hero-stat-icon"><Fire size={22} weight="fill" /></span><div><strong>{String(me.rank_state.current_streak).padStart(2, '0')}<small>{t('days')}</small></strong><span>{t('streak')}</span></div></div>
        <div><span className="hero-stat-icon"><Lightning size={22} weight="fill" /></span><div><strong>{score.toLocaleString()}<small>{t('pts')}</small></strong><span>{t('points')}</span></div></div>
        <div className="hero-progress"><div><span>{t('nextRank')}</span><strong>{next?.label ?? t('topRank')}</strong></div><div className="progress-track" role="progressbar" aria-label={t('nextRank')} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><span>{next ? `${Math.max(0, next.min - score).toLocaleString()} ${t('pointsToGo')}` : t('topRank')}</span></div>
      </div>
    </section>
    <section id="daily-protocol" className="protocol-section">
      <div className="section-heading"><div><span className="section-index">01 / 03</span><h2>{t('dailyProtocol')}</h2></div><span className="completion"><b>{completed}</b> / 3 <span>{t('complete')}</span></span></div>
      <div className="tracker-grid">{trackers.map(({ key, Icon, symbol, action, detail }) => <Link className={`tracker-card tracker-${key} ${me.today[key] ? 'is-complete' : ''}`} key={key} to={`/${key}`}>
        <div className="tracker-top"><span className="tracker-label">{t(key)}</span><span className="status">{me.today[key] ? <Check weight="bold" size={12} /> : <span className="status-dot" />}{t(me.today[key] ? 'logged' : 'unlogged')}</span></div>
        <div className="tracker-art" aria-hidden="true"><span className="tracker-number">{symbol}</span><Icon weight="duotone" /></div>
        <div className="tracker-bottom"><div><h3>{t(action)}</h3><p>{t(detail)}</p></div><span className="round-arrow"><ArrowUpRight size={20} /></span></div>
      </Link>)}</div>
    </section>
    <section className="bottom-grid">
      <article className="streak-panel"><div className="streak-emblem" data-active={me.rank_state.current_streak >= 3}><Flame days={me.rank_state.current_streak} size={46}/></div><div><span className="eyebrow">{t('streakStatus')}</span><h3>{t(me.rank_state.current_streak >= 3 ? 'keepBurning' : 'fromTheAshes')}</h3><p>{t('streakExplanation')}</p></div><span className="streak-big">{String(me.rank_state.current_streak).padStart(2, '0')}<small>{t('days')}</small></span></article>
      <article className="rank-panel"><div className="rank-panel-top"><span className="eyebrow">{t('rankProtocol')}</span><span className="rank-level">{String(rankIndex + 1).padStart(2, '0')} / 09</span></div><h3>{t('earnedNotGiven')}</h3><RankDetails score={score} tier={rank.tier} /></article>
    </section>
    <footer className="build-note"><ShieldCheck size={16} /><span>{t('foundationCopy')}</span><span className="build-version">V.01</span></footer>
  </>;
}

export function TrackerPage({ tracker, me }: { tracker: Tracker; me: Me }) {
  const item = trackers.find(item => item.key === tracker)!;
  const Icon = item.Icon;
  return <div className="feature-page"><div className="page-heading"><div><p className="eyebrow">{t('dailyProtocol')} / {item.symbol}</p><h1>{t(tracker)}</h1></div><span className="status">{t(me.today[tracker] ? 'logged' : 'unlogged')}</span></div>
    <section className={`feature-panel tracker-${tracker}`}><div className="feature-icon"><Icon size={120} weight="duotone" /></div><div><p className="eyebrow">{t('foundation')}</p><h2>{t(item.action)}</h2><p>{t('nextCopy')}</p><details className="what-counts"><summary>{t('whatCounts')}</summary><p>{t(`${tracker}Copy`)}</p></details><Link className="primary link-button" to="/">{t('backToToday')}<ArrowRight size={20} /></Link></div></section>
  </div>;
}

export function Group({ me }: { me: Me }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(me.group.invite_code); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <><div className="page-heading"><div><p className="eyebrow">{t('privateCircle')}</p><h1>{t('group')}</h1></div><UsersThree size={32} weight="light" /></div>
    <section className="group-panel"><div className="group-art" aria-hidden="true"><div className="group-circle"><UsersThree size={76} weight="duotone" /></div><span className="orbit-point" /></div><div><span className="eyebrow">{t('member')}</span><h2>{me.group.name}</h2><p>{t('inviteHelp')}</p><div className="invite-box"><code>{me.group.invite_code}</code><button className="icon-button" aria-label={t('copyInvite')} onClick={copy}>{copied ? <Check size={23} /> : <Copy size={23} />}</button></div><p role="status" className={copyError ? 'error' : 'copy-status'}>{copied ? t('copied') : copyError ? t('copyError') : t('invitationOnly')}</p></div></section>
    <div className="transparency-note"><ShieldCheck size={24} /><div><h3>{t('sharedAccountability')}</h3><p>{t('privacy')}</p></div></div>
  </>;
}

export function Profile({ me, onDone }: { me: Me; onDone: () => Promise<void> }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false);
    const form = new FormData(event.currentTarget);
    try {
      await api('/me', { display_name: form.get('name'), bodyweight_kg: form.get('weight') ? Number(form.get('weight')) : null }, 'PUT');
      await onDone(); setMessage(t('saved'));
    } catch (err) { setFailed(true); setMessage(err instanceof Error ? err.message : t('error')); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><p className="eyebrow">{t('yourIdentity')}</p><h1>{t('profile')}</h1></div></div>
    <div className="profile-grid"><section className="identity-panel"><Avatar name={me.user.display_name} large /><h2>{me.user.display_name}</h2><p>{me.group.name}</p><p className="eyebrow">{me.rank_state.lifetime_tier}</p><RankSculpture tier={me.rank_state.lifetime_tier} small /><span className="eyebrow">{t('longestStreak')}: {me.rank_state.longest_streak} {t('days')}</span><span className="eyebrow">{t('yourPoints')}</span><strong className="profile-points">{me.rank_state.lifetime_points}<small>{t('pts')}</small></strong></section>
      <section className="settings-panel"><div className="section-heading"><h2>{t('personalDetails')}</h2><span className="eyebrow">{t('selfOnly')}</span></div><p className="account-email">{me.user.email}</p><form onSubmit={submit}>
        <label>{t('name')}<input name="name" defaultValue={me.user.display_name} maxLength={24} required /></label>
        <label>{t('weight')}<input name="weight" type="number" min="20" max="399.9" step="0.1" defaultValue={me.user.bodyweight_kg ?? ''} /></label>
        <div className="protein-result"><span>{t('protein')}</span><strong>{me.user.protein_goal ?? '–'}<small>{t('gramsPerDay')}</small></strong></div>
        <p className="disclosure">{t('privacy')}</p><button className="primary" disabled={busy}>{t(busy ? 'saving' : 'save')}<ArrowRight size={20} /></button><p role="status" className={failed ? 'error' : 'save-status'}>{message}</p>
      </form></section></div><div className="account-settings-grid"><GoalSettings me={me} onDone={onDone}/><div><ProfileSummary/><PushControls user={me.user.id}/></div></div>
  </>;
}
