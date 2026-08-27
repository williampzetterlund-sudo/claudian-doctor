'use strict';
const { Plugin, Modal, Notice, Platform } = require('obsidian');

class DoctorModal extends Modal {
  constructor(app, text) { super(app); this.text = text; }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Claudian Doctor — diagnos' });
    const ta = contentEl.createEl('textarea');
    ta.value = this.text;
    ta.style.width = '100%';
    ta.style.height = '320px';
    ta.style.fontSize = '11px';
    const btn = contentEl.createEl('button', { text: 'Kopiera till urklipp' });
    btn.style.marginTop = '8px';
    btn.onclick = async () => {
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
    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => { this.run().catch((e) => new Notice('doctor: ' + e.message)); }, 1500);
    });
  }

  async run() {
    const out = [];
    const log = (s) => out.push(s);
    log('=== Claudian Doctor ' + new Date().toISOString());
    try { log('UA: ' + navigator.userAgent); } catch (e) { log('UA-fel'); }
    try {
      log('platform: mobileApp=' + Platform.isMobileApp + ' ios=' + Platform.isIosApp
        + ' phone=' + Platform.isPhone + ' tablet=' + Platform.isTablet);
    } catch (e) { log('platform-fel: ' + e.message); }

    const ad = this.app.vault.adapter;
    const cfg = this.app.vault.configDir;
    const dir = cfg + '/plugins';

    try {
      const listing = await ad.list(dir);
      log('plugin-mappar: ' + JSON.stringify(listing.folders));
    } catch (e) { log('list(' + dir + ') FEL: ' + e.message); }

    for (const f of ['manifest.json', 'main.js', 'styles.css', 'data.json']) {
      const p = dir + '/realclaudian/' + f;
      try {
        const st = await ad.stat(p);
        log(p + ': ' + (st ? (st.type + ' ' + st.size + ' B') : 'SAKNAS (stat=null)'));
      } catch (e) { log(p + ': stat-FEL ' + e.message); }
    }

    try {
      const mf = await ad.read(dir + '/realclaudian/manifest.json');
      log('manifest-innehall: ' + mf.replace(/\s+/g, ' ').slice(0, 240));
    } catch (e) { log('manifest las-FEL: ' + e.message); }

    try {
      const mj = await ad.read(dir + '/realclaudian/main.js');
      log('main.js lastlangd: ' + mj.length + ' tecken; slutar med: ' + JSON.stringify(mj.slice(-50)));
    } catch (e) { log('main.js las-FEL: ' + e.message); }

    try {
      const cp = await ad.read(cfg + '/community-plugins.json');
      log('community-plugins.json: ' + cp.replace(/\s+/g, ' ').slice(0, 300));
    } catch (e) { log('community-plugins.json FEL: ' + e.message); }

    try { log('manifests kanner till realclaudian: ' + !!this.app.plugins.manifests['realclaudian']); }
    catch (e) { log('manifests-FEL: ' + e.message); }

    const errors = [];
    const origErr = console.error;
    console.error = function () {
      try {
        const parts = [];
        for (let i = 0; i < arguments.length; i += 1) {
          const a = arguments[i];
          parts.push(a && a.stack ? String(a.stack) : String(a));
        }
        errors.push(parts.join(' '));
      } catch (e) { /* aldrig krascha loggning */ }
      return origErr.apply(console, arguments);
    };
    try {
      log('--- forsoker registrera + aktivera realclaudian ---');
      if (this.app.plugins.loadManifests) await this.app.plugins.loadManifests();
      const known = !!this.app.plugins.manifests['realclaudian'];
      log('efter loadManifests: kand=' + known);
      if (known) {
        const t0 = Date.now();
        await this.app.plugins.enablePlugin('realclaudian');
        log('enablePlugin klar pa ' + (Date.now() - t0) + ' ms; aktiv=' + !!this.app.plugins.plugins['realclaudian']);
      }
    } catch (e) {
      log('aktivering KASTADE: ' + (e && e.stack ? e.stack : String(e)).slice(0, 1200));
    }
    console.error = origErr;
    if (errors.length) {
      log('--- console.error under forsoket ---');
      log(errors.slice(0, 6).join('\n---\n').slice(0, 3000));
    } else {
      log('(inga console.error fangades)');
    }

    const text = out.join('\n');
    try { await ad.write('CLAUDIAN-DOCTOR.md', '```\n' + text + '\n```\n'); log('not skriven'); } catch (e) { /* synk kvittar, modalen visar allt */ }
    new DoctorModal(this.app, text).open();
  }
};
