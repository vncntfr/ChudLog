const CACHE='__CACHE__';
const PRECACHE=/*__PRECACHE__*/[];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('chudlog-static-')||key.startsWith('chudlog-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html').then(response=>response||caches.match('/offline.html'))));
  else if(PRECACHE.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
function ownerStore(action,user) {
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open('chudlog-device',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('owner');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const tx=open.result.transaction('owner',action==='set'?'readwrite':'readonly'),store=tx.objectStore('owner');
      const request=action==='set'?store.put(user,'active'):store.get('active');
      tx.oncomplete=()=>{resolve(request.result);open.result.close();};tx.onerror=()=>reject(tx.error);
    };
  });
}
self.addEventListener('message',event=>{if(event.data?.type==='owner')event.waitUntil(ownerStore('set',event.data.user));});
self.addEventListener('push',event=>{event.waitUntil((async()=>{
  let payload;try{payload=event.data?.json();}catch{return;}
  if(!payload||typeof payload.title!=='string'||typeof payload.body!=='string')return;
  const owner=await ownerStore('get');if(!owner||owner!==payload.data?.userId)return;
  await self.registration.showNotification(payload.title,{body:payload.body,icon:'/icons/icon-192.png',tag:payload.tag||'chudlog',data:{deepLink:'/'}});
})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();await client.navigate('/');return;}}
  await clients.openWindow('/');
})());});
