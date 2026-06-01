/**
 * TokenGuard — Bundle Generator
 *
 * POST /projects/:id/bundle        → gera e persiste o bundle
 * GET  /projects/:id/bundle        → retorna metadata do bundle atual
 * GET  /projects/:id/bundle/download → serve o .js para download
 * DELETE /projects/:id/bundle      → revoga / regenera
 */

import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';

// ── Template do loader com placeholders ───────────────────────────
// Este é o source que vai ser personalizado e entregue ao cliente.
// NÃO contém secrets — só configuração pública do projeto.
function buildBundleSource({ projectId, apiUrl, blockTitle, blockBg, version }) {
  // Mini-ofuscação: nomes de variáveis internos encurtados
  return `/* TokenGuard v${version} | proj:${projectId} | ${new Date().toISOString().slice(0,10)} */
!function(){"use strict";
var P="${projectId}",A="${apiUrl}",V="${version}",T=${JSON.stringify(blockTitle||'Access Protected')},B=${JSON.stringify(blockBg||'#080c14')},K="_tg_"+P;
function S(){var s=sessionStorage.getItem(K);if(!s){s="clt_"+crypto.randomUUID().replace(/-/g,"").slice(0,20);sessionStorage.setItem(K,s);}return s;}
function E(r){var root=document.getElementById("tg-root")||document.body;root.innerHTML='<div id="_tgb" style="position:fixed;inset:0;z-index:2147483647;background:'+B+';display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;gap:12px"><div style="font-size:48px">\\uD83D\\uDD12</div><div style="font-size:16px;font-weight:700;color:#e8f0ff">'+T+'</div><div style="font-size:11px;color:#4a6080;background:rgba(255,255,255,.04);padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.08)">tokenguard: '+r+'</div></div>';}
async function H(p,b,h){var r=await fetch(A+p,{method:"POST",headers:Object.assign({"Content-Type":"application/json","X-TG-Version":V},h||{}),body:JSON.stringify(b)});if(!r.ok){var e=await r.json().catch(function(){return{};});throw Object.assign(new Error(e.message||"err"),{code:e.error});}return r.json();}
var _t=null,_hb=null;
function startHB(iv,sid){_hb=setInterval(async function(){if(!_t)return;try{var r=await H("/session-heartbeat",{token:_t},{"X-TG-Session":sid});if(r.alive&&r.token){_t=r.token;}else{clearInterval(_hb);E(r.reason||"session_lost");}}catch(e){}},iv*1e3);}
async function init(){var sid=S();try{
var g=await H("/generate-token",{projectId:P,origin:location.origin,host:location.hostname,href:location.href,userAgent:navigator.userAgent});
_t=g.token;
var a=await H("/validate-token",{token:g.token,origin:location.origin},{"X-TG-Session":sid});
if(!a.authorized){E(a.reason||"unauthorized");return;}
if(a.bundleUrl&&a.key){var res=await fetch(a.bundleUrl),buf=await res.arrayBuffer(),rk=Uint8Array.from(atob(a.key),function(c){return c.charCodeAt(0);}),ck=await crypto.subtle.importKey("raw",rk,"AES-GCM",false,["decrypt"]),iv2=new Uint8Array(buf,0,12),enc=new Uint8Array(buf,12),pl=await crypto.subtle.decrypt({name:"AES-GCM",iv:iv2},ck,enc),src=new TextDecoder().decode(pl),s=document.createElement("script");s.type="module";s.textContent=src;(document.getElementById("tg-root")||document.body).appendChild(s);}
startHB(a.heartbeatInterval||30,sid);
}catch(err){E(err.code||"init_error");}}
init();
}();`;
}

// ── Checksum simples para detectar se o bundle mudou ──────────────
function simpleHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const SDK_VERSION = '2.2.0';

export default async function bundleRoutes(app) {

  // ── POST /projects/:id/bundle ─────────────────────────────────
  // Gera (ou regenera) o bundle personalizado do projeto.
  // Retorna o JS pronto e persiste metadata no DB.
  app.post('/:id/bundle', { preHandler: requireAuth }, async (req, reply) => {
    const { apiUrl, blockTitle, blockBg } = req.body ?? {};

    // Verify ownership
    const { rows } = await query(
      'SELECT id, name, domains, rules, status FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_found', message: 'Projeto não encontrado' });

    const proj   = rows[0];
    const api    = (apiUrl || 'https://api.tokenguard.io').replace(/\/$/, '');
    const title  = blockTitle || 'Access Protected';
    const bg     = blockBg   || '#080c14';

    const source  = buildBundleSource({
      projectId:  proj.id,
      apiUrl:     api,
      blockTitle: title,
      blockBg:    bg,
      version:    SDK_VERSION,
    });

    const checksum = simpleHash(source);
    const filename = `tokenguard.${proj.id}.min.js`;
    const sizeBytes = Buffer.byteLength(source, 'utf8');

    // Persist bundle metadata (source stored in DB for serving)
    await query(
      `INSERT INTO project_bundles (project_id, source, filename, checksum, api_url, size_bytes, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id) DO UPDATE SET
         source=$2, filename=$3, checksum=$4, api_url=$5, size_bytes=$6,
         version=$7, generated_at=NOW()`,
      [proj.id, source, filename, checksum, api, sizeBytes, SDK_VERSION]
    );

    return reply.code(201).send({
      filename,
      checksum,
      sizeBytes,
      version:  SDK_VERSION,
      source,   // retorna o JS direto para preview no dashboard
      usage: `<script src="tokenguard.${proj.id}.min.js"></script>`,
    });
  });

  // ── GET /projects/:id/bundle ──────────────────────────────────
  // Metadata do bundle atual (sem o source completo).
  app.get('/:id/bundle', { preHandler: requireAuth }, async (req, reply) => {
    const { rows: proj } = await query(
      'SELECT id FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'not_found' });

    const { rows } = await query(
      'SELECT filename, checksum, size_bytes, version, api_url, generated_at FROM project_bundles WHERE project_id=$1',
      [req.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_generated', message: 'Nenhum bundle gerado ainda' });

    return rows[0];
  });

  // ── GET /projects/:id/bundle/download ────────────────────────
  // Serve o .js como download direto.
  app.get('/:id/bundle/download', { preHandler: requireAuth }, async (req, reply) => {
    const { rows: proj } = await query(
      'SELECT id FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'not_found' });

    const { rows } = await query(
      'SELECT source, filename, checksum FROM project_bundles WHERE project_id=$1',
      [req.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_generated', message: 'Gere o bundle primeiro' });

    const { source, filename, checksum } = rows[0];

    reply
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('X-TG-Checksum', checksum)
      .header('Cache-Control', 'no-store')
      .send(source);
  });

  // ── DELETE /projects/:id/bundle ───────────────────────────────
  // Revoga o bundle atual (força regeneração).
  app.delete('/:id/bundle', { preHandler: requireAuth }, async (req, reply) => {
    const { rows: proj } = await query(
      'SELECT id FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'not_found' });

    const { rowCount } = await query(
      'DELETE FROM project_bundles WHERE project_id=$1',
      [req.params.id]
    );
    return { revoked: rowCount > 0 };
  });
}
