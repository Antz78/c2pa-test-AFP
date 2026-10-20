
import { createC2pa, Reader } from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';
const PHOTO_URL='./D36K4MF-org.jpg',WASM_URL='https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';
const $=s=>document.querySelector(s),status=$('#status'),output=$('#manifest'),badge=$('#cr'),dialog=$('#credentials'),summary=$('#summary'),checks=$('#checks'),meta=$('#meta');
$('#close').addEventListener('click',()=>dialog.close());badge.addEventListener('click',()=>dialog.showModal());

function setStatus(message,kind=''){status.textContent=message;status.className=`status ${kind}`;}
function line(label,value){const p=document.createElement('p'),b=document.createElement('strong');b.textContent=label+' : ';p.append(b,document.createTextNode(String(value??'Non renseigné')));summary.append(p);}
function check(symbol,title,description,kind){const d=document.createElement('div');d.className='check '+kind;const i=document.createElement('span');i.className='symbol';i.textContent=symbol;const wrap=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=title;small.textContent=description;wrap.append(strong,small);d.append(i,wrap);checks.append(d);}
function field(label,value){if(value==null||value==='')return;const d=document.createElement('div');d.className='metaitem';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=String(value);d.append(a,b);meta.append(d);}

async function start(){let c2pa,reader;try{
 const response=await fetch(PHOTO_URL,{cache:'no-store'});if(!response.ok)throw Error(`Photo introuvable (HTTP ${response.status})`);
 c2pa=await createC2pa({wasmSrc:WASM_URL});reader=await Reader.fromBlob(c2pa,'image/jpeg',await response.blob());
 if(!reader){setStatus('Aucun manifeste C2PA détecté.','warn');output.textContent='Aucun manifeste trouvé.';return;}
 const store=await reader.manifestStore(),active=await reader.activeManifest();output.textContent=JSON.stringify(store,null,2);
 const id=store?.active_manifest??store?.activeManifest,manifest=store?.manifests?.[id]??active??{},results=store?.validation_results?.activeManifest??store?.validationResults?.activeManifest??{};
 const success=Array.isArray(results.success)?results.success:[],failure=Array.isArray(results.failure)?results.failure:[],statuses=Array.isArray(store?.validation_status)?store.validation_status:[];
 const sc=new Set(success.map(x=>x.code)),fc=new Set([...failure,...statuses].map(x=>x.code));
 const signature=sc.has('claimSignature.validated'),integrity=sc.has('assertion.dataHash.match'),untrusted=fc.has('signingCredential.untrusted');
 const otherFailures=[...new Set([...failure,...statuses].filter(x=>x.code!=='signingCredential.untrusted').map(x=>x.code))];
 const issuer=manifest?.signature_info?.issuer??active?.signature_info?.issuer;
 const assertions=manifest?.assertions??active?.assertions??[];
 const author=assertions.find(x=>x.label==='stds.schema-org.CreativeWork')?.data?.author?.[0]?.name??assertions.find(x=>x.label==='stds.exif')?.data?.['dc:creator'];
 const camera=assertions.find(x=>x.label==='stds.exif')?.data?.['tiff:Model'];
 checks.replaceChildren();meta.replaceChildren();summary.replaceChildren();badge.hidden=false;
 check(signature?'✓':'?',signature?'Signature valide':'Signature non confirmée',signature?'La signature cryptographique a été vérifiée.':'La validation cryptographique n’a pas été confirmée.',signature?'good':'neutral');
 check(integrity?'✓':'?',integrity?'Photo intacte':'Intégrité non confirmée',integrity?'L’empreinte des données JPEG correspond.':'Le contrôle d’intégrité n’a pas été confirmé.',integrity?'good':'neutral');
 check(untrusted?'!':otherFailures.length?'×':'✓',untrusted?'Confiance non établie':otherFailures.length?'Anomalies de validation':'Aucune anomalie signalée',untrusted?'Le certificat du signataire n’est pas reconnu comme fiable par ce vérificateur.':otherFailures.length?otherFailures.join(', '):'Aucune erreur de confiance remontée par ce vérificateur.',untrusted?'caution':otherFailures.length?'bad':'good');
 field('Appareil',camera);field('Photographe',author);field('Émetteur du certificat',issuer);field('Nom original',manifest?.title);field('Générateur C2PA',manifest?.claim_generator);
 line('Photographie',manifest?.title);line('Photographe',author);line('Appareil',camera);line('Émetteur du certificat',issuer);line('Signature',signature?'Valide':'Non confirmée');line('Intégrité JPEG',integrity?'Vérifiée':'Non confirmée');line('Confiance',untrusted?'Certificat non reconnu par ce vérificateur':otherFailures.length?'Anomalies : '+otherFailures.join(', '):'Aucune anomalie signalée');line('État du SDK',store?.validation_state);
 if(otherFailures.length)setStatus('Des anomalies de validation ont été signalées.','error');
 else if(untrusted)setStatus('Signature et intégrité vérifiées ; confiance dans le certificat non établie.','warn');
 else if(signature&&integrity)setStatus('Signature et intégrité vérifiées ; aucune anomalie signalée.','ok');
 else setStatus('Manifeste détecté ; vérification à examiner.','warn');
 }catch(e){console.error('C2PA',e);setStatus('Lecture C2PA impossible : '+e.message,'error');output.textContent=String(e.stack??e);}
 finally{if(reader)try{await reader.free()}catch(e){console.warn(e)}if(c2pa)try{c2pa.dispose()}catch(e){console.warn(e)}}}
start();
