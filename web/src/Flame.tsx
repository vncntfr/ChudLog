import { flame } from '@chudlog/shared';
export function Flame({days,size=42}:{days:number;size?:number}) {
  const tier=flame.flameTier(days),key=tier.key;
  const large=key==='inferno'||key==='hellfire'||key==='eternal';
  return <svg className={`flame-art flame-${key}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={tier.label}>
    <title>{tier.label} · {days} days</title>
    {key==='ash'?<><path d="M7 53Q15 42 24 45Q32 32 40 44Q50 43 58 54Z" fill="#777e89"/><path d="M9 54H57" stroke="#aeb6c0" strokeWidth="2"/><path d="M33 37C20 29 41 29 30 15C26 10 30 6 35 4" fill="none" stroke="#9ba9ba" strokeWidth="2" strokeLinecap="round"/></>:key==='spark'?<><path d="M32 4 36 23 51 12 42 29 61 32 42 36 52 53 36 42 32 61 28 42 12 52 22 36 3 32 22 28 12 12 28 23Z" fill="#ff7a00"/><path d="m32 17 4 12 11 3-11 4-4 11-4-11-11-4 11-3Z" fill="#ffcf65"/></>:key==='ember'?<><path d="m11 25 12-13 24 3 10 22-9 17-30-1-11-13Z" fill="#363c43" stroke="#737982"/><path d="m23 14 5 16-8 7 7 16m20-36-9 14 9 7-4 16m-14-24 9 1" fill="none" stroke="#ff6c2c" strokeWidth="3" strokeLinejoin="round"/></>:<>
      {large&&<circle cx="32" cy="34" r="28" fill="none" stroke={key==='eternal'?'#e5c989':'#ff8d4e'} opacity=".4" strokeDasharray="4 8"/>}
      {(key==='hellfire'||key==='eternal')&&<path d="M14 48C-1 30 16 27 13 12Q31 23 28 8Q38 16 39 25Q49 10 49 9C47 27 65 34 51 50Z" fill={key==='eternal'?'#e6c577':'#fa5844'}/>}
      <path d="M33 4C37 20 50 24 49 37Q56 29 53 24C67 49 47 61 32 61S3 52 11 34Q15 25 22 20Q20 34 27 30C20 16 32 15 33 4Z" fill={key==='eternal'?'#e5b453':key==='hellfire'?'#ff6248':'#ff8a1f'}/>
      <path d="M33 22C34 34 43 37 43 46C43 62 19 62 20 47Q20 37 28 32Q25 42 31 41Q36 35 33 22Z" fill={key==='eternal'?'#77acff':key==='hellfire'?'#cfe4ff':'#ffe14d'}/>
      {key==='eternal'&&<path d="M33 36Q44 55 32 58Q20 54 33 36Z" fill="#f5f7ff"/>}
      <circle cx="8" cy="56" r="2" fill="#ffca75"/><circle cx="56" cy="57" r="2" fill="#ffca75"/>
      {large&&<><path d="m3 21 3 5m51-11 3-5m-6 36 6-3M8 38l-6-2" stroke="#ffc77e" strokeWidth="2"/></>}
      {key==='hellfire'&&<path d="m10 15 5 8-6 8m47-10-5 9 6 6" fill="none" stroke="#b8d5ff" strokeWidth="2"/>}
      {key==='eternal'&&<g className="eternal-orbit" fill="#fff1ce"><circle cx="32" cy="2" r="2"/><circle cx="60" cy="20" r="2"/><circle cx="60" cy="46" r="2"/><circle cx="32" cy="62" r="2"/><circle cx="4" cy="46" r="2"/><circle cx="4" cy="20" r="2"/></g>}
    </>}
  </svg>;
}
