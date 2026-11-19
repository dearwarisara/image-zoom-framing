import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const app = Fastify({ logger: { redact: { paths: ['req.headers.x-openai-api-key'], censor: '[Redacted]' } }, bodyLimit: 45 * 1024 * 1024 });
await app.register(multipart, { limits: { files: 2, fileSize: 20 * 1024 * 1024, fields: 8 } });
const allowed = new Map([['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],['.js','text/javascript; charset=utf-8']]);

app.get('/api/health', async () => ({ serviceReady: true, userApiKeyRequired: true }));
app.post('/api/edit', async (request, reply) => {
  const userApiKey = String(request.headers['x-openai-api-key'] || '').trim();
  if (!userApiKey) return reply.code(401).send({ error: 'กรุณาใส่ OpenAI API key ของคุณก่อนสร้างภาพ' });
  const fields = {};
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const bytes = await part.toBuffer();
      if (!['image/png','image/jpeg','image/webp'].includes(part.mimetype)) return reply.code(400).send({ error: 'รองรับเฉพาะ PNG, JPG และ WebP' });
      fields[part.fieldname] = new File([bytes], part.filename || 'image', { type: part.mimetype });
    } else fields[part.fieldname] = part.value;
  }
  if (!fields.image || typeof fields.prompt !== 'string' || !fields.prompt.trim()) return reply.code(400).send({ error: 'กรุณาเลือกรูปและตัวเลือกการจัดเฟรมก่อน' });
  const images = [fields.image, ...(fields.reference ? [fields.reference] : [])];
  const sizeByRatio = { '1:1': '1024x1024', '4:5': '1024x1280', '3:2': '1536x1024', '16:9': '1536x864', '9:16': '1008x1792' };
  try {
    const client = new OpenAI({ apiKey: userApiKey });
    const result = await client.images.edit({ model: 'gpt-image-2.5-sunburst', image: images, prompt: fields.prompt.trim(), size: sizeByRatio[fields.ratio] || 'auto', quality: 'high', output_format: 'png', n: 1 });
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) throw new Error('The image API returned no image data.');
    return { image: encoded, mimeType: 'image/png' };
  } catch (error) {
    request.log.error({ status: error.status || null }, 'Image edit failed');
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    const detail = error.status === 401 ? 'API key ไม่ถูกต้อง' : error.status === 429 ? 'ใช้งาน API ถึงขีดจำกัดชั่วคราว ลองใหม่ภายหลัง' : 'ประมวลผลภาพไม่สำเร็จ ตรวจสอบสิทธิ์ API และลองใหม่';
    return reply.code(status).send({ error: detail });
  }
});

app.get('/*', async (request, reply) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const filename = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\]+/, '');
  if (filename.includes('..')) return reply.code(404).send('Not found');
  const mime = allowed.get(extname(filename));
  if (!mime) return reply.code(404).send('Not found');
  try { return reply.type(mime).send(await readFile(join(root, filename))); }
  catch { return reply.code(404).send('Not found'); }
});

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: '0.0.0.0' });
