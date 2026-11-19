const PAGE = "__FRAME_HTML_JSON__";

const sizeByRatio = {
  '1:1': '1024x1024',
  '4:5': '1024x1280',
  '3:2': '1536x1024',
  '16:9': '1536x864',
  '9:16': '1008x1792'
};

const allowedOrigin = 'https://dearwarisara.github.io';

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = { vary: 'Origin' };
  if (origin === allowedOrigin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type, X-App-Password';
    headers['access-control-max-age'] = '600';
  }
  return headers;
}

function json(value, status = 200, request) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(request) }
  });
}

async function editImage(request, env) {
  if (!env.OPENAI_API_KEY) return json({ error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OPENAI_API_KEY กรุณาติดต่อผู้ดูแลเว็บไซต์' }, 503, request);
  const suppliedPassword = request.headers.get('x-app-password') || '';
  const authenticatedUser = request.headers.get('oai-authenticated-user-id');
  if (env.APP_ACCESS_PASSWORD && suppliedPassword !== env.APP_ACCESS_PASSWORD) {
    return json({ error: 'รหัสเข้าใช้งานไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' }, 401, request);
  }
  if (!env.APP_ACCESS_PASSWORD && !authenticatedUser) {
    return json({ error: 'ต้องลงชื่อเข้าใช้ก่อนเรียกใช้งาน' }, 401, request);
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 45 * 1024 * 1024) return json({ error: 'ไฟล์มีขนาดใหญ่เกินกำหนด' }, 413, request);

  let incoming;
  try { incoming = await request.formData(); }
  catch { return json({ error: 'อ่านข้อมูลภาพไม่สำเร็จ กรุณาลองใหม่' }, 400, request); }
  const image = incoming.get('image');
  const reference = incoming.get('reference');
  const prompt = incoming.get('prompt');
  if (!(image instanceof File) || typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'กรุณาเลือกรูปและตัวเลือกการจัดเฟรมก่อน' }, 400, request);
  const files = [image, ...(reference instanceof File ? [reference] : [])];
  if (files.some(file => file.size > 20 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
    return json({ error: 'รองรับเฉพาะ PNG, JPG และ WebP ขนาดไม่เกิน 20 MB ต่อภาพ' }, 400, request);
  }

  const upstream = new FormData();
  upstream.append('model', 'gpt-image-2.5-sunburst');
  upstream.append('prompt', prompt.trim());
  upstream.append('size', sizeByRatio[incoming.get('ratio')] || 'auto');
  upstream.append('quality', 'high');
  upstream.append('output_format', 'png');
  upstream.append('n', '1');
  for (const file of files) upstream.append('image[]', file, file.name || 'image.png');

  try {
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: upstream
    });
    const data = await response.json();
    if (!response.ok) {
      const status = response.status === 401 ? 401 : response.status === 429 ? 429 : 502;
      const detail = response.status === 401 ? 'API key ไม่ถูกต้อง' : response.status === 429 ? 'ใช้งาน API ถึงขีดจำกัดชั่วคราว ลองใหม่ภายหลัง' : 'ประมวลผลภาพไม่สำเร็จ ตรวจสอบสิทธิ์ API และลองใหม่';
      return json({ error: detail }, status, request);
    }
    const encoded = data.data?.[0]?.b64_json;
    if (!encoded) return json({ error: 'API ไม่ส่งภาพผลลัพธ์กลับมา กรุณาลองใหม่' }, 502, request);
    return json({ image: encoded, mimeType: 'image/png' }, 200, request);
  } catch {
    return json({ error: 'เชื่อมต่อบริการประมวลผลภาพไม่ได้ กรุณาลองใหม่ภายหลัง' }, 502, request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && (url.pathname === '/api/health' || url.pathname === '/api/edit')) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ configured: Boolean(env.OPENAI_API_KEY), requiresAccess: Boolean(env.APP_ACCESS_PASSWORD) }, 200, request);
    }
    if (url.pathname === '/api/edit' && request.method === 'POST') return editImage(request, env);
    if (url.pathname === '/' && request.method === 'GET') return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    return new Response('Not found', { status: 404 });
  }
};
