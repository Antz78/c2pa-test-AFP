
import {createC2pa,Reader} from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';

const PHOTO='./D36K4MF-org.jpg';
const WASM='https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';
const $=s=>document.querySelector(s);
const badge=$('#cr'),dialog=$('#credentials'),info=$('#information');
const status=$('#status'),explanation=$('#explanation'),output=$('#manifest');

$('#close').onclick=()=>dialog.close();
badge.onclick=()=>dialog.showModal();
dialog.onclick=e=>{if(e.target===dialog)dialog.close()};

function row(icon,title,description,value='',kind=''){
 const d=document.createElement('div');d.className='info-row';
 const i=document.createElement('div');i.className='ico '+kind;i.textContent=icon;
 const t=document.createElement('div');t.className='info-text';
 const b=document.createElement('strong');b.textContent=title;
 const s=document.createElement('small');s.textContent=description;
 t.append(b,s);d.append(i,t);
 if(value){const v=document.createElement('div');v.className='value';
 if(['green','orange','red'].includes(kind))v.className+=' pill '+(kind==='green'?'':kind);
 v.textContent=value;d.append(v)}
 info.append(d);
}

function dateFR(value){
 if(!value)return 'Non renseignée';
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return value;
 return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
}

async function init(){
 let c2pa,reader;
 try{
  const response=await fetch(PHOTO,{cache:'no-store'});
  if(!response.ok)throw Error('Photo introuvable : HTTP '+response.status);
  const blob=await response.blob();
  c2pa=await createC2pa({wasmSrc:WASM});
  reader=await Reader.fromBlob(c2pa,'image/jpeg',blob);
  if(!reader){
   status.textContent='Aucune information C2PA détectée.';
   return;
  }

  const store=await reader.manifestStore();
  const active=await reader.activeManifest();
  const id=store?.active_manifest??store?.activeManifest;
  const m=store?.manifests?.[id]??active??{};
  const assertions=m.assertions??[];
  const exif=assertions.find(a=>a.label==='stds.exif')?.data??{};
  const creative=assertions.find(a=>a.label==='stds.schema-org.CreativeWork')?.data??{};
  const results=store?.validation_results?.activeManifest??{};
  const success=results.success??[];
  const failure=results.failure??[];
  const statuses=store.validation_status??[];
  const good=new Set(success.map(x=>x.code));
  const errors=[...new Set([...failure,...statuses].map(x=>x.code))];
  const other=errors.filter(x=>x!=='signingCredential.untrusted');

  const signed=good.has('claimSignature.validated');
  const intact=good.has('assertion.dataHash.match');
  const untrusted=errors.includes('signingCredential.untrusted');
  const author=creative.author?.[0]?.name??exif['dc:creator'];
  const camera=exif['tiff:Model'];
  const maker=exif['tiff:Make'];
  const taken=exif['exif:DateTimeOriginal'];
  const issuer=m.signature_info?.issuer;
  const complete=signed&&intact&&other.length===0;

  info.replaceChildren();
  badge.hidden=false;
  output.textContent=JSON.stringify(store,null,2);

  row('📷','Appareil photo',
      'Modèle déclaré dans les informations de prise de vue.',
      [maker,camera].filter(Boolean).join(' ')||'Non renseigné');

  row('👤','Photographe',
      'Nom du photographe déclaré dans le fichier.',
      author||'Non renseigné');

  row('📅','Date de prise de vue',
      taken?'Date enregistrée par l’appareil : '+taken:'Date non renseignée.',
      dateFR(taken));

  row(intact?'✓':'?','Intégrité de la photo',
      intact?'Le fichier correspond à l’empreinte numérique enregistrée lors de sa signature.':
      'Le contrôle d’intégrité n’a pas été confirmé.',
      intact?'Vérifiée':'À vérifier',intact?'green':'orange');

  row(signed?'✓':'?','Signature de provenance',
      signed?'La signature numérique des informations d’origine est valide.':
      'La validité de la signature n’a pas été confirmée.',
      signed?'Valide':'À vérifier',signed?'green':'orange');

  if(untrusted){
   row('!','Confiance dans le certificat',
       'Le certificat utilisé pour signer la photo n’est pas reconnu comme fiable par ce vérificateur.',
       'Non établie','orange');
  }else if(other.length){
   row('!','Vérification du certificat',
       'Une ou plusieurs anomalies ont été signalées.',
       'Anomalie','red');
  }else{
   row('✓','Vérification du certificat',
       'Aucune anomalie de confiance n’a été signalée par ce vérificateur.',
       'Sans alerte','green');
  }

  if(complete&&untrusted){
   status.textContent='Signature et intégrité vérifiées · Confiance du certificat non établie';
   explanation.textContent=
    'Les contrôles montrent que la signature est valide et que les données de la photographie correspondent aux informations signées. En revanche, le certificat du signataire n’est pas reconnu comme fiable par ce vérificateur. Cela ne signifie pas que la photo a été modifiée, mais son origine ne bénéficie pas d’une confiance entièrement établie.';
  }else if(complete){
   status.textContent='Signature et intégrité vérifiées · Aucune anomalie signalée';
   explanation.textContent=
    'Les contrôles de signature et d’intégrité ont réussi. Ces vérifications concernent les informations numériques et ne prouvent pas à elles seules que la scène photographiée est authentique.';
  }else{
   status.textContent='Vérification C2PA : des points restent à examiner';
   explanation.textContent=
    'Certains contrôles n’ont pas été confirmés ou ont signalé des anomalies. Consultez les détails techniques avant de tirer une conclusion sur la provenance de cette photographie.';
  }

  if(issuer)row('🏢','Émetteur déclaré du certificat',
      'Organisation indiquée dans le certificat de signature.',issuer);

 }catch(e){
  console.error('C2PA',e);
  status.textContent='Impossible de vérifier les informations C2PA.';
  explanation.textContent=e.message;
  output.textContent=String(e.stack??e);
 }finally{
  if(reader)try{await reader.free()}catch(e){console.warn(e)}
  if(c2pa)try{c2pa.dispose()}catch(e){console.warn(e)}
 }
}

init();
