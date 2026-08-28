'use strict';
const { Plugin, Modal, Notice, Platform } = require('obsidian');

const URL_KEY = 'claudian_bridge_url';
const TOKEN_KEY = 'claudian_bridge_token';

class DoctorModal extends Modal {
  constructor(app, text) { super(app); this.text = text; }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Claudian Doctor 1.1.0' });

    // --- Brygg-konfiguration (skriver samma localStorage-nycklar som Claudian laser) ---
    contentEl.createEl('h5', { text: 'Bridge-koppling' });
    const urlInput = contentEl.createEl('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'wss://...';
    urlInput.value = window.localStorage.getItem(URL_KEY) || '';
    urlInput.style.width = '100%';
    const tokenInput = contentEl.createEl('input');
    tokenInput.type = 'password';
    tokenInput.placeholder = 'token';
    tokenInput.value = window.localStorage.getItem(TOKEN_KEY) || '';
    tokenInput.style.width = '100%';
    tokenInput.style.marginTop = '6px';

    const row = contentEl.createEl('div');
    row.style.marginTop = '8px';
    const saveBtn = row.createEl('button', { text: 'Spara' });
    const testBtn = row.createEl('button', { text: 'Testa' });
    testBtn.style.marginLeft = '8px';
    const openBtn = row.createEl('button', { text: 'Oppna Claudian-chatten' });
    openBtn.style.marginLeft = '8px';

    saveBtn.onclick = () => {
      const u = urlInput.value.trim();
      const t = tokenInput.value.trim();
      if (u) window.localStorage.setItem(URL_KEY, u); else window.localStorage.removeItem(URL_KEY);
      if (t) window.localStorage.setItem(TOKEN_KEY, t); else window.localStorage.removeItem(TOKEN_KEY);
      new Notice('Sparat pa denna enhet');
    };
    testBtn.onclick = async () => {
      try {
        const base = (urlInput.value.trim()).replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
        const token = tokenInput.value.trim();
        const sep = base.indexOf('?') >= 0 ? '&' : '?';
        const res = await fetch(base + '/config' + (token ? (sep + 'token=' + encodeURIComponent(token)) : ''));
        if (!res.ok) { new Notice('Bryggan svarade HTTP ' + res.status); return; }
        const cfg = await res.json();
        new Notice('Bridge OK - vault root: ' + (cfg.vaultRoot || '?'), 8000);
      } catch (e) { new Notice('Test misslyckades: ' + e.message, 8000); }
    };
    openBtn.onclick = () => {
      const ok = this.app.commands.executeCommandById('realclaudian:open-view');
      if (!ok) new Notice('Kommandot realclaudian:open-view finns inte / gick inte att kora');
      else this.close();
    };

    // --- Diagnos ---
    contentEl.createEl('h5', { text: 'Diagnos' });
    const ta = contentEl.createEl('textarea');
    ta.value = this.text;
    ta.style.width = '100%';
    ta.style.height = '220px';
    ta.style.fontSize = '11px';
    const copyBtn = contentEl.createEl('button', { text: 'Kopiera diagnosen' });
    copyBtn.style.marginTop = '8px';
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(this.text); new Notice('Kopierat'); }
      catch (e) { new Notice('Kopiering misslyckades: ' + e.message); }
    };
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = class ClaudianDoctor extends Plugin {
  async onload() {
    this.addCommand({
      id: 'run-diagnostics',
      name: 'Run diagnostics',
      callback: () => { this.run().catch((e) => new Notice('doctor: ' + e.message)); },
    });
    this.addCommand({
      id: 'dump-bottom-ui',
      name: 'Dump bottom UI elements (6 s sjalvutlosare)',
      callback: () => {
        new Notice('Oppna panelen nu — dump om 6 sekunder...', 5500);
        window.setTimeout(() => {
          this.dumpBottomUi().catch((e) => new Notice('doctor: ' + e.message));
        }, 6000);
      },
    });
    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => { this.run().catch((e) => new Notice('doctor: ' + e.message)); }, 1500);
    });
  }

  async dumpBottomUi() {
    const out = [];
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    out.push('=== Bottom UI dump ' + new Date().toISOString() + ' viewport=' + vw + 'x' + vh);
    const seen = new Set();
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
      let r;
      try { r = el.getBoundingClientRect(); } catch (e) { continue; }
      // synliga element vars topp ligger i nedre tredjedelen
      if (r.height < 8 || r.width < 8 || r.top < vh * 0.62 || r.top > vh) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // hoppa över rena textcontainrar djupt inne i redan listade träd
      let ancestorListed = false;
      let p = el.parentElement;
      let depth = 0;
      while (p && depth < 3) { if (seen.has(p)) { ancestorListed = true; break; } p = p.parentElement; depth++; }
      if (ancestorListed) continue;
      seen.add(el);
      const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 6).join('.');
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      out.push('<' + el.tagName.toLowerCase() + (cls ? ' .' + cls : '') + '> pos=' + Math.round(r.top) + ',' + Math.round(r.left) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (text ? ' text="' + text + '"' : ''));
      if (out.length > 60) { out.push('...trunkerad'); break; }
    }
    // Förfäderskedja för vyväxlar-pillen: vem äger dödytan?
    const pill = document.querySelector('.workspace-drawer-tab-options');
    if (pill) {
      out.push('--- pillens forfader (rect + padding/margin) ---');
      let node = pill;
      for (let i = 0; i < 7 && node && node !== document.body; i++) {
        const r = node.getBoundingClientRect();
        const cs = window.getComputedStyle(node);
        const cls = (typeof node.className === 'string' ? node.className : '').split(/\s+/).filter(Boolean).slice(0, 5).join('.');
        out.push('<' + node.tagName.toLowerCase() + (cls ? ' .' + cls : '') + '> top=' + Math.round(r.top) + ' h=' + Math.round(r.height)
          + ' pad=' + cs.paddingTop + '/' + cs.paddingBottom + ' marg=' + cs.marginTop + '/' + cs.marginBottom + ' pos=' + cs.position);
        node = node.parentElement;
      }
    }
    const text = out.join('\n');
    try { await this.app.vault.adapter.write('CLAUDIAN-DOCTOR.md', '```\n' + text + '\n```\n'); } catch (e) { /* modal racker */ }
    new DoctorModal(this.app, text).open();
  }

  async run() {
    const out = [];
    const log = (s) => out.push(s);
    log('=== Claudian Doctor 1.1.0 ' + new Date().toISOString());
    try { log('UA: ' + navigator.userAgent); } catch (e) { log('UA-fel'); }
    try { log('platform: mobileApp=' + Platform.isMobileApp + ' ios=' + Platform.isIosApp + ' phone=' + Platform.isPhone); } catch (e) { log('platform-fel'); }

    try {
      const inst = this.app.plugins.plugins['realclaudian'];
      log('realclaudian aktiv: ' + !!inst + (inst ? (' version=' + inst.manifest.version) : ''));
    } catch (e) { log('instans-FEL: ' + e.message); }

    try {
      const ids = Object.keys(this.app.commands.commands).filter((c) => c.indexOf('claudian') >= 0);
      log('claudian-kommandon (' + ids.length + '):');
      for (const cid of ids) log('  ' + cid + '  ->  ' + (this.app.commands.commands[cid].name || ''));
    } catch (e) { log('kommandolistnings-FEL: ' + e.message); }

    try {
      log('localStorage: url=' + (window.localStorage.getItem(URL_KEY) ? 'SATT' : 'saknas')
        + ' token=' + (window.localStorage.getItem(TOKEN_KEY) ? 'SATT' : 'saknas'));
    } catch (e) { log('localStorage-FEL: ' + e.message); }

    const text = out.join('\n');
    try { await this.app.vault.adapter.write('CLAUDIAN-DOCTOR.md', '```\n' + text + '\n```\n'); } catch (e) { /* modalen visar allt */ }
    new DoctorModal(this.app, text).open();
  }
};
