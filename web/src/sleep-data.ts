import { calendar, sleep } from '@chudlog/shared';
export interface SleepNight {id:string;date:string;bed_ts:number;wake_ts:number;duration_min:number;color:'green'|'yellow'|'red'}
export const clockTime=(stamp:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(stamp);
export const durationText=(minutes:number)=>`${Math.floor(minutes/60)}h ${minutes%60}m`;
export function sleepDays(entries:SleepNight[],today:string,range:number) {
  const byDate=new Map(entries.map(entry=>[entry.date,entry]));
  return Array.from({length:range},(_,i)=>{const date=calendar.shiftLocalDate(today,i-range+1,'Asia/Jakarta');return {date,night:byDate.get(date)};});
}
export function monthDays(month:string) {
  const first=`${month}-01`,stamp=Date.parse(`${first}T00:00:00Z`),offset=(new Date(stamp).getUTCDay()+6)%7;
  const count=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i<offset||i>=offset+count?null:`${month}-${String(i-offset+1).padStart(2,'0')}`);
}
export function shiftMonth(month:string,amount:number) {
  const stamp=new Date(`${month}-01T00:00:00Z`);stamp.setUTCMonth(stamp.getUTCMonth()+amount);return stamp.toISOString().slice(0,7);
}
export function sleepChecks(night:SleepNight) {
  return {
    duration:night.duration_min>=sleep.GREEN_MIN_DURATION&&night.duration_min<=sleep.GREEN_MAX_DURATION,
    bed:sleep.bedInWindow(calendar.zonedInstant(night.bed_ts,'Asia/Jakarta').minutesOfDay),
    wake:sleep.wakeInWindow(calendar.zonedInstant(night.wake_ts,'Asia/Jakarta').minutesOfDay),
  };
}
