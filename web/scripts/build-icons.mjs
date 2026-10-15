// Original procedural app mark. PNG encoding uses Node's standard library, no remote assets.
import { mkdirSync,writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(bytes){let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,checksum]);}
function pixel(x,y){
  // ChudLog C, with a precise ember slash, centered inside the maskable safe area.
  const ring=(x>=.23&&x<=.60&&y>=.27&&y<=.73)&&!(x>.34&&y>.38&&y<.62)&&!(x>.50&&y>.38&&y<.62);
  const slash=y>=.27&&y<=.73&&Math.abs(x-(.74-(y-.27)*.20))<.035;
  if(slash)return [255,123,41];if(ring)return [231,235,241];return [11,12,14];
}
function icon(size){
  const raw=Buffer.alloc((size*3+1)*size);let offset=0;
  for(let y=0;y<size;y++){raw[offset++]=0;for(let x=0;x<size;x++){const rgb=[0,0,0];for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){const value=pixel((x+(sx+.5)/4)/size,(y+(sy+.5)/4)/size);for(let channel=0;channel<3;channel++)rgb[channel]+=value[channel];}for(const value of rgb)raw[offset++]=Math.round(value/16);}}
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
mkdirSync('public/icons',{recursive:true});for(const size of [180,192,512])writeFileSync(`public/icons/icon-${size}.png`,icon(size));
