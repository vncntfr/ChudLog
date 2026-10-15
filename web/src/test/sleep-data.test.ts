import { expect, test } from 'vitest';
import { monthDays, shiftMonth, sleepChecks, sleepDays, type SleepNight } from '../sleep-data';
const night=(date:string,bed:string,wake:string):SleepNight=>({id:date,date,bed_ts:Date.parse(bed),wake_ts:Date.parse(wake),duration_min:(Date.parse(wake)-Date.parse(bed))/60000,color:'yellow'});
test('calendar starts on Monday, includes leap day, and changes years correctly',()=>{
  const cells=monthDays('2024-02');expect(cells.slice(0,3)).toEqual([null,null,null]);expect(cells.filter(Boolean)).toHaveLength(29);expect(cells).toContain('2024-02-29');expect(cells.length%7).toBe(0);
  expect(shiftMonth('2026-01',-1)).toBe('2025-12');expect(shiftMonth('2026-12',1)).toBe('2027-01');
});
test('chart keeps missing dates separate from real nights and filters the calendar range',()=>{
  const entries=[night('2026-10-14','2026-10-13T23:00+07:00','2026-10-14T07:00+07:00'),night('2026-09-01','2026-08-31T23:00+07:00','2026-09-01T07:00+07:00')];
  const days=sleepDays(entries,'2026-10-15',7);expect(days).toHaveLength(7);expect(days[0]?.date).toBe('2026-10-09');expect(days.at(-1)).toEqual({date:'2026-10-15',night:undefined});expect(days.filter(day=>day.night)).toHaveLength(1);
});
test('breakdown uses WIB windows, including midnight, and explains yellow duration separately',()=>{
  expect(sleepChecks(night('2026-10-15','2026-10-15T01:30+07:00','2026-10-15T09:30+07:00'))).toEqual({duration:true,bed:true,wake:true});
  expect(sleepChecks(night('2026-10-15','2026-10-15T02:00+07:00','2026-10-15T10:00+07:00'))).toEqual({duration:true,bed:false,wake:false});
  expect(sleepChecks(night('2026-10-15','2026-10-14T23:00+07:00','2026-10-15T05:00+07:00'))).toEqual({duration:false,bed:true,wake:true});
});
