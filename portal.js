(() => {
 const sb=window.berayPortal,$=s=>document.querySelector(s);
 let currentUser=null,pendingKind=null;
 const bucket='beray-submissions',maxBytes=25*1024*1024;
 const say=(id,msg)=>{const e=$(id);if(e)e.textContent=msg;};
 const show=id=>$(id).classList.remove('hidden'),hide=id=>$(id).classList.add('hidden');
 const safeName=n=>n.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,120)||'file';
 function validateFiles(files,min,max,label){if(files.length<min||files.length>max)throw new Error(label+' sayısı '+min+'–'+max+' arasında olmalı.');for(const f of files)if(f.size>maxBytes)throw new Error(f.name+' dosyası 25 MB sınırını aşıyor.');}
 async function uploadFiles(files,uid,recordId,folder){
   const rows=[];
   for(let i=0;i<files.length;i++){
     const f=files[i],name=String(i+1).padStart(2,'0')+'_'+safeName(f.name),path=uid+'/'+recordId+'/'+folder+'/'+name;
     const {error}=await sb.storage.from(bucket).upload(path,f,{upsert:false,contentType:f.type||'application/octet-stream'});
     if(error)throw new Error(f.name+' yüklenemedi: '+error.message);
     rows.push({name:f.name,path,size:f.size,type:f.type||'application/octet-stream'});
   }
   return rows;
 }
 async function cleanup(paths){if(paths.length)await sb.storage.from(bucket).remove(paths);}
 async function refreshUser(){
   const {data:{user},error}=await sb.auth.getUser();
   currentUser=error?null:user||null;
   $('#userLabel').textContent=currentUser?currentUser.email:'Giriş yapılmadı';
   $('#sessionStatus').textContent=currentUser?'Oturum açık':'Oturum bekleniyor';
   if(currentUser){$('#developerEmail').value=currentUser.email||'';await loadMine();}
   else $('#mySubmissions').innerHTML='<p class="muted">Başvurularını ve sürümlerini görmek için giriş yap.</p>';
 }
 async function loadMine(){
   const {data,error}=await sb.from('beray_submissions').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:false});
   if(error){$('#mySubmissions').textContent='Yüklenemedi: '+error.message;return;}
   const host=$('#mySubmissions');host.innerHTML='';
   if(!data?.length){host.innerHTML='<p class="muted">Henüz başvurun yok. Başlamak için BYSAM veya BSTORE seç.</p>';return;}
   for(const row of data){
     const card=document.createElement('article');card.className='submission';
     const title=document.createElement('h3');title.textContent=row.project_name;
     const meta=document.createElement('p');meta.textContent=(row.kind==='domain'?'BYSAM · '+row.slug:'BSTORE · '+row.slug)+' · v'+row.version;
     const st=document.createElement('span');st.className='status';st.textContent=({pending:'İncelemede bekliyor',review:'Yönetici inceliyor',approved:'Yayımlandı',rejected:'Düzeltme gerekli'})[row.status]||row.status;
     const desc=document.createElement('p');desc.textContent=row.admin_note||row.description;
     card.append(title,meta,st,desc);
     if(row.status==='approved'||row.status==='rejected'){
       const b=document.createElement('button');b.className='btn secondary';b.textContent='Sürümü düzenle';b.onclick=()=>openRevision(row);card.append(b);
     }else{const p=document.createElement('p');p.className='file-note';p.textContent='Bu başvuru incelenirken yeni düzenleme gönderilemez.';card.append(p);}
     host.append(card);
   }
 }
 function openApply(kind){
   if(!currentUser){pendingKind=kind;show('authModal');return;}
   pendingKind=kind;$('#applyForm').reset();$('#developerEmail').value=currentUser.email||'';
   $('#applyTitle').textContent=kind==='domain'?'BYSAM domain başvurusu':'BSTORE uygulama başvurusu';
   $('#domainEndingWrap').classList.toggle('hidden',kind!=='domain');
   $('#categoryWrap').classList.toggle('hidden',kind!=='app');
   $('#slugLabel').textContent=kind==='domain'?'Alan adı (uzantısız)':'Uygulama kimliği';
   $('#slug').placeholder=kind==='domain'?'mamiyapti':'benim-uygulamam';
   $('#version').value='1.0.0';say('#applyMessage','');show('applyModal');
 }
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>openApply(b.dataset.kind)));
 $('#accountBtn').onclick=()=>show('authModal');$('#closeAuth').onclick=()=>hide('authModal');$('#closeApply').onclick=()=>hide('applyModal');$('#closeRevision').onclick=()=>hide('revisionModal');
 $('#signIn').onclick=async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;const {error}=await sb.auth.signInWithPassword({email,password});say('#authMessage',error?error.message:'Giriş başarılı.');if(!error){hide('authModal');await refreshUser();if(pendingKind){const k=pendingKind;pendingKind=null;openApply(k);}}};
 $('#signUp').onclick=async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;if(password.length<8){say('#authMessage','Şifre en az 8 karakter olmalı.');return;}const {data,error}=await sb.auth.signUp({email,password});say('#authMessage',error?error.message:(data.session?'Hesap oluşturuldu.':'Hesap oluşturuldu. E-posta doğrulama bağlantısını kontrol et.'));if(!error&&data.session){hide('authModal');await refreshUser();if(pendingKind){const k=pendingKind;pendingKind=null;openApply(k);}}};
 $('#applyForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!currentUser){say('#applyMessage','Önce giriş yap.');return;}
   const source=[...$('#sourceFiles').files],attachments=[...$('#attachmentFiles').files];
   try{
     validateFiles(source,1,7,'Kod dosyası');validateFiles(attachments,0,4,'Ek dosya');
     if(!source.some(f=>f.name.toLowerCase()==='index.html')&&!source.some(f=>f.name.toLowerCase().endsWith('.zip')))throw new Error('Kod dosyalarının arasında index.html bulunmalı veya index.html içeren bir ZIP paketi yüklemelisin.');
     const slugRaw=$('#slug').value.trim().toLowerCase();
     if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugRaw))throw new Error('Kimlik yalnızca küçük İngilizce harf, rakam ve tire içerebilir.');
     if(source.some(f=>f.name.includes('/')||f.name.includes('\\')))throw new Error('Dosya adında klasör yolu kullanma.');
     $('#submitApplication').disabled=true;say('#applyMessage','Dosyalar yükleniyor…');
     const id=crypto.randomUUID(),paths=[];
     try{
       const sourceRows=await uploadFiles(source,currentUser.id,id,'source');paths.push(...sourceRows.map(x=>x.path));
       const attachRows=attachments.length?await uploadFiles(attachments,currentUser.id,id,'attachments'):[];paths.push(...attachRows.map(x=>x.path));
       const kind=pendingKind,slug=kind==='domain'?slugRaw+$('#domainEnding').value:slugRaw;
       const description=(kind==='app'?'Kategori: '+$('#category').value+'\n\n':'')+$('#description').value.trim();
       const payload={id,owner_id:currentUser.id,kind,developer_name:$('#developerName').value.trim(),developer_email:$('#developerEmail').value.trim(),project_name:$('#projectName').value.trim(),slug,description,version:$('#version').value.trim(),source_files:sourceRows,attachment_files:attachRows,status:'pending',revision:1};
       const {error}=await sb.from('beray_submissions').insert(payload);if(error)throw error;
       say('#applyMessage','Başvuru alındı. Yönetici incelemesine gönderildi.');hide('applyModal');await loadMine();
     }catch(err){await cleanup(paths);throw err;}
   }catch(err){say('#applyMessage',err.message||String(err));}
   finally{$('#submitApplication').disabled=false;}
 });
 let revisionTarget=null;
 function openRevision(row){revisionTarget=row;$('#revisionId').value=row.id;$('#revisionVersion').value=row.version;$('#revisionForm').reset();$('#revisionId').value=row.id;$('#revisionVersion').value=row.version;say('#revisionMessage','');show('revisionModal');}
 $('#revisionForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!currentUser||!revisionTarget)return;
   const src=[...$('#revisionSources').files],att=[...$('#revisionAttachments').files];
   try{
     validateFiles(src,1,7,'Kod dosyası');validateFiles(att,0,4,'Ek dosya');
     if(!src.some(f=>f.name.toLowerCase()==='index.html')&&!src.some(f=>f.name.toLowerCase().endsWith('.zip')))throw new Error('Yeni sürümde index.html veya index.html içeren ZIP paketi zorunludur.');
     const version=$('#revisionVersion').value.trim();if(!version)throw new Error('Sürüm numarası gerekli.');
     $('#sendRevision').disabled=true;say('#revisionMessage','Yeni sürüm yükleniyor…');
     const rid=crypto.randomUUID(),paths=[];
     try{
       const sourceRows=await uploadFiles(src,currentUser.id,rid,'source');paths.push(...sourceRows.map(x=>x.path));
       const attachRows=att.length?await uploadFiles(att,currentUser.id,rid,'attachments'):[];paths.push(...attachRows.map(x=>x.path));
       const {error}=await sb.from('beray_revisions').insert({submission_id:revisionTarget.id,owner_id:currentUser.id,version,source_files:sourceRows,attachment_files:attachRows,status:'pending'});
       if(error)throw error;
       hide('revisionModal');await loadMine();
     }catch(err){await cleanup(paths);throw err;}
   }catch(err){say('#revisionMessage',err.message||String(err));}
   finally{$('#sendRevision').disabled=false;}
 });
 sb.auth.onAuthStateChange(()=>setTimeout(refreshUser,0));
 refreshUser();
})();