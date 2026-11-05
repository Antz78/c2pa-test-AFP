/* curl.js — Repli de coin de page WebGL, autonome, sans dépendance.
   Usage : const ctl = mountCurl(bouton); ctl.updatePhoto(imgElement, cardCanvas);
   Le bouton reçoit un <canvas> plein cadre qui reproduit la portion de photo
   située dessous, puis y enroule le coin autour d'un cylindre virtuel. */

const FS = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uImg;
uniform sampler2D uCard;
uniform float uT;
uniform vec2 uK;
uniform vec2 uOff;
const float SQRT2=1.41421356;
const float R=0.34;
void main(){
  vec2 pf=vec2(gl_FragCoord.x/uRes.x, 1.0-gl_FragCoord.y/uRes.y); /* espace image, y vers le bas */
  vec2 q=uOff+uK*pf;
  vec2 n=vec2(1.0,1.0)/SQRT2;
  float diag=dot(q,n);
  float fold=mix(1.47,1.02,uT);
  float d=diag-fold;
  float thetaMax=max((SQRT2-fold)/R,0.0);
  float ext=R*sin(thetaMax);
  float aa=1.6/uRes.x;
  float flat=smoothstep(aa,-aa,d);
  float flap=(1.0-flat)*smoothstep(ext+aa,ext-aa,d);
  vec3 col=vec3(0.0);
  vec3 img=texture2D(uImg,q).rgb;
  img*=1.0-0.16*uT*smoothstep(0.028,0.0,abs(d));
  col+=flat*img;
  if(flap>0.001){
    float dC=min(d,ext-0.0002);
    float s=dC*1.15;
    for(int i=0;i<16;i++){float th=s/R;s+=(dC-R*sin(th))/max(cos(th),0.25);}
    float theta=clamp(s/R,0.0,thetaMax);
    vec2 uvOrig=q+n*(s-dC);
    vec3 N=normalize(vec3(n.x*cos(theta),n.y*cos(theta),sin(theta)));
    vec3 L=normalize(vec3(-0.35,-0.5,0.78));
    float lam=max(dot(N,L),0.0);
    float spec=pow(max(dot(N,normalize(L+vec3(0.,0.,1.))),0.0),42.0)*0.5;
    float k=pow(max(1.0-theta/1.35,0.0),1.3);
    vec3 paper=mix(vec3(0.176,0.204,0.243),vec3(0.522,0.553,0.616),k);
    vec3 ghost=texture2D(uImg,clamp(uvOrig,0.0,1.0)).rgb;
    vec3 under=paper*(0.30+0.80*lam)+spec*vec3(1.0,0.97,0.90)+ghost*0.05;
    under+=vec3(0.85,0.92,1.0)*0.30*smoothstep(thetaMax-0.10,thetaMax,theta);
    col+=flap*under;
  }
  float cardM=clamp(1.0-flat-flap,0.0,1.0);
  vec3 cardC=texture2D(uCard,q).rgb;
  float sh=clamp(0.55*uT*max(1.0-(d-ext)/0.20,0.0),0.0,1.0);
  col+=cardM*cardC*(1.0-sh);
  gl_FragColor=vec4(col,1.0);
}`;

export function mountCurl(button, opts = {}) {
  if (button._curl) return button._curl;
  const revealDelay = opts.revealDelay ?? 1600;
  const rest = opts.rest ?? 0.32;                 // amplitude au repos après révélation
  const canvas = document.createElement('canvas');
  button.replaceChildren(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) { button._curl = null; return null; }  // repli SVG conservé si WebGL absent

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FS); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(fs)); button._curl = null; return null; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uT = U('uT'), uK = U('uK'), uOff = U('uOff');
  gl.uniform1i(U('uImg'), 0); gl.uniform1i(U('uCard'), 1);

  function upload(unit, src) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  let photo = null, card = null, imgEl = null, cardSrc = null;
  let t = 0, target = 0, revealed = false, timer = 0, raf = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function syncTexture() {
    if (imgEl && imgEl.complete && imgEl.naturalWidth) {
      if (photo) gl.deleteTexture(photo);
      photo = upload(0, imgEl);
    }
    if (cardSrc) { if (card) gl.deleteTexture(card); card = upload(1, cardSrc); }
  }

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    // Fenêtre du badge exprimée dans la photo affichée (coin bas-droit)
    const pr = imgEl?.getBoundingClientRect?.(), cr = canvas.getBoundingClientRect();
    if (pr && pr.width && cr.width) {
      gl.uniform2f(uK, Math.min(1, cr.width / pr.width), Math.min(1, cr.height / pr.height));
      gl.uniform2f(uOff,
        Math.min(1, Math.max(0, (pr.right - cr.right) / pr.width)),
        Math.min(1, Math.max(0, (pr.bottom - cr.bottom) / pr.height)));
    } else { gl.uniform2f(uK, 1, 1); gl.uniform2f(uOff, 0, 0); }
  }

  function frame() {
    t += (target - t) * (reduced ? 1 : 0.085);
    if (Math.abs(target - t) < 0.0006) t = target;
    fit();
    if (photo) { gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    raf = requestAnimationFrame(frame);
  }

  button.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && revealed) target = 1; });
  button.addEventListener('pointerleave', () => { if (revealed) target = rest; });

  const ctl = button._curl = {
    canvas,
    updatePhoto(img, cardCanvas) {
      if (imgEl) imgEl.removeEventListener('load', syncTexture);
      imgEl = img; cardSrc = cardCanvas;
      imgEl.addEventListener('load', syncTexture);
      revealed = false; target = 0; t = 0;
      syncTexture();
      clearTimeout(timer);
      timer = setTimeout(() => { if (imgEl === img) { revealed = true; target = rest; } }, revealDelay);
    },
    openNow() { revealed = true; target = 1; },
    destroy() { cancelAnimationFrame(raf); clearTimeout(timer); if (imgEl) imgEl.removeEventListener('load', syncTexture); button._curl = null; }
  };
  raf = requestAnimationFrame(frame);
  return ctl;
}
