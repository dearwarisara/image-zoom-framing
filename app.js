const operationLabels={"zoom-out":"Zoom out","zoom-in":"Zoom in",resize:"Resize","portrait-landscape":"Portrait → Landscape","landscape-portrait":"Landscape → Portrait"};
const apiBase=location.hostname.endsWith('github.io')?'https://image-zoom-framing.optiwise-3224.chatgpt.site':'';
const apiUrl=path=>`${apiBase}${path}`;
const operationButtons=[...document.querySelectorAll('.operation')];
const selectedOperations=new Set();
let referenceChoice='no',mainFile=null,referenceFile=null,resultUrl='';
let accessRequired=false,accessPassword='';
const $=id=>document.getElementById(id);
const message=(text,type='error')=>{const node=$('message');node.textContent=text;node.classList.remove('hidden','success');if(type==='success')node.classList.add('success');};
const hideMessage=()=>$('message').classList.add('hidden');
function selected(group){return document.querySelector(`[data-group="${group}"] .selected`)?.dataset.value;}
function updateDetails(){
  const hasZoom=selectedOperations.has('zoom-in')||selectedOperations.has('zoom-out');
  const hasRatio=['resize','portrait-landscape','landscape-portrait'].some(x=>selectedOperations.has(x));
  const portraitToLandscape=selectedOperations.has('portrait-landscape')&&!selectedOperations.has('landscape-portrait');
  const landscapeToPortrait=selectedOperations.has('landscape-portrait')&&!selectedOperations.has('portrait-landscape');
  $('details-panel').classList.toggle('hidden',!selectedOperations.size);
  $('zoom-details').classList.toggle('hidden',!hasZoom);
  $('ratio-details').classList.toggle('hidden',!hasRatio);
  document.querySelectorAll('.ratio-option').forEach(option=>{
    const value=option.dataset.value;
    const hidden=portraitToLandscape&&!selectedOperations.has('resize')&&['4:5','9:16'].includes(value)
      ||landscapeToPortrait&&!selectedOperations.has('resize')&&['3:2','16:9'].includes(value);
    option.classList.toggle('hidden',hidden);
  });
  $('step-one-state').textContent=selectedOperations.size?`${selectedOperations.size} รายการ`: 'ยังไม่ได้เลือก';
  $('ref-dropzone').classList.toggle('hidden',referenceChoice!=='yes');
  updateAction();
}
function updateAction(){ $('edit-button').disabled=!(selectedOperations.size&&mainFile&&(referenceChoice==='no'||referenceFile)&&(!accessRequired||accessPassword))||$('edit-button').classList.contains('loading'); }
operationButtons.forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.operation;
  if(selectedOperations.has(key)){selectedOperations.delete(key);button.setAttribute('aria-pressed','false');}
  else{selectedOperations.add(key);button.setAttribute('aria-pressed','true');}
  updateDetails();hideMessage();
}));
document.querySelectorAll('[data-reference]').forEach(button=>button.addEventListener('click',()=>{
  referenceChoice=button.dataset.reference;
  document.querySelectorAll('[data-reference]').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active));});
  if(referenceChoice==='no'){referenceFile=null;$('reference-image').value='';$('ref-preview-wrap').classList.add('hidden');}
  updateDetails();
}));
document.querySelectorAll('[data-group]').forEach(group=>group.addEventListener('click',event=>{
  const button=event.target.closest('button[data-value]');if(!button)return;
  group.querySelectorAll('[data-value]').forEach(item=>item.classList.toggle('selected',item===button));
}));
function attachInput(input,which){
  const zone=$(which==='main'?'main-dropzone':'ref-dropzone');
  input.addEventListener('change',()=>{if(input.files?.[0])setFile(input.files[0],which);});
  ['dragenter','dragover'].forEach(event=>zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('dragging');}));
  ['dragleave','drop'].forEach(event=>zone.addEventListener(event,e=>{e.preventDefault();zone.classList.remove('dragging');if(event==='drop'&&e.dataTransfer.files?.[0])setFile(e.dataTransfer.files[0],which);}));
}
function setFile(file,which){
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){message('รองรับเฉพาะไฟล์ PNG, JPG และ WebP');return;}
  if(file.size>20*1024*1024){message('ไฟล์มีขนาดเกิน 20 MB กรุณาเลือกภาพที่เล็กลง');return;}
  if(which==='ref'&&referenceChoice!=='yes')return;
  const isMain=which==='main',preview=$(isMain?'main-preview':'ref-preview'),wrap=$(isMain?'main-preview-wrap':'ref-preview-wrap');
  if(isMain)mainFile=file;else referenceFile=file;
  preview.src=URL.createObjectURL(file);wrap.classList.remove('hidden');
  if(isMain){$('upload-hint').textContent=`ภาพหลักพร้อมแล้ว · ${file.name}`;}
  updateAction();hideMessage();
}
attachInput($('main-image'),'main');attachInput($('reference-image'),'ref');
$('remove-main').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();mainFile=null;$('main-image').value='';$('main-preview-wrap').classList.add('hidden');$('upload-hint').textContent='เลือกงานด้านบนก่อน แล้วอัปโหลดภาพหลักเพื่อเริ่มต้น';updateAction();});
$('remove-ref').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();referenceFile=null;$('reference-image').value='';$('ref-preview-wrap').classList.add('hidden');});
async function checkServer(){try{const response=await fetch(apiUrl('/api/health'));const data=await response.json();accessRequired=data.requiresAccess;$('access-panel').classList.toggle('hidden',!accessRequired);$('api-status').textContent=data.configured?'พร้อมใช้งาน':'รอตั้งค่า API key';if(!data.configured)$('api-status').previousElementSibling.style.background='#e9a27b';updateAction();}catch{$('api-status').textContent='เชื่อมต่อ image service ไม่ได้';$('api-status').previousElementSibling.style.background='#e9a27b';}}
checkServer();
$('access-save').addEventListener('click',()=>{accessPassword=$('access-password').value.trim();$('access-confirmation').classList.toggle('hidden',!accessPassword);updateAction();});
function buildPrompt(){
  const tasks=[...selectedOperations].map(key=>operationLabels[key]).join(', ');
  const parts=[`Edit the uploaded source image. Requested operations: ${tasks}.`,'Preserve the identity, face, expression, pose, proportions, hair, clothing, accessories, lighting, tonal treatment, and original medium as closely as possible. Do not add people, objects, text, logos, or unrelated story elements.'];
  if(selectedOperations.has('zoom-out')){const level=selected('zoom');const pct={subtle:'90%',moderate:'75–80%',strong:'60%'}[level]||'75–80%';parts.push(`For zoom out, use natural outpainting to make the main subject about ${pct} of its current apparent scale. Continue the surrounding scene naturally. Never add blank borders.`);}
  if(selectedOperations.has('zoom-in')){const level=selected('zoom');parts.push(`For zoom in, crop and reframe around the existing main subject with a ${level||'moderate'} crop. Keep important features inside the frame.`);}
  if(selectedOperations.has('resize')||selectedOperations.has('portrait-landscape')||selectedOperations.has('landscape-portrait')){const ratio=selected('ratio')||'balanced';parts.push(`Reframe or extend the scene to aspect ratio ${ratio==='balanced'?'a balanced composition close to the original image':ratio}. Preserve aspect ratio of subjects; when cropping would remove important content, extend the scene naturally instead.`);}
  if(referenceFile)parts.push('A second uploaded image is a visual reference only. Use it to guide the requested framing mood and visual treatment while keeping the original subject from the first image.');
  parts.push('Match background texture, perspective, lighting, shadows, depth of field, and style. Return only the finished image.');return parts.join('\n\n');
}
$('edit-button').addEventListener('click',async()=>{
  if(!mainFile||!selectedOperations.size||(referenceChoice==='yes'&&!referenceFile))return;
  hideMessage();const button=$('edit-button');button.classList.add('loading');button.disabled=true;button.querySelector('span').textContent='กำลังจัดเฟรมภาพ';button.classList.add('loading-pulse');
  try{
    const form=new FormData();form.append('image',mainFile);if(referenceFile)form.append('reference',referenceFile);form.append('prompt',buildPrompt());form.append('ratio',selected('ratio')||'balanced');
    const headers={};if(accessRequired)headers['x-app-password']=accessPassword;
    const response=await fetch(apiUrl('/api/edit'),{method:'POST',headers,body:form});const data=await response.json();
    if(!response.ok)throw new Error(data.error||'ไม่สามารถประมวลผลภาพได้');
    resultUrl=`data:${data.mimeType||'image/png'};base64,${data.image}`;$('result-image').src=resultUrl;
    $('result-caption').textContent=[...selectedOperations].map(key=>operationLabels[key]).join(' · ');
    $('result-section').classList.remove('hidden');$('result-section').scrollIntoView({behavior:'smooth',block:'center'});message('เสร็จแล้ว ดาวน์โหลดภาพได้จากปุ่มด้านบน','success');
  }catch(error){message(error.message.includes('fetch')?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่าเปิดเว็บด้วย npm run dev':error.message);}
  finally{button.classList.remove('loading','loading-pulse');button.querySelector('span').textContent='สร้างภาพใหม่';updateAction();}
});
$('download-result').addEventListener('click',()=>{if(!resultUrl)return;const link=document.createElement('a');link.href=resultUrl;link.download='frame-result.png';link.click();});
