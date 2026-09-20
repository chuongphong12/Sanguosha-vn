const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
const root = path.resolve(__dirname, '../../../..');
const samples = [
  ['qs-background','QSanguosha/backdrop/default.jpg'],
  ['qs-card','QSanguosha/image/big-card/slash.png'],
  ['battlefield','3qs/image/backdrop/table.jpg'],
  ['avatar','3qs/image/generals/avatar/caocao.png'],
  ['general-card','3qs/image/generals/card/caocao.jpg'],
  ['hero-skin','QSanguosha-LangKhach-QuocChien/hero-skin/caocao/1/full.png'],
  ['card-small','3qs/image/card/slash.png'],
  ['card-big','3qs/image/big-card/slash.png'],
  ['skill-cutout','3qs/image/animate/huaxiong.png'],
  ['button','3qs/image/system/button/platter/confirm/normal.png'],
  ['slash-frame','3qs/image/system/emotion/slash_red/12.png'],
  ['jink-frame','3qs/image/system/emotion/jink/10.png'],
  ['win-banner','3qs/image/animate/game-win.png'],
];
(async () => {
  const rows = await Promise.all(samples.map(async ([id, source]) => {
    const file=path.join(root,source), metadata=await sharp(file).metadata();
    const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1,visible=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*info.channels+info.channels-1]>16){visible++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const bounds={x:left,y:top,width:right<0?0:right-left+1,height:bottom<0?0:bottom-top+1};
    return {id,source,width:metadata.width,height:metadata.height,bytes:fs.statSync(file).size,alpha:metadata.hasAlpha,alphaThreshold:16,visibleBounds:bounds,visiblePixelsRatio:Number((visible/(info.width*info.height)).toFixed(4)),nativeCSSAtDPR2:{width:metadata.width/2,height:metadata.height/2},visibleBoundsCSSAtDPR2:{width:bounds.width/2,height:bounds.height/2}};
  }));
  const result={inspectedAt:new Date().toISOString(),scope:'13 selected source samples; metadata and alpha bounds only, not a full-library visual quality score',rows};
  fs.writeFileSync(path.join(__dirname,'asset-sample-inspection.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
})();
