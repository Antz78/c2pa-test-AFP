// Production metadata: extraction and display, not identity verification.
// Never infer author from copyright, or editorial source from the C2PA signer.
export function signedPhotoFields(active,store={}){
  const key=store.active_manifest??store.activeManifest;
  const stored=store.manifests?.[key];
  const candidates=[active,...(stored&&stored!==active?[stored]:[])].filter(Boolean);
  const result={};
  const decode=v=>{
    if(typeof v==='string'&&/^\s*[\[{]/.test(v)){
      try{return JSON.parse(v);}catch(_){}
    }
    return v;
  };
  const text=v=>{
    v=decode(v);
    if(typeof v==='string')return v.trim()||null;
    if(Array.isArray(v))return v.map(text).filter(Boolean).join(', ')||null;
    if(v&&typeof v==='object')return text(v.name??v['@value']??v.value);
    return null;
  };
  const set=(key,v)=>{const value=text(v);if(value&&!result[key]&&value.length<=300)result[key]=value;};
  for(const manifest of candidates){
    const a=manifest.assertions;
    const assertions=Array.isArray(a)?a:a&&typeof a==='object'
      ?Object.entries(a).map(([label,data])=>({label,data})):[];
    for(const assertion of assertions){
      if(!/(?:stds\.schema-org|stds\.exif|c2pa\.metadata|stds\.iptc|creativework)/i.test(
        String(assertion?.label??assertion?.type??'')))continue;
      const visit=(node,depth)=>{
        node=decode(node);
        if(!node||typeof node!=='object'||depth>4)return;
        if(Array.isArray(node)){for(const x of node.slice(0,30))visit(x,depth+1);return;}
        set('author',node['dc:creator']??node['tiff:Artist']??node.byline??
          node.author??node.creator??node.photographer);
        set('date',node['exif:DateTimeOriginal']??node.DateTimeOriginal??
          node.dateCreated??node['photoshop:DateCreated']);
        set('source',node['photoshop:Source']??node.source);
        set('credit',node['photoshop:Credit']??node.creditText??node.credit);
        set('city',node['photoshop:City']??node.city);
        set('country',node['photoshop:Country']??node.country);
        const loc=node.contentLocation??node.locationCreated??node.locationShown??node.spatial;
        if(typeof loc==='string')set('place',loc);
        else if(loc&&typeof loc==='object'){
          set('place',loc.name);
          if(loc.address&&typeof loc.address==='object'){
            set('city',loc.address.addressLocality);
            set('country',loc.address.addressCountry);
          }
        }
        const make=text(node['tiff:Make']??node.make);
        const model=text(node['tiff:Model']??node.model);
        if(make||model)set('camera',[make,model].filter(Boolean).join(' '));
        for(const [k,value] of Object.entries(node)){
          if(/^(?:@graph|about|image|creativework|metadata|exif|iptc)$/i.test(k))
            visit(value,depth+1);
        }
      };
      visit(assertion?.data??assertion?.value??assertion,0);
    }
  }
  return result;
}
export function metadataFields(photo,{active=null,cameraFromProvenance=null}={}){
  const signed=signedPhotoFields(active,photo?.store??{});
  const ex=photo?.exif??{},iptc=ex.iptc??{},xmp=ex.xmp??{};
  const c2paOrigin=photo?.state==='bad'?'C2PA (vérification en échec)':'C2PA';
  const first=options=>{
    for(const [value,origin] of options){
      if(value!==undefined&&value!==null&&String(value).trim())
        return {value:String(value).trim(),origin};
    }
    return {value:null,origin:''};
  };
  const place=obj=>[obj.sublocation,obj.city,obj.province,obj.country].filter(Boolean).join(', ');
  const locationSigned=[signed.place,[signed.city,signed.country].filter(Boolean).join(', ')]
    .find(v=>v&&v.trim());
  return {
    author:first([[signed.author ,c2paOrigin],[ex.artist,'EXIF'],[iptc.author,'IPTC'],[xmp.author,'XMP']]),
    location:first([[locationSigned ,c2paOrigin],[place(iptc),'IPTC'],[place(xmp),'XMP']]),
    date:first([[signed.date ,c2paOrigin],[ex.date,'EXIF DateTimeOriginal'],
      [iptc.captureDate,'IPTC Date Created'],[xmp.dateOriginal,'XMP DateTimeOriginal'],
      [xmp.dateCreated,'XMP DateCreated']]),
    source:first([[signed.source ,c2paOrigin],[iptc.source,'IPTC'],[xmp.source,'XMP']]),
    credit:first([[signed.credit ,c2paOrigin],[iptc.credit,'IPTC'],[xmp.credit,'XMP']]),
    camera:first([[signed.camera ,c2paOrigin],
      [[ex.cameraMake,ex.cameraModel].filter(Boolean).join(' '),'EXIF'],
      [cameraFromProvenance,'C2PA (provenance d’appareil)']]),
    gps:first([[ex.gps?.latitude!=null&&ex.gps?.longitude!=null
      ?ex.gps.latitude.toFixed(6)+', '+ex.gps.longitude.toFixed(6):null,'EXIF GPS']]),
    caption:first([[iptc.caption,'IPTC']])
  };
}
export function buildPhotoInformation(photo,{field,section,readerFold,active,
  cameraFromProvenance,language='fr'}){
  const fr=language!=='en',values=metadataFields(photo,{active,cameraFromProvenance});
  const labels=fr
    ?[['Auteur / photographe','author'],['Lieu','location'],['Date de prise de vue','date'],
      ['Source','source'],['Crédit','credit'],['Appareil','camera'],
      ['Coordonnées GPS','gps'],['Légende','caption']]
    :[['Author / photographer','author'],['Location','location'],['Capture date','date'],
      ['Source','source'],['Credit','credit'],['Camera','camera'],
      ['GPS coordinates','gps'],['Caption','caption']];
  const rows=labels.map(([label,key])=>{
    const item=values[key];
    return field(label,item.value,'neutral',item.origin
      ?(fr?'Déclaration : ':'Declared in: ')+item.origin:'');
  });
  const notice=document.createElement('p');
  notice.className='afp-reader-technical-intro';
  notice.textContent=fr
    ?(photo?.state==='bad'
      ?'Attention : la validation C2PA a échoué. Les noms, dates et lieux ci-dessous sont des déclarations et ne doivent pas être attribués comme vérifiés.'
      :'Ces champs sont déclarés dans le manifeste C2PA ou les métadonnées du fichier. Ils ne prouvent ni la réalité de la scène ni l’identité du photographe.')
    :(photo?.state==='bad'
      ?'Warning: C2PA validation failed. Names, dates and locations below are declarations, not verified attributions.'
      :'These are declared C2PA or file metadata, not proof of the scene or photographer’s identity.');
  const fold=readerFold(fr?'Informations sur la photo':'Photo information',
    notice,section(fr?'Informations de production':'Production information',rows));
  fold.classList.add('afp-reader-photo-information');
  return fold;
}