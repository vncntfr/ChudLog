import { calendar } from '@chudlog/shared';
export interface QueuedWrite {id:string;user:string;path:string;body:Record<string,unknown>;method:string;label:string;status:'pending'|'synced'|'failed';error:string;created:number}
let database:Promise<IDBDatabase>|undefined;
function db() {
  return database??=new Promise((resolve,reject)=>{
    const request=indexedDB.open('chudlog-foreground',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('writes',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function put(write:QueuedWrite) {
  const database=await db();
  await new Promise<void>((resolve,reject)=>{
    const tx=database.transaction('writes','readwrite');tx.objectStore('writes').put(write);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
  window.dispatchEvent(new Event('chudlog-queue'));
}
export async function queuedWrites(user:string):Promise<QueuedWrite[]> {
  const database=await db();
  return new Promise((resolve,reject)=>{
    const request=database.transaction('writes').objectStore('writes').getAll();
    request.onsuccess=()=>resolve((request.result as QueuedWrite[]).filter(item=>item.user===user).sort((a,b)=>a.created-b.created));
    request.onerror=()=>reject(request.error);
  });
}
const active=new Map<string,Promise<void>>();
export async function flushWrites(user:string, retryFailed=false) {
  if(active.has(user)){await active.get(user);return flushWrites(user,retryFailed);}
  const task=(async()=>{
    if(!navigator.onLine)return;
    // Verify identity before replay; a different signed-in account must never receive this user's drafts.
    let me:Response;
    try{me=await fetch('/api/me',{credentials:'same-origin'});}catch{return;}
    if(!me.ok||(await me.json()).user.id!==user)return;
    for(const write of await queuedWrites(user)) {
      if(write.status==='synced'||write.status==='failed'&&!retryFailed)continue;
      try {
        const response=await fetch(`/api${write.path}`,{method:write.method,credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':write.id},body:JSON.stringify(write.body)});
        const data=await response.json();
        if(response.status===401)break;
        if(!response.ok){await put({...write,status:'failed',error:data.error??`Request failed (${response.status})`});continue;}
        await put({...write,status:'synced',error:''});
        window.dispatchEvent(new Event('chudlog-sync'));
      }catch{await put({...write,status:'pending',error:''});break;}
    }
  })().finally(()=>active.delete(user));
  active.set(user,task);return task;
}
export async function submitWrite(user:string,path:string,body:Record<string,unknown>,label:string,method='POST') {
  const id=crypto.randomUUID();
  const write:QueuedWrite={id,user,path,body:{...body,idempotency_key:id},method,label,status:'pending',error:'',created:Date.now()};
  await put(write);await flushWrites(user);
  const result=(await queuedWrites(user)).find(item=>item.id===id)!;
  if(result.status==='failed')throw new Error(result.error);
  return result.status;
}
export const wibDate=()=>calendar.calendarDate(Date.now(),'Asia/Jakarta');
