import { useRef } from 'react';
import { Barbell, ForkKnife, MoonStars, SquaresFour, UsersThree, UserCircle, ArrowUpRight, X, Check, Trophy, Crown } from '@phosphor-icons/react';
import { points } from '@chudlog/shared';
import { t } from './i18n';

export const navigation = [
  { key: 'today', path: '/', Icon: SquaresFour },
  { key: 'gym', path: '/gym', Icon: Barbell },
  { key: 'food', path: '/food', Icon: ForkKnife },
  { key: 'sleep', path: '/sleep', Icon: MoonStars },
  { key: 'group', path: '/group', Icon: UsersThree },
  { key: 'profile', path: '/profile', Icon: UserCircle },
] as const;

export function Wordmark() {
  return <span className="wordmark">{t('brand')}<span className="brand-slash" aria-hidden="true">/</span></span>;
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  return <span className={`avatar ${large ? 'avatar-large' : ''}`} aria-hidden="true">{initials}</span>;
}

// Original CSS rank sculpture, independent of navigation iconography.
export function RankSculpture({ tier = 'iron', small = false }: { tier?: string; small?: boolean }) {
  const index = points.tierIndex(tier);
  const label = points.RANK_LADDER[index]!.label;
  return <div className={`rank-sculpture ${small ? 'rank-small' : ''}`} data-tier={tier} aria-hidden="true">
    <div className="rank-orbit" />
    <div className="rank-orbit rank-orbit-inner" />
    <div className="rank-floor" />
    <div className="rank-object">{tier==='challenger'&&<Crown className="rank-crown" size={35} weight="fill"/>}
      <div className="rank-bevel"><div className="rank-face">
        <span className="rank-serial">{String(index + 1).padStart(2, '0')} / 09</span>
        <span className="rank-roman">{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][index]}</span>
        <span className="rank-engraving">{label}</span>
      </div></div>
    </div>
    <div className="rank-spark rank-spark-one" /><div className="rank-spark rank-spark-two" />
  </div>;
}

export function RankDetails({ score, tier }: { score: number; tier: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const index = points.tierIndex(tier);
  return <>
    <button className="subtle-button" onClick={() => dialog.current?.showModal()}>
      {t('viewRanks')} <ArrowUpRight size={16} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="rank-dialog" aria-labelledby="rank-dialog-title" onClick={event => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="dialog-top"><Trophy size={24} /><button className="icon-button" aria-label={t('close')} onClick={() => dialog.current?.close()}><X size={22} /></button></div>
      <p className="eyebrow">{t('rankProtocol')}</p>
      <h2 id="rank-dialog-title">{t('earnedNotGiven')}</h2>
      <p>{t('rankRules')}</p>
      <ol className="rank-ladder">{points.RANK_LADDER.map((rank, i) => <li key={rank.tier} className={i === index ? 'current' : ''}>
        <span className="ladder-index">{String(i + 1).padStart(2, '0')}</span><strong>{rank.label}</strong>
        <span>{rank.min.toLocaleString()} {t('pts')}</span>{i < index ? <Check size={16} /> : i === index ? <span className="current-dot" /> : null}
      </li>)}</ol>
      <div className="dialog-bottom"><span>{t('yourPoints')}</span><strong>{score.toLocaleString()} {t('pts')}</strong></div>
    </dialog>
  </>;
}
