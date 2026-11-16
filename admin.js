(() => {
 const sb=window.berayPortal,$=s=>document.querySelector(s),SUPA=window.BERAY_PORTAL_CONFIG.supabaseUrl;
 let admin=null,submissions=[],revisions=[],publications=[],activeTab='submissions';
 const msg=(s)=>$('#adminLoginMessage').textContent=s;
 const add=(parent,tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;};
 const safeSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9.-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
 const setBusy=(b,v)=>b.disabled=v;
 function setLoggedIn(user){admin=user;$('#adminIdentity').textContent=user.email||'Yönetici';$('#adminSignOut').classList.remove('hidden');$('#adminLogin').classList.add('hidden');$('#adminDashboard').classList.remove('hidden');}
 async function checkUser(){
   const {data:{user}}=await sb.auth.getUser();
   if(!user){$('#adminLogin').classList.remove('hidden');$('#adminDashboard').classList.add('hidden');return;}
   if(user.app_metadata?.beray_admin!==true && user.app_metadata?.beray_admin!=='true'){
     $('#adminLogin').classList.remove('hidden');$('#adminDashboard').classList.add('hidden');msg('Bu hesap yönetici olarak yetkilendirilmemiş. Supabase Auth App Metadata içine beray_admin=true eklenmeli.');
     return;
   }
   setLoggedIn(user);await loadData();
 }
 $('#adminLoginBtn').onclick=async()=>{const email=$('#adminEmail').value.trim(),password=$('#adminPassword').value;setBusy($('#adminLoginBtn'),true);const {error}=await sb.auth.signInWithPassword({email,password});if(error){msg(error.message);setBusy($('#adminLoginBtn'),false);return;}await checkUser();setBusy($('#adminLoginBtn'),false);};
 $('#adminSignOut').onclick=async()=>{await sb.auth.signOut();admin=null;$('#adminIdentity').textContent='Giriş gerekli';$('#adminSignOut').classList.add('hidden');$('#adminLogin').classList.remove('hidden');$('#adminDashboard').classList.add('hidden');};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.className=x===b?'btn':'btn secondary');renderList();$('#adminDetail').classList.add('hidden');});
 async function loadData(){
   const [s,r,p]=await Promise.all([
     sb.from('beray_submissions').select('*').order('created_at',{ascending:false}),
     sb.from('beray_revisions').select('*').order('created_at',{ascending:false}),
     sb.from('beray_publications').select('*').order('created_at',{ascending:false})
   ]);
   if(s.error||r.error||p.error){$('#adminList').textContent='Veri alınamadı: '+(s.error||r.error||p.error).message;return;}
   submissions=s.data||[];revisions=r.data||[];publications=p.data||[];renderList();
 }
 function renderList(){
   const host=$('#adminList');host.innerHTML='';
   let items=activeTab==='submissions'?submissions:activeTab==='revisions'?revisions:publications;
   if(activeTab==='revisions')items=items.map(r=>({...r,submission:submissions.find(s=>s.id===r.submission_id)}));
   if(!items.length){add(host,'p','muted','Bu bölümde kayıt yok.');return;}
   items.forEach(item=>{
     const c=add(host,'article','submission');const heading=add(c,'h3',null,activeTab==='revisions'?(item.submission?.project_name||'Başvuru')+' · v'+item.version:item.project_name||item.slug);
     add(c,'p',null,activeTab==='submissions'?(item.kind==='domain'?'BYSAM':'BSTORE')+' · '+item.slug+' · '+item.developer_name:activeTab==='revisions'?'Yeni sürüm · '+item.version+' · '+(item.submission?.slug||''):(item.kind==='domain'?'BYSAM':'BSTORE')+' · '+item.slug+' · v'+item.version);
     const st=add(c,'span','status',item.status|| (item.is_active?'Yayında':'Pasif'));
     const b=add(c,'button','btn secondary','İncele / yönet');b.style.marginTop='12px';b.onclick=()=>activeTab==='submissions'?showSubmission(item):activeTab==='revisions'?showRevision(item):showPublication(item);
   });
 }
 async function sourceLinks(host,files){
   for(const f of files||[]){
     const wrap=add(host,'div','list-item');add(wrap,'strong',null,f.name+' ');
     add(wrap,'span','muted',Math.ceil((f.size||0)/1024)+' KB');
     const {data,error}=await sb.storage.from('beray-submissions').createSignedUrl(f.path,3600);
     if(data?.signedUrl){const a=add(wrap,'a',null,'Dosyayı aç');a.href=data.signedUrl;a.target='_blank';a.rel='noopener';a.style.marginLeft='12px';}
     else add(wrap,'small','muted',error?.message||'Dosya bağlantısı alınamadı.');
   }
 }
 function detailHeader(title,subtitle){const d=$('#adminDetail');d.innerHTML='';d.classList.remove('hidden');add(d,'h2',null,title);add(d,'p','muted',subtitle||'');const close=add(d,'button','btn ghost','Kapat');close.onclick=()=>d.classList.add('hidden');return d;}
 async function showSubmission(row){
   const d=detailHeader(row.project_name,(row.kind==='domain'?'BYSAM alan adı':'BSTORE uygulaması')+' · '+row.slug+' · geliştirici '+row.developer_name+' ('+row.developer_email+')');
   add(d,'p',null,row.description);add(d,'p','muted','Sürüm '+row.version+' · Başvuru: '+new Date(row.created_at).toLocaleString('tr-TR'));
   add(d,'h3',null,'Kod dosyaları');await sourceLinks(d,row.source_files);add(d,'h3',null,'Ek dosyalar');await sourceLinks(d,row.attachment_files);
   const note=add(d,'textarea');note.placeholder='Başvuru notu / ret nedeni';note.value=row.admin_note||'';
   const actions=add(d,'div','row');
   const approve=add(actions,'button','btn','Onayla ve yayımla');approve.onclick=async()=>{setBusy(approve,true);try{await publishSubmission(row,note.value);await loadData();d.classList.add('hidden');}catch(e){alert('Yayımlama başarısız: '+e.message);}finally{setBusy(approve,false);}};
   const reject=add(actions,'button','btn danger','Reddet');reject.onclick=async()=>{if(!note.value.trim()){alert('Ret nedeni yazmalısın.');return;}setBusy(reject,true);try{const {error}=await sb.from('beray_submissions').update({status:'rejected',admin_note:note.value.trim(),updated_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;await sendMessage(row,'Başvurun reddedildi',note.value.trim());await loadData();d.classList.add('hidden');}catch(e){alert(e.message);}finally{setBusy(reject,false);}};
   const open=add(actions,'button','btn secondary','Yayın varsa aç');open.onclick=()=>{const p=publications.find(x=>x.submission_id===row.id);if(p?.public_base_url)window.open(p.public_base_url,'_blank','noopener');else alert('Henüz yayımlanmamış.');};
   const del=add(actions,'button','btn danger','Başvuruyu tamamen sil');
   del.onclick=async()=>{
     if(!confirm('Başvuru, tüm revizyonları ve yüklenen kaynak dosyaları kalıcı olarak silinsin mi?'))return;
     setBusy(del,true);
     try{
       const privatePaths=[...(row.source_files||[]),...(row.attachment_files||[])].map(file=>file.path);
       revisions.filter(revision=>revision.submission_id===row.id).forEach(revision=>privatePaths.push(...[...(revision.source_files||[]),...(revision.attachment_files||[])].map(file=>file.path)));
       if(privatePaths.length){const {error}=await sb.storage.from('beray-submissions').remove(privatePaths);if(error)throw error;}
       const pub=publications.find(item=>item.submission_id===row.id);
       if(pub){const paths=(pub.files||[]).map(file=>file.path);if(paths.length){const {error}=await sb.storage.from('beray-published').remove(paths);if(error)throw error;}}
       const {error}=await sb.from('beray_submissions').delete().eq('id',row.id);if(error)throw error;
       await loadData();d.classList.add('hidden');
     }catch(error){alert('Başvuru silinemedi: '+error.message);}
     finally{setBusy(del,false);}
   };
 }
 async function copyToPublished(fileRows,slug,kind,revisionId){
   const folder='published/'+kind+'/'+safeSlug(slug)+(revisionId?'/'+revisionId:'');
   const entries=[];
   for(const f of fileRows||[]){
     const {data,error}=await sb.storage.from('beray-submissions').download(f.path);if(error)throw error;
     if(f.name.toLowerCase().endsWith('.zip')){
       if(!window.JSZip)throw new Error('ZIP çözücü yüklenemedi.');
       const archive=await window.JSZip.loadAsync(data);
       const names=Object.keys(archive.files).filter(n=>!archive.files[n].dir);
       if(names.length>120)throw new Error('ZIP paketi 120 dosya sınırını aşıyor.');
       if(names.some(n=>n.startsWith('/')||n.split('/').includes('..')))throw new Error('ZIP içinde güvenli olmayan dosya yolu bulundu.');
       const indexPath=names.find(n=>n.toLowerCase()==='index.html')||names.find(n=>n.toLowerCase().endsWith('/index.html'));
       const root=indexPath&&indexPath.includes('/')?indexPath.slice(0,indexPath.toLowerCase().lastIndexOf('index.html')):'';
       let expandedBytes=0;
       for(const name of names){
         const relative=name.startsWith(root)?name.slice(root.length):name;
         if(!relative)continue;
         const blob=await archive.file(name).async('blob');
         if(blob.size>25*1024*1024)throw new Error(name+' dosyası 25 MB sınırını aşıyor.');
         expandedBytes+=blob.size;if(expandedBytes>100*1024*1024)throw new Error('Açılmış ZIP toplamı 100 MB sınırını aşıyor.');
         entries.push({name:relative,blob,type:blob.type||mimeFor(relative),size:blob.size});
       }
     }else entries.push({name:f.name,blob:data,type:f.type||'application/octet-stream',size:f.size||data.size});
   }
   const output=[];
   for(const item of entries){
     const parts=item.name.split('/').filter(Boolean).map(safeSlug);
     if(!parts.length||parts.some(x=>!x||x==='..'))continue;
     const relative=parts.join('/');
     const path=folder+'/'+relative;
     const {error}=await sb.storage.from('beray-published').upload(path,item.blob,{upsert:true,contentType:item.type||mimeFor(relative),cacheControl:'60'});
     if(error)throw error;
     output.push({name:relative,path,size:item.size,type:item.type||mimeFor(relative)});
   }
   const entry=output.find(f=>f.name.toLowerCase()==='index.html');
   if(!entry)throw new Error('Yayın paketinde kök dizinde index.html bulunamadı. ZIP kökünde veya seçilen dosyalar arasında index.html olmalı.');
   const publicUrl=SUPA+'/storage/v1/object/public/beray-published/'+entry.path.split('/').map(encodeURIComponent).join('/');
   return {files:output,publicUrl};
 }
 function mimeFor(name){
   const ext=String(name).toLowerCase().split('.').pop();
   return ({html:'text/html',htm:'text/html',css:'text/css',js:'application/javascript',mjs:'application/javascript',jsx:'application/javascript',ts:'application/javascript',tsx:'application/javascript',json:'application/json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',md:'text/plain',xml:'application/xml',wasm:'application/wasm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',eot:'application/vnd.ms-fontobject',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm'})[ext]||'application/octet-stream';
 }
 async function sendMessage(row,subject,body){
   const {error}=await sb.from('beray_messages').insert({owner_id:row.owner_id,submission_id:row.id,subject,body});
   if(error)console.warn('Kullanıcı bildirimi gönderilemedi:',error.message);
 }
 async function publishSubmission(row,note){
   const existing=publications.find(p=>p.submission_id===row.id);
   const copied=await copyToPublished([...(row.source_files||[]),...(row.attachment_files||[])],row.slug,row.kind);
   const payload={submission_id:row.id,kind:row.kind,slug:row.slug,project_name:row.project_name,version:row.version,entry_path:'index.html',public_base_url:copied.publicUrl,files:copied.files,is_active:true,created_by:admin.id,updated_at:new Date().toISOString()};
   const {error}=existing?await sb.from('beray_publications').update(payload).eq('id',existing.id):await sb.from('beray_publications').insert(payload);
   if(error)throw error;
   const {error:updateError}=await sb.from('beray_submissions').update({status:'approved',admin_note:note||'Başvurun onaylandı ve yayımlandı.',updated_at:new Date().toISOString()}).eq('id',row.id);
   if(updateError)throw updateError;
   await sendMessage(row,'Projen yayımlandı',note||'Başvurun onaylandı. Yayın bağlantın: '+copied.publicUrl);
 }
 async function showRevision(rev){
   const row=submissions.find(s=>s.id===rev.submission_id);if(!row){alert('Bağlı başvuru bulunamadı.');return;}
   const d=detailHeader((row.project_name||row.slug)+' · yeni sürüm '+rev.version,'Yayın: '+row.slug+' · '+(row.kind==='domain'?'BYSAM':'BSTORE'));
   add(d,'h3',null,'Yeni kod dosyaları');await sourceLinks(d,rev.source_files);add(d,'h3',null,'Ekler');await sourceLinks(d,rev.attachment_files);
   const note=add(d,'textarea');note.placeholder='İnceleme notu';note.value=rev.admin_note||'';
   const actions=add(d,'div','row');const approve=add(actions,'button','btn','Sürümü onayla ve uygula');
   approve.onclick=async()=>{setBusy(approve,true);try{const copied=await copyToPublished([...(rev.source_files||[]),...(rev.attachment_files||[])],row.slug,row.kind,rev.id);const pub=publications.find(p=>p.submission_id===row.id);if(!pub)throw new Error('Önce ilk sürüm yayımlanmalı.');const {error}=await sb.from('beray_publications').update({version:rev.version,files:copied.files,public_base_url:copied.publicUrl,updated_at:new Date().toISOString()}).eq('id',pub.id);if(error)throw error;const {error:e2}=await sb.from('beray_submissions').update({version:rev.version,source_files:rev.source_files,attachment_files:rev.attachment_files,status:'approved',admin_note:note.value||'Yeni sürüm yayımlandı.',revision:row.revision+1,updated_at:new Date().toISOString()}).eq('id',row.id);if(e2)throw e2;const {error:e3}=await sb.from('beray_revisions').update({status:'approved',admin_note:note.value||'Onaylandı.'}).eq('id',rev.id);if(e3)throw e3;await sendMessage(row,'Yeni sürümün yayımlandı','Sürüm '+rev.version+' yayına alındı.');await loadData();d.classList.add('hidden');}catch(e){alert(e.message);}finally{setBusy(approve,false);}};
   const reject=add(actions,'button','btn danger','Güncellemeyi reddet');reject.onclick=async()=>{if(!note.value.trim()){alert('Ret nedeni gerekli.');return;}const {error}=await sb.from('beray_revisions').update({status:'rejected',admin_note:note.value.trim()}).eq('id',rev.id);if(error){alert(error.message);return;}await sendMessage(row,'Sürüm güncellemesi reddedildi',note.value.trim());await loadData();d.classList.add('hidden');};
 }
 async function showPublication(pub){
   const row=submissions.find(s=>s.id===pub.submission_id);
   const d=detailHeader(pub.project_name,pub.kind+' · '+pub.slug+' · v'+pub.version+' · '+(pub.is_active?'yayında':'pasif'));
   const open=add(d,'a','btn secondary','Yayını aç');open.href=pub.public_base_url;open.target='_blank';open.rel='noopener';open.style.display='inline-block';open.style.textDecoration='none';
   const name=add(d,'input');name.value=pub.project_name;name.placeholder='Yayın adı';
   const slug=add(d,'input');slug.value=pub.slug;slug.placeholder='Alan adı / kimlik';
   const version=add(d,'input');version.value=pub.version;version.placeholder='Sürüm';
   const description=add(d,'textarea');description.value=row?.description||'';description.placeholder='Açıklama';
   const save=add(d,'button','btn','Genel bilgileri kaydet');save.onclick=async()=>{
     const newName=name.value.trim(),newSlug=slug.value.trim(),newVersion=version.value.trim();
     const {error}=await sb.from('beray_publications').update({project_name:newName,slug:newSlug,version:newVersion,updated_at:new Date().toISOString()}).eq('id',pub.id);
     if(error){alert(error.message);return;}
     if(row){const {error:e}=await sb.from('beray_submissions').update({project_name:newName,slug:newSlug,version:newVersion,description:description.value,updated_at:new Date().toISOString()}).eq('id',row.id);if(e){alert(e.message);return;}}
     await loadData();alert('Yayın bilgileri güncellendi.');
   };
   add(d,'h3',null,'Kaynak dosyalarını düzenle');
   const codeFiles=(pub.files||[]).filter(file=>/\.(html?|css|js|mjs|json|txt|xml|svg|md|ts|tsx|jsx)$/i.test(file.name));
   const select=add(d,'select');
   codeFiles.forEach(file=>{const option=document.createElement('option');option.value=file.path;option.textContent=file.name;select.appendChild(option);});
   const editor=add(d,'textarea');editor.style.minHeight='300px';editor.placeholder='Dosya içeriği seçilince yüklenecek…';
   const fileStatus=add(d,'p','muted','');
   async function loadEditor(){
     const file=codeFiles.find(x=>x.path===select.value);if(!file)return;
     editor.value='Yükleniyor…';fileStatus.textContent=file.name;
     try{
       const url=SUPA+'/storage/v1/object/public/beray-published/'+file.path.split('/').map(encodeURIComponent).join('/');
       const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);
       editor.value=await response.text();
     }catch(e){editor.value='Dosya yüklenemedi: '+e.message;}
   }
   select.onchange=loadEditor;
   if(codeFiles.length)await loadEditor();else editor.value='Düzenlenebilir kaynak dosyası bulunamadı.';
   const saveCode=add(d,'button','btn','Seçili dosyayı kaydet');
   saveCode.onclick=async()=>{
     const file=codeFiles.find(x=>x.path===select.value);if(!file)return;
     setBusy(saveCode,true);
     try{
       const blob=new Blob([editor.value],{type:mimeFor(file.name)+';charset=utf-8'});
       const {error}=await sb.storage.from('beray-published').upload(file.path,blob,{upsert:true,contentType:mimeFor(file.name),cacheControl:'0'});
       if(error)throw error;
       alert(file.name+' güncellendi.');
     }catch(e){alert('Dosya kaydedilemedi: '+e.message);}finally{setBusy(saveCode,false);}
   };
   const toggle=add(d,'button',pub.is_active?'btn secondary':'btn',pub.is_active?'Yayını devre dışı bırak':'Yayını yeniden aç');
   toggle.onclick=async()=>{const {error}=await sb.from('beray_publications').update({is_active:!pub.is_active,updated_at:new Date().toISOString()}).eq('id',pub.id);if(error){alert(error.message);return;}await loadData();d.classList.add('hidden');};
   const del=add(d,'button','btn danger','Yayını ve başvuruyu sil');
   del.onclick=async()=>{
     if(!confirm('Bu yayın, bağlı başvuru, sürüm dosyaları ve tüm depolanmış kod dosyaları kalıcı olarak silinsin mi?'))return;
     try{
       const publishedPaths=(pub.files||[]).map(file=>file.path);
       if(publishedPaths.length){const {error}=await sb.storage.from('beray-published').remove(publishedPaths);if(error)throw error;}
       if(row){
         const privatePaths=[...(row.source_files||[]),...(row.attachment_files||[])].map(file=>file.path);
         const relatedRevisions=revisions.filter(revision=>revision.submission_id===row.id);
         relatedRevisions.forEach(revision=>privatePaths.push(...[...(revision.source_files||[]),...(revision.attachment_files||[])].map(file=>file.path)));
         if(privatePaths.length){const {error}=await sb.storage.from('beray-submissions').remove(privatePaths);if(error)throw error;}
       }
       const {error}=await sb.from('beray_submissions').delete().eq('id',pub.submission_id);if(error)throw error;
       await loadData();d.classList.add('hidden');
     }catch(e){alert('Silme başarısız: '+e.message);}
   };
 }
 checkUser();
})();