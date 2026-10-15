import 'fake-indexeddb/auto';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { flushWrites,queuedWrites,submitWrite } from '../queue';
beforeEach(()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});});
afterEach(()=>vi.unstubAllGlobals());
test('offline drafts stay pending and replay with their original idempotency key',async()=>{
  const user=crypto.randomUUID();
  expect(await submitWrite(user,'/food/entries',{date:'2026-10-15',rows:[]},'Food')).toBe('pending');
  const pending=(await queuedWrites(user))[0]!;
  expect(pending.status).toBe('pending');
  const sent:Array<{key:string;body:string}>=[];
  vi.stubGlobal('navigator',{onLine:true});
  vi.stubGlobal('fetch',vi.fn(async(_path:string,init?:RequestInit)=>{
    if(!init?.method)return new Response(JSON.stringify({user:{id:user}}),{status:200});
    sent.push({key:(init.headers as Record<string,string>)['Idempotency-Key']!,body:init.body as string});
    return new Response(JSON.stringify({ok:true}),{status:200});
  }));
  await flushWrites(user);
  expect(sent).toHaveLength(1);expect(sent[0]!.key).toBe(pending.id);expect(JSON.parse(sent[0]!.body).idempotency_key).toBe(pending.id);
  expect((await queuedWrites(user))[0]!.status).toBe('synced');
  await flushWrites(user);expect(sent).toHaveLength(1);
});
test('a different authenticated account cannot replay another account’s queued writes',async()=>{
  const user=crypto.randomUUID(),other=crypto.randomUUID();
  await submitWrite(user,'/gym/rest',{date:'2026-10-15'},'Gym');
  vi.stubGlobal('navigator',{onLine:true});const fetch=vi.fn(async()=>new Response(JSON.stringify({user:{id:other}}),{status:200}));vi.stubGlobal('fetch',fetch);
  await flushWrites(user);expect(fetch).toHaveBeenCalledTimes(1);
  expect((await queuedWrites(user))[0]!.status).toBe('pending');expect(await queuedWrites(other)).toEqual([]);
});
test('server validation failures remain visible rather than being marked synced',async()=>{
  const user=crypto.randomUUID();
  await submitWrite(user,'/sleep',{bed_ts:1,wake_ts:0},'Sleep');vi.stubGlobal('navigator',{onLine:true});
  vi.stubGlobal('fetch',vi.fn(async(_path:string,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{error:'invalid night'}:{user:{id:user}}),{status:init?.method?400:200})));
  await flushWrites(user);expect((await queuedWrites(user))[0]).toMatchObject({status:'failed',error:'invalid night'});
});
