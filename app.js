const operationLabels={"zoom-out":"Zoom out","zoom-in":"Zoom in",resize:"Resize","portrait-landscape":"Portrait → Landscape","landscape-portrait":"Landscape → Portrait"};
const operationButtons=[...document.querySelectorAll('.operation')];
const selectedOperations=new Set();
let mainFile=null,resultUrl='';
const $=id=>document.getElementById(id);
const message=(text,type='error')=>{const node=$('message');node.textContent=text;node.classList.remove('hidden','success');if(type==='success')node.classList.add('success');};
const hideMessage=()=>$('message').classList.add('hidden');
function selected(group){return document.querySelector(`[data-group="${group}"] .selected`)?.dataset.value;}

function updateDetails(){
  const hasZoom=selectedOperations.has('zoom-in')||selectedOperations.has('zoom-out');
  const hasRatio=['resize','portrait-landscape','landscape-portrait'].some(key=>selectedOperations.has(key));
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
  $('step-one-state').textContent=selectedOperations.size?`${selectedOperations.size} รายการ`:'ยังไม่ได้เลือก';
  updateAction();
}

function updateAction(){
  $('edit-button').disabled=!(selectedOperations.size&&mainFile)||$('edit-button').classList.contains('loading');
}

operationButtons.forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.operation;
  if(selectedOperations.has(key)){selectedOperations.delete(key);button.setAttribute('aria-pressed','false');}
  else{selectedOperations.add(key);button.setAttribute('aria-pressed','true');}
  updateDetails();hideMessage();
}));

document.querySelectorAll('[data-group]').forEach(group=>group.addEventListener('click',event=>{
  const button=event.target.closest('button[data-value]');
  if(!button)return;
  group.querySelectorAll('[data-value]').forEach(item=>item.classList.toggle('selected',item===button));
}));

function attachMainInput(){
  const input=$('main-image'),zone=$('main-dropzone');
  input.addEventListener('change',()=>{if(input.files?.[0])setFile(input.files[0]);});
  ['dragenter','dragover'].forEach(name=>zone.addEventListener(name,event=>{event.preventDefault();zone.classList.add('dragging');}));
  ['dragleave','drop'].forEach(name=>zone.addEventListener(name,event=>{
    event.preventDefault();zone.classList.remove('dragging');
    if(name==='drop'&&event.dataTransfer.files?.[0])setFile(event.dataTransfer.files[0]);
  }));
}

function setFile(file){
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){message('รองรับเฉพาะไฟล์ PNG, JPG และ WebP');return;}
  if(file.size>20*1024*1024){message('ไฟล์มีขนาดเกิน 20 MB กรุณาเลือกภาพที่เล็กลง');return;}
  mainFile=file;
  $('main-preview').src=URL.createObjectURL(file);
  $('main-preview-wrap').classList.remove('hidden');
  $('upload-hint').textContent=`ภาพพร้อมจัดเฟรม · ${file.name}`;
  updateAction();hideMessage();
}

attachMainInput();
$('remove-main').addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();mainFile=null;$('main-image').value='';
  $('main-preview').removeAttribute('src');$('main-preview-wrap').classList.add('hidden');
  $('upload-hint').textContent='เลือกงานด้านบนก่อน แล้วอัปโหลดภาพหลักเพื่อเริ่มต้น';updateAction();
});

function targetAspect(width,height){
  const wantsRatio=['resize','portrait-landscape','landscape-portrait'].some(key=>selectedOperations.has(key));
  if(!wantsRatio)return width/height;
  const value=selected('ratio')||'balanced';
  if(value!=='balanced'){
    const [w,h]=value.split(':').map(Number);
    if(w&&h)return w/h;
  }
  if(selectedOperations.has('portrait-landscape')&&!selectedOperations.has('landscape-portrait'))return 16/9;
  if(selectedOperations.has('landscape-portrait')&&!selectedOperations.has('portrait-landscape'))return 9/16;
  return width/height;
}

function zoomFactor(){
  const strength=selected('zoom')||'moderate';
  const out={subtle:.9,moderate:.78,strong:.62}[strength]||.78;
  const inside={subtle:1.1,moderate:1.25,strong:1.5}[strength]||1.25;
  let factor=1;
  if(selectedOperations.has('zoom-out'))factor*=out;
  if(selectedOperations.has('zoom-in'))factor*=inside;
  return Math.max(.4,Math.min(2.2,factor));
}

async function renderLocally(file){
  const image=await createImageBitmap(file);
  const sourceWidth=image.width,sourceHeight=image.height;
  const aspect=targetAspect(sourceWidth,sourceHeight);
  const sourceAspect=sourceWidth/sourceHeight;
  const logicalWidth=aspect>=sourceAspect?sourceHeight*aspect:sourceWidth;
  const logicalHeight=aspect>=sourceAspect?sourceHeight:sourceWidth/aspect;
  const outputScale=Math.min(1,4096/Math.max(logicalWidth,logicalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(logicalWidth*outputScale));
  canvas.height=Math.max(1,Math.round(logicalHeight*outputScale));
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('เบราว์เซอร์นี้ไม่รองรับการประมวลผลภาพในเครื่อง');
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';

  // A softened copy of the source fills the new canvas; the sharp original remains centered above it.
  context.fillStyle='#e8e9e2';context.fillRect(0,0,canvas.width,canvas.height);
  context.save();
  context.filter=`blur(${Math.max(14,Math.round(Math.min(canvas.width,canvas.height)*.025))}px) saturate(.92)`;
  context.drawImage(image,0,0,canvas.width,canvas.height);
  context.restore();
  context.fillStyle='rgba(30,35,28,.035)';context.fillRect(0,0,canvas.width,canvas.height);

  const scale=outputScale*zoomFactor();
  const contentWidth=sourceWidth*scale,contentHeight=sourceHeight*scale;
  const x=(canvas.width-contentWidth)/2,y=(canvas.height-contentHeight)/2;
  context.drawImage(image,x,y,contentWidth,contentHeight);
  image.close();

  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('บันทึกภาพไม่สำเร็จ กรุณาลองใหม่')),'image/png'));
  return {blob,width:canvas.width,height:canvas.height};
}

$('edit-button').addEventListener('click',async()=>{
  if(!mainFile||!selectedOperations.size)return;
  hideMessage();const button=$('edit-button');button.classList.add('loading','loading-pulse');button.disabled=true;button.querySelector('span').textContent='กำลังจัดเฟรมภาพ';
  try{
    const result=await renderLocally(mainFile);
    if(resultUrl)URL.revokeObjectURL(resultUrl);
    resultUrl=URL.createObjectURL(result.blob);$('result-image').src=resultUrl;
    $('result-caption').textContent=`${[...selectedOperations].map(key=>operationLabels[key]).join(' · ')} · ${result.width} × ${result.height} px · ประมวลผลในเครื่อง`;
    $('result-section').classList.remove('hidden');$('result-section').scrollIntoView({behavior:'smooth',block:'center'});
    message('จัดเฟรมเสร็จแล้ว ดาวน์โหลดภาพได้จากปุ่มด้านบน','success');
  }catch(error){message(error.message||'จัดเฟรมภาพไม่สำเร็จ กรุณาลองใหม่');}
  finally{button.classList.remove('loading','loading-pulse');button.querySelector('span').textContent='จัดเฟรมภาพ';updateAction();}
});

$('download-result').addEventListener('click',()=>{
  if(!resultUrl)return;
  const link=document.createElement('a');link.href=resultUrl;link.download='frame-result.png';link.click();
});

window.addEventListener('pagehide',()=>{if(resultUrl)URL.revokeObjectURL(resultUrl);});
