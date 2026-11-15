// Inverse projective mapping, bilinear sampling. Never changes source storage.
function solve(rows) {
  const n=rows.length;
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(rows[j][i])>Math.abs(rows[pivot][i]))pivot=j;
    [rows[i],rows[pivot]]=[rows[pivot],rows[i]];
    const d=rows[i][i];if(Math.abs(d)<1e-10)throw Error('invalid_crop');
    for(let k=i;k<=n;k++)rows[i][k]/=d;
    for(let j=0;j<n;j++)if(j!==i){const f=rows[j][i];for(let k=i;k<=n;k++)rows[j][k]-=f*rows[i][k];}
  }
  return rows.map(row=>row[n]);
}
function perspective(data,width,height,points) {
  const p=points.map(([x,y])=>[x*(width-1),y*(height-1)]);
  const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const w=Math.max(2,Math.round((length(p[0],p[1])+length(p[3],p[2]))/2)+1);
  const h=Math.max(2,Math.round((length(p[0],p[3])+length(p[1],p[2]))/2)+1);
  if(w>3400||h>3400||w*h>12000000)throw Error('pixel_limit');
  const corners=[[0,0],[w-1,0],[w-1,h-1],[0,h-1]],rows=[];
  corners.forEach(([u,v],i)=>{const [x,y]=p[i];rows.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);});
  const a=solve(rows),output=new Uint8Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const d=a[6]*x+a[7]*y+1;
    const sx=Math.max(0,Math.min(width-1,(a[0]*x+a[1]*y+a[2])/d));
    const sy=Math.max(0,Math.min(height-1,(a[3]*x+a[4]*y+a[5])/d));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),dx=sx-x0,dy=sy-y0;
    for(let c=0;c<3;c++)output[(y*w+x)*3+c]=Math.round(
      data[(y0*width+x0)*3+c]*(1-dx)*(1-dy)+data[(y0*width+x1)*3+c]*dx*(1-dy)+data[(y1*width+x0)*3+c]*(1-dx)*dy+data[(y1*width+x1)*3+c]*dx*dy);
  }
  return {data:output,width:w,height:h};
}
module.exports={perspective};
