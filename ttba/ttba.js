/* Tóm tắt bệnh án (TTBA) — ghi bằng giọng nói trên iPhone, Claude sắp xếp vào mẫu.
   - Giọng nói → chữ: Web Speech API của Safari (vi-VN); không có thì gõ / dùng mic bàn phím iOS.
   - Chữ → mẫu: Claude (Anthropic SDK, gọi thẳng từ trình duyệt bằng khóa lưu trên máy), đầu ra JSON theo schema.
   - Dữ liệu: localStorage của máy (bản làm việc, dùng được khi mất mạng); đã đăng nhập Trieu's Note thì đồng bộ
     Supabase bảng ttba_cases (RLS theo người dùng). Khóa API và cài đặt chỉ ở từng máy. */
(() => {
'use strict';

const KEY = 'trieusnote_ttba_v1', CFG = 'trieusnote_ttba_cfg';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm';
const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — most accurate (default)', 4, 20],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — faster, cheaper', 2, 10],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — cheapest', 0.1, 0.5],
];
const USD_VND = 26000; // chỉ để ước tính chi phí hiển thị

// Mẫu chung: [khóa, tên mục tiếng Việt (bản xuất), gợi ý TV, tên mục tiếng Anh (giao diện), gợi ý tiếng Anh]
const FIELDS = [
  ['nguoi_benh', 'Người bệnh (ẩn danh)', 'Giới, tuổi, khoa/phòng; không ghi họ tên, số hồ sơ', 'Patient (anonymised)', 'Sex, age, ward/room; no name or record number'],
  ['ngay_vao_vien', 'Ngày vào viện', '', 'Admission date', ''],
  ['ly_do', 'Lý do vào viện', '', 'Reason for admission', ''],
  ['benh_su', 'Bệnh sử', 'Quá trình bệnh lý và diễn biến lâm sàng', 'History of present illness', 'Course of illness and clinical progress'],
  ['tien_su', 'Tiền sử', 'Bản thân, gia đình, dị ứng, thuốc đang dùng', 'Past history', 'Personal, family, allergies, current medications'],
  ['kham', 'Khám lâm sàng', 'Những dấu hiệu lâm sàng chính', 'Physical examination', 'Key clinical findings'],
  ['mach_mau', 'Chỉ số mạch máu', 'ABI/TBI, siêu âm Doppler, CEAP; nút Phân độ tính Fontaine / Rutherford / WIfI', 'Vascular indices', 'ABI/TBI, Doppler ultrasound, CEAP; Staging button computes Fontaine / Rutherford / WIfI'],
  ['cls', 'Cận lâm sàng', 'Kết quả xét nghiệm, chẩn đoán hình ảnh có giá trị chẩn đoán', 'Investigations', 'Relevant lab and imaging results'],
  ['cd_vao', 'Chẩn đoán vào viện', 'Kèm mã ICD-10 (gợi ý, cần xác nhận)', 'Admission diagnosis', 'With ICD-10 code (suggested, confirm)'],
  ['cd_hien_tai', 'Chẩn đoán xác định / ra viện', 'Bệnh chính, bệnh kèm, mã ICD-10 (gợi ý, cần xác nhận)', 'Final / discharge diagnosis', 'Main and secondary diagnoses, ICD-10 (suggested, confirm)'],
  ['dieu_tri', 'Phương pháp điều trị', 'Thuốc, phẫu thuật / thủ thuật đã làm', 'Treatment', 'Medications, surgery / procedures performed'],
  ['tinh_trang', 'Tình trạng người bệnh', 'Hiện tại hoặc lúc ra viện', 'Patient status', 'Current or at discharge'],
  ['huong_tiep', 'Hướng điều trị và chế độ tiếp theo', '', 'Plan and follow-up', ''],
];
const FKEYS = FIELDS.map(f => f[0]);
// [khóa, tên tiếng Việt (gửi Claude), nhãn tiếng Anh (giao diện)]
const TOPICS = [['', 'Tự do', 'Free'], ['benh_su', 'Bệnh sử', 'History'], ['tien_su', 'Tiền sử', 'Past hx'], ['kham', 'Khám', 'Exam'], ['mach_mau', 'Mạch máu', 'Vascular'], ['cls', 'CLS', 'Labs/imaging'], ['cd', 'Chẩn đoán', 'Diagnosis'], ['dieu_tri', 'Điều trị', 'Treatment'], ['ra_vien', 'Ra viện', 'Discharge']];
const TOPIC_NAME = Object.fromEntries(TOPICS.map(([k, v]) => [k, v])), TOPIC_EN = Object.fromEntries(TOPICS.map(([k, , e]) => [k, e]));
const DEFAULT_GLOSSARY = `# One per line: as heard (Vietnamese) = standard spelling; lines starting with # are ignored
a bê i = ABI (chỉ số cổ chân - cánh tay)
tê bê i = TBI (chỉ số ngón chân - cánh tay)
đê vê tê = DVT (huyết khối tĩnh mạch sâu)
xê e a pê = CEAP
ru thơ pho = Rutherford`;

const SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(FKEYS.map(k => [k, { type: 'string' }])),
    can_kiem_tra: { type: 'array', items: { type: 'object', properties: { muc: { type: 'string', enum: FKEYS }, noi_dung: { type: 'string' }, ly_do: { type: 'string' } }, required: ['muc', 'noi_dung', 'ly_do'], additionalProperties: false } },
    chuan_hoa: { type: 'array', items: { type: 'object', properties: { goc: { type: 'string' }, chuan: { type: 'string' } }, required: ['goc', 'chuan'], additionalProperties: false } },
    benh_nen: { type: 'object', properties: { dai_thao_duong: { type: 'boolean' }, bmv_can_thiep: { type: 'boolean' }, creatinin_umol_l: { type: 'string' } }, required: ['dai_thao_duong', 'bmv_can_thiep', 'creatinin_umol_l'], additionalProperties: false },
  },
  required: [...FKEYS, 'can_kiem_tra', 'chuan_hoa', 'benh_nen'],
  additionalProperties: false,
};

const SYSTEM = `Bạn là trợ lý soạn "Tóm tắt bệnh án" cho bác sĩ phẫu thuật mạch máu tại Việt Nam.
Đầu vào là các đoạn bác sĩ đọc (chữ do nhận dạng giọng nói tiếng Việt tạo ra, có thể nghe sai thuật ngữ, viết tắt, số liệu), không theo thứ tự bệnh án; mỗi đoạn có thể kèm chủ đề bác sĩ đã chọn.
Nhiệm vụ: xếp thông tin vào đúng mục của mẫu, viết lại bằng văn phong bệnh án ngắn gọn, chuẩn thuật ngữ y khoa tiếng Việt.
Quy tắc:
- Chỉ dùng thông tin có trong đoạn đọc và bản hiện tại (nếu có). Không suy đoán, không thêm triệu chứng, kết quả, liều thuốc hay chẩn đoán không được nói tới. Mục không có thông tin để chuỗi rỗng "".
- Chuẩn hóa cách đọc thành cách viết chuẩn (vd "a bê i" → ABI, "huyết khối tĩnh mạch sâu" giữ tiếng Việt, đơn vị: mmHg, mg, mL, g/L, mmol/L…). Dùng từ điển cá nhân của bác sĩ nếu có. Ghi mỗi lần chuẩn hóa vào "chuan_hoa" (goc = cụm từ nghe được, chuan = cách viết).
- Số liệu, liều thuốc, bên phải/trái, ngày tháng: giữ đúng như đọc; chỗ nào nghe có vẻ sai, mâu thuẫn hoặc thiếu đơn vị thì vẫn ghi vào mục nhưng thêm một mục "can_kiem_tra" (muc = khóa của mục, noi_dung = đoạn cần xem, ly_do = vì sao).
- Chẩn đoán: ghi tên bệnh, kèm mã ICD-10 trong ngoặc nếu chắc chắn, dạng "(ICD-10: I70.2 – gợi ý)"; luôn thêm một mục can_kiem_tra nhắc bác sĩ xác nhận mã ICD-10.
- Ẩn danh: không ghi họ tên, số điện thoại, số căn cước, số hồ sơ, địa chỉ chi tiết; nếu đoạn đọc có thì thay bằng [ẩn]. Mục "nguoi_benh" chỉ gồm giới, tuổi, khoa/phòng nếu có (dùng "phòng", không dùng "giường").
- "mach_mau": gom chỉ số ABI/TBI hai bên, kết quả Doppler, phân độ (Rutherford, Fontaine, WIfI, CEAP) nếu được nói tới; không tự phân độ khi bác sĩ không nói.
- Nếu có "bản hiện tại": đó là bản bác sĩ đã duyệt/sửa — giữ nguyên nội dung đó, chỉ bổ sung hoặc sửa theo đoạn đọc mới.
- "benh_nen" (để app gắn thẻ): dai_thao_duong = true nếu có đái tháo đường; bmv_can_thiep = true nếu có bệnh mạch vành mạn đã can thiệp (đặt stent / PCI hoặc mổ bắc cầu CABG); creatinin_umol_l = giá trị creatinin máu gần nhất đổi ra µmol/L, chỉ ghi số (vd "160"), "" nếu không có.
- Viết từng mục thành câu/gạch đầu dòng ngắn, mỗi ý một dòng (dùng "- " đầu dòng khi liệt kê).`;

// ---------- lưu trữ ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Could not save: browser storage is full or blocked'); } Sync.soon(); };
const saveCfg = () => { try { localStorage.setItem(CFG, JSON.stringify(C)); } catch {} };
const S = load(KEY, { cases: [] });
const C = Object.assign({ key: '', model: MODELS[0][0], glossary: DEFAULT_GLOSSARY, keepDays: 30, gClientId: '', gCalendarId: 'primary', orDays: 2 }, load(CFG, {}));
// OAuth Client ID (loại Web application, origin https://theodore-ng.github.io) — không phải bí mật; máy nào chưa nhập thì dùng mặc định này
const DEFAULT_GCID = '170903685009-9c8ajtomrp6j4ac3tdb4vuc4qe48sfmt.apps.googleusercontent.com';
if (!C.gClientId) C.gClientId = DEFAULT_GCID;
S.gone ||= []; // mã ca đã xóa trên máy này nhưng chưa xóa được trên Supabase (mất mạng)
// tự xóa ca cũ
const expired = () => {
  if (!(C.keepDays > 0)) return;
  const lim = Date.now() - C.keepDays * 864e5;
  S.cases.filter(c => c.updated < lim).forEach(c => forget(c.id));
};

/* ---------- đồng bộ Supabase (bảng ttba_cases: id, user_id, data jsonb, updated_at) ----------
   Mỗi ca một dòng, data = cả ca. Ca mới nhất (updated) thắng. Ca đã từng đồng bộ (_s) mà trên Supabase không còn
   = đã xóa ở máy khác → xóa ở máy này. Ca mẫu (demo) không đồng bộ. */
const Sync = {
  sb: typeof TN !== 'undefined' ? TN.sb : null, user: null, state: 'off', err: '', snap: {}, timer: 0, busy: null,
  body: c => { const { _s, ...rest } = c; return JSON.stringify(rest); },
  soon() { if (this.user) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 800); } },
  async init() {
    if (!this.sb) return;
    try { this.user = await TN.currentUser(); } catch { this.user = null; }
    if (!this.user) { this.state = 'login'; return; }
    await this.pull();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.pull(true); });
  },
  async pull(rerender) {
    if (!this.user || this.busy) return this.busy;
    this.busy = (async () => {
      try {
        const { data, error } = await this.sb.from('ttba_cases').select('id, data');
        if (error) throw error;
        const remote = new Map(data.map(r => [r.id, r.data]));
        const local = new Map(S.cases.map(c => [c.id, c]));
        const out = [];
        for (const c of S.cases) {
          const r = remote.get(c.id);
          if (c.demo || (!r && !c._s)) out.push(c);            // ca mẫu, ca mới chưa đẩy lên
          else if (r) out.push(r.updated > c.updated ? { ...r, _s: 1 } : c);
          // còn lại: đã đồng bộ nhưng Supabase không còn → đã xóa ở máy khác
        }
        for (const [id, r] of remote) if (!local.has(id) && !S.gone.includes(id)) out.push({ ...r, _s: 1 });
        S.cases = out;
        for (const c of out) if (c._s && remote.has(c.id) && remote.get(c.id).updated === c.updated) this.snap[c.id] = this.body(c);
        this.state = 'on'; this.err = '';
        expired();
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
        await this.push();
      } catch (e) { this.state = 'err'; this.err = e.message || String(e); }
      this.busy = null;
      if (rerender) quietRoute();
    })();
    return this.busy;
  },
  async push() {
    if (!this.user) return;
    clearTimeout(this.timer);
    try {
      for (const id of [...S.gone]) {
        const { error } = await this.sb.from('ttba_cases').delete().eq('id', id);
        if (error) throw error;
        S.gone = S.gone.filter(x => x !== id);
      }
      const dirty = S.cases.filter(c => !c.demo && this.snap[c.id] !== this.body(c));
      if (dirty.length) {
        const rows = dirty.map(c => { const { _s, ...d } = c; return { id: c.id, user_id: this.user.id, data: d, updated_at: new Date(c.updated).toISOString() }; });
        const { error } = await this.sb.from('ttba_cases').upsert(rows);
        if (error) throw error;
        dirty.forEach(c => { c._s = 1; this.snap[c.id] = this.body(c); });
      }
      this.state = 'on'; this.err = '';
    } catch (e) { this.state = 'err'; this.err = e.message || String(e); }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    const b = document.getElementById('syncst'); if (b) b.outerHTML = syncLine();
  },
};
/** Xóa ca trên máy; ca đã đồng bộ thì xóa cả trên Supabase (mất mạng thì nhớ để xóa sau). */
function forget(id) {
  const c = caseById(id); if (!c) return;
  S.cases = S.cases.filter(x => x !== c);
  delete Sync.snap[id];
  if (c._s) S.gone.push(id);
  save();
}
function syncLine() {
  const t = { off: 'Cases are stored on this device only', login: 'Cases are stored on this device only — <a href="../">sign in to Trieu&#39;s Note</a> to sync', on: '✓ Synced with Supabase (Trieu&#39;s Note account)', err: '⚠ Sync failed: ' + esc(Sync.err) + ' — still saved on this device, will retry' }[Sync.state];
  return `<span id="syncst">${t}</span>`;
}

// ---------- tiện ích ----------
const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtTime = t => new Date(t).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
let toastT;
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
const caseById = id => S.cases.find(c => c.id === id);
const touch = c => { c.updated = Date.now(); save(); };
const STATUS = { draft: 'Recording', review: 'To review', done: 'Exported' };
function autosize(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 48) + 'px'; }

// ---------- giọng nói (Web Speech API, vi-VN) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Dict = {
  rec: null, active: false, finalText: '', onUpdate: null, lock: null, started: 0,
  async start(onUpdate) {
    if (!SR) return false;
    this.stop(true);
    this.active = true; this.finalText = ''; this.onUpdate = onUpdate; this.started = Date.now();
    try { this.lock = await navigator.wakeLock?.request('screen'); } catch { this.lock = null; }
    this._run();
    return true;
  },
  _run() {
    const r = new SR();
    r.lang = 'vi-VN'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) this.finalText += (this.finalText && !/\s$/.test(this.finalText) ? ' ' : '') + t.trim();
        else interim += t;
      }
      this.onUpdate?.(this.finalText, interim);
    };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      this.active = false;
      const msg = { 'not-allowed': 'Microphone / speech recognition not allowed (Settings › Safari › Microphone).', 'service-not-allowed': 'Speech recognition is off on this iPhone (Settings › Siri / Dictation).', network: 'Network lost during speech recognition.', 'language-not-supported': 'This device does not support Vietnamese speech recognition.' }[e.error] || 'Speech recognition error: ' + e.error;
      toast(msg); this.onUpdate?.(this.finalText, '', true);
    };
    // iOS hay tự dừng sau khoảng lặng: tự bật lại khi người dùng chưa bấm dừng
    r.onend = () => { if (this.active) { try { r.start(); } catch { this._run(); } } };
    this.rec = r;
    try { r.start(); } catch (err) { this.active = false; toast('Could not start the microphone: ' + err.message); }
  },
  stop(silent) {
    this.active = false;
    try { this.rec?.stop(); } catch {}
    this.rec = null;
    try { this.lock?.release(); } catch {}
    this.lock = null;
    const t = this.finalText.trim(); this.finalText = '';
    if (!silent) return t;
    return '';
  },
};

// ---------- Claude ----------
let sdkMod;
async function claude() {
  if (!C.key) throw Object.assign(new Error('No Claude API key yet. Paste one in Settings.'), { code: 'nokey' });
  sdkMod ||= await import(SDK_URL);
  const Anthropic = sdkMod.default;
  return new Anthropic({ apiKey: C.key, dangerouslyAllowBrowser: true });
}
function glossaryText() {
  return C.glossary.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('=')).join('\n');
}
function buildPrompt(c) {
  const segs = c.segs.filter(s => s.text.trim()).map((s, i) => `[Đoạn ${i + 1}${s.topic ? ' · chủ đề: ' + TOPIC_NAME[s.topic] : ''}]\n${s.text.trim()}`).join('\n\n');
  const g = glossaryText();
  const cur = c.form ? JSON.stringify(Object.fromEntries(FKEYS.map(k => [k, c.form[k] || ''])), null, 1) : '';
  const b = bnOf(c), e = egfr(b);
  const info = [b.gioi && (b.gioi === 'nu' ? 'nữ' : 'nam'), b.tuoi && b.tuoi + ' tuổi', b.phong && 'phòng ' + b.phong, b.can_nang && b.can_nang + ' kg',
    b.dtd && 'đái tháo đường', b.bmv && 'bệnh mạch vành mạn đã can thiệp', b.creat && `creatinin ${b.creat} µmol/L`, e != null && `eGFR ${Math.round(e)} (${ckdG(e)})`].filter(Boolean).join(', ');
  return (info ? `Thông tin bác sĩ đã nhập (không gồm họ tên): ${info}\n\n` : '') + (g ? `Từ điển cá nhân của bác sĩ (cách đọc = cách viết):\n${g}\n\n` : '')
    + (cur ? `Bản hiện tại (bác sĩ đã duyệt/sửa, giữ nguyên và bổ sung):\n${cur}\n\n` : '')
    + `Các đoạn bác sĩ đọc:\n${segs}`;
}
async function organize(c) {
  const params = {
    model: C.model, max_tokens: 16000, system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(c) }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
  };
  let res;
  if (window.__TTBA_MOCK__) res = await window.__TTBA_MOCK__(params); // chỉ dùng khi kiểm thử
  else {
    const cl = await claude();
    // Opus / Sonnet: khi bị bộ lọc an toàn từ chối, API tự chạy lại trên model dự phòng
    res = C.model.startsWith('claude-haiku') ? await cl.messages.create(params)
      : await cl.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to process this content' + (res.stop_details?.explanation ? ': ' + res.stop_details.explanation : '.'));
  if (res.stop_reason === 'max_tokens') throw new Error('The result was too long and got cut off. Try fewer segments.');
  const txt = (res.content || []).find(b => b.type === 'text')?.text;
  if (!txt) throw new Error('Claude returned no content.');
  const out = JSON.parse(txt);
  const m = MODELS.find(x => x[0] === C.model) || MODELS[0], u = res.usage || {};
  const usd = ((u.input_tokens || 0) * m[2] + (u.output_tokens || 0) * m[3]) / 1e6;
  return { out, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, usd, model: res.model || C.model } };
}
function apiError(e) {
  const st = e?.status;
  if (e?.code === 'nokey') return e.message;
  if (st === 401) return 'API key is wrong or revoked (Settings).';
  if (st === 403) return 'This API key cannot use this model.';
  if (st === 404) return 'Model not found — pick another model in Settings.';
  if (st === 429) return 'Rate limit or spend limit reached. Try again in a few minutes.';
  if (st === 529 || st >= 500) return 'Claude is overloaded. Try again later.';
  if (e instanceof SyntaxError) return 'The result was not in the expected format. Try again.';
  if (!navigator.onLine) return 'No network connection.';
  return e?.message || String(e);
}

// ---------- kiểm tra thông tin định danh trước khi gửi ----------
function idRisks(c) {
  const txt = c.segs.map(s => s.text).join('\n'), hits = [];
  if (/(họ tên|họ và tên|tên là|tên bệnh nhân|bệnh nhân tên)/i.test(txt)) hits.push('mentions the patient\'s name');
  const ten = bnOf(c).ten.trim().toLowerCase();
  if (ten.length > 3 && txt.toLowerCase().includes(ten)) hits.push('contains the patient\'s full name');
  if (/(?<!\d)(0\d{9}|\d{12})(?!\d)/.test(txt.replace(/[\s.]/g, ''))) hits.push('contains a number that looks like a phone / ID number');
  if (/(số hồ sơ|mã bệnh án|mã y tế|số vào viện|số căn cước|cccd)/i.test(txt)) hits.push('mentions a record / ID number');
  return hits;
}

// ---------- định tuyến ----------
// vẽ lại sau khi đồng bộ, trừ khi đang ghi âm hay đang gõ
function quietRoute() { if (!Dict.active && !document.activeElement?.matches('textarea, input, select') && !document.querySelector('.busy')) route(); }
function route() {
  if (Dict.active) Dict.stop(true);
  document.querySelector('.dock')?.remove();
  const h = location.hash.slice(1);
  if (h === 'cai-dat') return renderSettings();
  const m = h.match(/^c\/([^/]+)(?:\/(ghi|duyet|hep|xuat))?$/);
  if (m && caseById(m[1])) return renderCase(caseById(m[1]), m[2] || (caseById(m[1]).form ? 'duyet' : 'ghi'));
  renderList();
}
window.addEventListener('hashchange', route);
const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };

// Ca mẫu (bệnh nhân giả, đã sắp xếp sẵn) để xem giao diện — không gọi API
function demoCase() {
  const t = Date.now(), seg = (topic, text, dur, ago) => ({ id: uid(), at: t - ago * 60000, topic, text, dur });
  return {
    id: uid(), label: 'Sample case', created: t, updated: t, status: 'review', demo: true,
    bn: { ten: 'Sample Patient (fake)', tuoi: '68', gioi: 'nam', phong: '12', can_nang: '62', dtd: true, bmv: false, creat: '160' },
    pad: { side: 'phải', sym: 'tissue', tm: 'below', w: '1', fi: '0', abi: '0.45', tp: '25' },
    segs: [
      seg('', 'bệnh nhân nam 68 tuổi phòng 12 khoa phẫu thuật mạch máu vào viện ngày 20 tháng 11 vì đau nhức bàn chân phải và vết loét ngón 1 chân phải', 18, 30),
      seg('benh_su', 'khoảng 6 tháng nay đau cách hồi bắp chân phải đi khoảng 100 mét phải nghỉ 2 tuần nay đau cả khi nghỉ về đêm loét đầu ngón 1 chân phải không lành', 22, 28),
      seg('tien_su', 'tăng huyết áp 10 năm đái tháo đường típ 2 8 năm đang dùng metformin 850 mi li gam ngày 2 lần hút thuốc lá 30 gói năm không dị ứng thuốc', 20, 26),
      seg('kham', 'chân phải lạnh hơn chân trái mạch khoeo phải bắt yếu mạch mu chân và chày sau phải không bắt được loét ngón 1 kích thước 1 x 1 cm đáy nhợt không có mủ', 21, 24),
      seg('mach_mau', 'a bê i phải 0,45 trái 0,9 siêu âm đốp lơ hẹp tắc động mạch đùi nông phải đoạn giữa dài khoảng 12 cm dòng chảy sau tắc dạng đơn pha', 19, 22),
      seg('cls', 'glucose 9,8 hba1c 8,2 phần trăm creatinin 160 cholesterol LDL 3,4', 12, 20),
      seg('dieu_tri', 'đã can thiệp nong bóng đặt stent động mạch đùi nông phải ngày 22 tháng 11 dùng aspirin 81 clopidogrel 75 atorvastatin 40 thay băng vết loét hằng ngày', 23, 10),
    ],
    form: {
      nguoi_benh: 'Nam, 68 tuổi, Khoa Phẫu thuật mạch máu, phòng 12.',
      ngay_vao_vien: '20/11',
      ly_do: 'Đau nhức bàn chân phải, loét ngón I chân phải.',
      benh_su: 'Khoảng 6 tháng nay đau cách hồi bắp chân phải, quãng đường đi bộ khoảng 100 m. 2 tuần nay đau cả khi nghỉ, tăng về đêm; xuất hiện vết loét đầu ngón I chân phải không lành.',
      tien_su: '- Tăng huyết áp 10 năm.\n- Đái tháo đường típ 2, 8 năm, đang dùng metformin 850 mg × 2 lần/ngày.\n- Hút thuốc lá 30 gói-năm.\n- Không ghi nhận dị ứng thuốc.',
      kham: 'Chân phải lạnh hơn chân trái. Mạch khoeo phải bắt yếu; mạch mu chân và chày sau phải không bắt được. Loét đầu ngón I chân phải kích thước 1 × 1 cm, đáy nhợt, không có mủ.',
      mach_mau: '- ABI: phải 0,45; trái 0,90.\n- Siêu âm Doppler: hẹp tắc động mạch đùi nông phải đoạn giữa, dài khoảng 12 cm; dòng chảy sau chỗ tắc dạng đơn pha.\n- Phân độ: Rutherford 5, Fontaine IV.',
      cls: 'Glucose 9,8 mmol/L; HbA1c 8,2 %; creatinin 160 µmol/L; LDL-cholesterol 3,4 mmol/L.',
      cd_vao: 'Bệnh động mạch chi dưới mạn tính đe dọa chi (CLTI) chân phải, loét ngón I (ICD-10: I70.23 – gợi ý) / Tăng huyết áp / Đái tháo đường típ 2.',
      cd_hien_tai: '',
      dieu_tri: '- Can thiệp nong bóng, đặt stent động mạch đùi nông phải ngày 22/11.\n- Aspirin 81 mg, clopidogrel 75 mg, atorvastatin 40 mg.\n- Thay băng vết loét hằng ngày.',
      tinh_trang: '',
      huong_tiep: '',
    },
    meta: {
      can_kiem_tra: [
        { muc: 'ngay_vao_vien', noi_dung: '20/11', ly_do: 'Không nghe thấy năm vào viện.' },
        { muc: 'mach_mau', noi_dung: 'Rutherford 5, Fontaine IV', ly_do: 'Phân độ được suy ra từ loét ngón và đau khi nghỉ, bác sĩ không đọc; cần xác nhận.' },
        { muc: 'cd_vao', noi_dung: 'ICD-10: I70.23', ly_do: 'Mã ICD-10 là gợi ý, cần bác sĩ xác nhận.' },
        { muc: 'cls', noi_dung: 'creatinin 160 µmol/L', ly_do: 'Không đọc đơn vị; ghi theo đơn vị thường dùng.' },
      ],
      chuan_hoa: [
        { goc: 'a bê i', chuan: 'ABI' }, { goc: 'đốp lơ', chuan: 'Doppler' }, { goc: 'mi li gam', chuan: 'mg' },
        { goc: 'hba1c', chuan: 'HbA1c' }, { goc: 'ngón 1', chuan: 'ngón I' },
      ],
      usage: { in: 3120, out: 1450, usd: 0.0415, model: 'sample case (no API call)' }, at: t, segCount: 7,
    },
  };
}

// ---------- thông tin người bệnh (c.bn) — họ tên chỉ lưu trên máy / Supabase, KHÔNG gửi cho Claude ----------
const BN_DEF = { ten: '', tuoi: '', gioi: '', phong: '', can_nang: '', dtd: false, bmv: false, creat: '' };
const bnOf = c => Object.assign({}, BN_DEF, c.bn || {});
const numv = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
/** eGFR theo CKD-EPI 2021 (không hệ số chủng tộc); creatinin µmol/L. Cần tuổi + giới. */
function egfr(b) {
  const cr = numv(b.creat), age = numv(b.tuoi);
  if (cr == null || cr <= 0 || age == null || !b.gioi) return null;
  const f = b.gioi === 'nu', k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302, s = cr / 88.4 / k;
  return 142 * Math.min(s, 1) ** a * Math.max(s, 1) ** -1.2 * 0.9938 ** age * (f ? 1.012 : 1);
}
const ckdG = e => (e >= 90 ? 'G1' : e >= 60 ? 'G2' : e >= 45 ? 'G3a' : e >= 30 ? 'G3b' : e >= 15 ? 'G4' : 'G5');
const caseName = c => bnOf(c).ten.trim() || c.label || 'Unnamed case';
function caseSub(c) { const b = bnOf(c); return [b.tuoi && `${b.tuoi} y`, b.phong && `Room ${b.phong}`].filter(Boolean).join(' · '); }
/** Thẻ hiện ở danh sách: phân độ PAD + bệnh nền ảnh hưởng điều trị. */
function caseTags(c) {
  const b = bnOf(c), t = [];
  if (c.pad?.sym && typeof PAD !== 'undefined') t.push(['pad', padCalc({ ...PAD_DEF, ...c.pad }).short]);
  if (b.dtd) t.push(['dtd', 'Diabetes']);
  if (b.bmv) t.push(['bmv', 'CAD s/p PCI/CABG']);
  const e = egfr(b);
  if (e != null && e < 60) t.push(['ckd', `CKD ${ckdG(e)} · eGFR ${Math.round(e)}`]);
  return t;
}
const tagsHtml = c => { const t = caseTags(c); return t.length ? `<span class="tags">${t.map(([k, l]) => `<em class="tag ${k}">${esc(l)}</em>`).join('')}</span>` : ''; };
function bnBlock(c) {
  const b = bnOf(c), e = egfr(b);
  const tx = (k, l, ph, type = 'text', extra = '') => `<label class="bn-f">${l}<input name="${k}" type="${type}" value="${esc(b[k])}" placeholder="${ph}" ${extra}></label>`;
  return `<details class="bn"${b.ten ? '' : ' open'}>
    <summary><span class="bn-s"><b>${esc(caseName(c))}</b><small>${esc(caseSub(c)) || 'Tap to enter name, age, room'}</small></span>${tagsHtml(c)}</summary>
    <form class="bn-form" autocomplete="off" onsubmit="return false">
      ${tx('ten', 'Full name', 'Kept on device, never sent to Claude', 'text', 'class="wide-in"')}
      <div class="bn-row">${tx('tuoi', 'Age', '68', 'number', 'inputmode="numeric" min="0" max="120"')}
        <label class="bn-f">Sex<select name="gioi"><option value=""${!b.gioi ? ' selected' : ''}>—</option><option value="nam"${b.gioi === 'nam' ? ' selected' : ''}>Male</option><option value="nu"${b.gioi === 'nu' ? ' selected' : ''}>Female</option></select></label>
        ${tx('phong', 'Room', '12')}${tx('can_nang', 'Weight (kg)', '60', 'number', 'inputmode="decimal" min="0" step="0.1"')}</div>
      <div class="bn-chk"><label><input type="checkbox" name="dtd"${b.dtd ? ' checked' : ''}> Diabetes mellitus</label>
        <label><input type="checkbox" name="bmv"${b.bmv ? ' checked' : ''}> Chronic coronary artery disease, revascularised (PCI / CABG)</label></div>
      <div class="bn-row">${tx('creat', 'Creatinine (µmol/L)', '90', 'number', 'inputmode="decimal" min="0" step="1"')}
        <p class="bn-egfr">${e != null ? `eGFR <b>${Math.round(e)}</b> mL/min/1.73 m² · <b>${ckdG(e)}</b>` : 'eGFR: enter creatinine, age, sex'}</p></div>
      <p class="small muted" style="margin:0">eGFR by CKD-EPI 2021; the "CKD" tag shows when eGFR &lt; 60 (G3a–G5). Comorbidities and creatinine are filled in automatically when Claude organises the case (if dictated); you can edit them.</p>
    </form>
  </details>`;
}
function wireBn(c, root) {
  const fm = root.querySelector('.bn-form');
  const upd = () => {
    const fd = new FormData(fm), b = bnOf(c);
    for (const k of ['ten', 'tuoi', 'gioi', 'phong', 'can_nang', 'creat']) b[k] = String(fd.get(k) ?? '').trim();
    b.dtd = fd.has('dtd'); b.bmv = fd.has('bmv');
    c.bn = b;
    const e = egfr(b);
    root.querySelector('.bn-egfr').innerHTML = e != null ? `eGFR <b>${Math.round(e)}</b> mL/min/1.73 m² · <b>${ckdG(e)}</b>` : 'eGFR: enter creatinine, age, sex';
    root.querySelector('summary').innerHTML = `<span class="bn-s"><b>${esc(caseName(c))}</b><small>${esc(caseSub(c)) || 'Tap to enter name, age, room'}</small></span>${tagsHtml(c)}`;
  };
  fm.addEventListener('input', upd);
  fm.addEventListener('change', () => { upd(); touch(c); });
}

// ---------- Heparin (logic ở heparin.js, bản chuyển từ scripts/heparin/*.ts — Dager 2018, ASHP) ----------
const HEP_VI = { vte: 'VTE (huyết khối TM sâu / thuyên tắc phổi)', stemi_rtpa: 'NMCT ST chênh lên + rt-PA liều đầy đủ', stemi_combo_rtpa: 'NMCT ST chênh lên + rt-PA phối hợp', nstemi_ua: 'NMCT không ST chênh lên / đau thắt ngực không ổn định', pci_with_gp: 'PCI có thuốc ức chế GP IIb/IIIa', pci_without_gp: 'PCI không có GP IIb/IIIa' };
const HEP_DEF = { proto: 'vte', iu: '25000', ml: '50', rate: '', aptt: '' };
const vn = (x, d = 1) => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: d }); // dòng chèn vào bản tóm tắt (tiếng Việt)
const en = (x, d = 1) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d }); // giao diện
function hepCalc(c) {
  const h = Object.assign({}, HEP_DEF, c.hep || {}), p = HEP.getProtocol(h.proto), w = numv(bnOf(c).can_nang);
  const iu = numv(h.iu), ml = numv(h.ml), conc = iu > 0 && ml > 0 ? iu / ml : null;
  const r = { h, p, w, conc, init: null, adj: null };
  if (!(w > 0) || !p.calculable || !conc) return r;
  r.init = HEP.calcInitialDose(w, p, conc);
  const rate = numv(h.rate) ?? r.init.infusion.mLPerHr, aptt = numv(h.aptt);
  if (aptt > 0 && rate >= 0) { r.rateMl = rate; r.adj = HEP.calcAPTTAdjustment(aptt, w, rate * conc, p.apttBands, conc); }
  return r;
}
function hepLines(r) {
  const { h, p, w, init: d, adj: a } = r, name = HEP_VI[p.id];
  const init = d && `- Heparin không phân đoạn TTM (phác đồ ${name}, ${vn(w)} kg; pha ${vn(numv(h.iu), 0)} UI/${vn(numv(h.ml))} mL): bolus ${vn(d.bolus.iu, 0)} UI (${vn(d.bolus.mL)} mL) TM, truyền ${vn(d.infusion.iuPerHr, 0)} UI/giờ (${vn(d.infusion.mLPerHr)} mL/giờ); aPTT đích ${p.targetAPTT.low}–${p.targetAPTT.high} giây, kiểm tra aPTT sau 6 giờ.`;
  let adj = null;
  if (a) {
    const parts = a.noChange ? [`trong đích, giữ nguyên ${vn(r.rateMl)} mL/giờ`]
      : [a.bolusSurcharge && `bolus thêm ${vn(a.bolusSurcharge.iu, 0)} UI (${vn(a.bolusSurcharge.mL)} mL)`, a.holdOneHour && 'ngưng truyền 1 giờ',
        `${a.newRateIuPerHr > r.rateMl * r.conc ? 'tăng tốc độ lên' : 'giảm tốc độ còn'} ${vn(a.newRateIuPerHr, 0)} UI/giờ (${vn(a.newRateMlPerHr)} mL/giờ)`].filter(Boolean);
    adj = `- Chỉnh heparin theo aPTT ${vn(a.aptt)} giây (đang ${vn(r.rateMl)} mL/giờ): ${parts.join(', ')}; kiểm tra aPTT sau 6 giờ.`;
  }
  return { init, adj };
}
function paneHeparin(c, $p) {
  if (typeof HEP === 'undefined') { $p.innerHTML = '<div class="notice">Could not load the heparin calculator.</div>'; return; }
  const hset = o => { c.hep = { ...Object.assign({}, HEP_DEF, c.hep || {}), ...o }; };
  const band = b => (b.noChange ? 'No change' : [b.bolusPerKg > 0 && `bolus ${b.bolusPerKg} IU/kg${b.bolusMaxIu ? ` (max ${en(b.bolusMaxIu, 0)})` : ''}`, b.holdOneHour && 'hold 1 hr', `${b.ratePerKg > 0 ? 'increase' : 'decrease'} ${Math.abs(b.ratePerKg)} IU/kg/hr`].filter(Boolean).join(', '));
  const ins = k => `<div class="row"><button type="button" class="grow" data-ins="${k}">Insert into Treatment</button><button type="button" class="ghost" data-cp="${k}">Copy</button></div>`;
  let L = {};
  // phần tĩnh (ô nhập giữ nguyên khi gõ, để bàn phím iPhone không bị đóng)
  const build = () => {
    const r = hepCalc(c), { h, p } = r, adv = h.proto !== 'vte';
    $p.innerHTML = `
      <div class="notice"><b>${esc(p.name)} protocol</b>${p.calculable ? ` — bolus ${p.bolusPerKg} IU/kg${p.bolusMaxIu ? ` (max ${en(p.bolusMaxIu, 0)} IU)` : ''}, infusion ${p.infusionPerKgHr} IU/kg/hr${p.infusionMaxIuPerHr ? ` (max ${en(p.infusionMaxIuPerHr, 0)} IU/hr)` : ''}, target aPTT ${p.targetAPTT.low}–${p.targetAPTT.high} sec` : ' — monitored by ACT, no aPTT adjustment'}. Per Dager 2018 (ASHP). Verify doses before administration; institutional protocol takes precedence.${adv ? ' <button type="button" class="linkbtn" id="tovte">Back to VTE protocol</button>' : ''}</div>
      <form class="card hp hp-in" autocomplete="off" onsubmit="return false">
        <div class="bn-row">
          <label class="bn-f">Weight (kg)<input name="w" type="number" inputmode="decimal" min="0" step="0.1" value="${esc(bnOf(c).can_nang)}" placeholder="60"></label>
          ${p.calculable ? `<label class="bn-f">Heparin (IU)<input name="iu" type="number" inputmode="numeric" min="0" value="${esc(h.iu)}"></label>
          <label class="bn-f">Diluted in (mL)<input name="ml" type="number" inputmode="decimal" min="0" value="${esc(h.ml)}"></label>` : ''}
        </div>
        <div id="hpconc" class="small muted"></div>
      </form>
      ${!p.calculable ? `<div class="card hp"><h3>Bolus dose</h3><div id="hpact"></div><p class="small">ACT target: ${esc(p.actTargetLabel)}</p><p class="small muted">${esc(p.notes)}</p></div>` : `
      <div class="card hp"><h3>Initial dose</h3><div id="hpinit"></div>${ins('init')}</div>
      <div class="card hp"><h3>aPTT adjustment</h3>
        <form class="bn-row" autocomplete="off" onsubmit="return false">
          <label class="bn-f">Current rate (mL/hr)<input name="rate" type="number" inputmode="decimal" min="0" step="0.1" value="${esc(h.rate)}"></label>
          <label class="bn-f">aPTT (sec)<input name="aptt" type="number" inputmode="decimal" min="0" step="1" value="${esc(h.aptt)}" placeholder="75"></label>
        </form>
        <div id="hpadj"></div>${ins('adj')}
        <table class="hp-tab"><tr><th>aPTT (sec)</th><th>Action</th></tr>${p.apttBands.map(b => `<tr class="${b.noChange ? 'ok' : b.holdOneHour || b.from === 0 ? 'hi' : ''}"><td>${HEP.formatBandRange(b)}</td><td>${band(b)}</td></tr>`).join('')}</table>
      </div>`}
      <details class="card hp-adv"${adv ? ' open' : ''}><summary>Advanced: other protocols (cardiac, PCI)</summary>
        <label class="bn-f">Protocol<select id="proto">${HEP.PROTOCOLS.map(x => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}${x.calculable ? '' : ' · ACT'}</option>`).join('')}</select></label>
        <p class="small muted">${esc(p.notes)} <i>(${esc(p.citation)})</i></p>
        <details><summary class="small">References (${HEP.REFERENCES.length})</summary><ol class="small">${HEP.REFERENCES.map(x => `<li>${esc(x.title)}. <span class="muted">${esc(x.source)}, ${x.year}.</span> <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">link</a></li>`).join('')}</ol></details>
      </details>`;
    $p.querySelectorAll('input[name]').forEach(el => {
      el.addEventListener('input', () => { if (el.name === 'w') c.bn = { ...bnOf(c), can_nang: el.value.trim() }; else hset({ [el.name]: el.value.trim() }); upd(); });
      el.addEventListener('change', () => touch(c));
    });
    const setProto = id => { hset({ proto: id, rate: '', aptt: '' }); touch(c); build(); };
    $p.querySelector('#proto').onchange = e => setProto(e.target.value);
    $p.querySelector('#tovte')?.addEventListener('click', () => setProto('vte'));
    $p.querySelectorAll('[data-ins]').forEach(b => (b.onclick = () => {
      const line = L[b.dataset.ins]; if (!line) return;
      if (!c.form) c.form = Object.fromEntries(FKEYS.map(k => [k, '']));
      c.form.dieu_tri = (c.form.dieu_tri.trim() ? c.form.dieu_tri.trim() + '\n' : '') + line;
      touch(c); toast('Inserted into Treatment (Review tab)');
    }));
    $p.querySelectorAll('[data-cp]').forEach(b => (b.onclick = async () => {
      const line = L[b.dataset.cp]; if (!line) return;
      try { await navigator.clipboard.writeText(line.replace(/^- /, '')); toast('Copied'); } catch { toast('Could not copy'); }
    }));
    upd();
  };
  // phần kết quả (vẽ lại mỗi lần gõ)
  const upd = () => {
    const r = hepCalc(c), { p, w } = r, q = s => $p.querySelector(s);
    L = hepLines(r);
    q('#hpconc').innerHTML = (p.calculable ? (r.conc ? `Concentration ${en(r.conc)} IU/mL` : 'Enter heparin amount and diluent volume') : '') + (w > 200 ? '<p class="flag">Weight &gt; 200 kg — please double-check.</p>' : '');
    if (!p.calculable) {
      q('#hpact').innerHTML = `<p class="hp-big">${w > 0 ? (p.id === 'pci_with_gp' ? `${en(50 * w, 0)}–${en(70 * w, 0)} IU` : `${en(70 * w, 0)}–${en(100 * w, 0)} IU`) : esc(p.bolusRangeLabel)}</p>`;
      return;
    }
    q('#hpinit').innerHTML = r.init ? `<div class="hp-res"><div><small>IV bolus</small><b>${en(r.init.bolus.iu, 0)} IU</b><span>${en(r.init.bolus.mL)} mL${r.init.bolusCapped ? ' · capped at max' : ''}</span></div>
      <div><small>Continuous infusion</small><b>${en(r.init.infusion.mLPerHr)} mL/hr</b><span>${en(r.init.infusion.iuPerHr, 0)} IU/hr${r.init.infusionCapped ? ' · capped at max' : ''}</span></div></div>`
      : '<p class="small muted" style="margin:0">Enter the weight (here or in the patient info).</p>';
    q('[name="rate"]').placeholder = r.init ? String(r.init.infusion.mLPerHr) : '';
    const a = r.adj;
    q('#hpadj').innerHTML = a ? `${a.holdOneHour ? '<p class="hp-stop">Hold the infusion for 1 hour, then restart at the new rate.</p>' : ''}
      <div class="hp-res">${a.noChange ? `<div class="ok"><small>aPTT in target range</small><b>No change</b><span>${en(r.rateMl)} mL/hr</span></div>` : `
        ${a.bolusSurcharge ? `<div><small>Additional bolus</small><b>${en(a.bolusSurcharge.iu, 0)} IU</b><span>${en(a.bolusSurcharge.mL)} mL</span></div>` : ''}
        <div><small>New rate</small><b>${en(a.newRateMlPerHr)} mL/hr</b><span>${en(a.newRateIuPerHr, 0)} IU/hr${a.newRateIuPerHr === 0 ? ' · minimum 0' : ''}</span></div>`}</div>`
      : '<p class="small muted" style="margin:0">Enter the latest aPTT; if "Current rate" is empty, the initial rate is used.</p>';
    $p.querySelectorAll('[data-ins="init"],[data-cp="init"]').forEach(b => (b.disabled = !L.init));
    $p.querySelectorAll('[data-ins="adj"],[data-cp="adj"]').forEach(b => (b.disabled = !L.adj));
  };
  build();
}

// ---------- OR schedule → Google Calendar (một nút; logic ở orsched.js) ----------
// Google Identity Services phải nạp sẵn để lúc bấm nút mở được cửa sổ đăng nhập ngay (Safari chặn popup mở sau await).
const GIS_URL = 'https://accounts.google.com/gsi/client', XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const OR_SCOPE = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events';
const loadScript = src => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)?.dataset.ok) return ok(); const el = document.createElement('script'); el.src = src; el.onload = () => { el.dataset.ok = 1; ok(); }; el.onerror = () => no(new Error('Could not load ' + src)); document.head.append(el); });
const Gtok = { token: '', exp: 0, client: null, cid: '' };
function orPreload() { if (C.gClientId && !window.google?.accounts) loadScript(GIS_URL).catch(() => {}); }
function orButton() {
  const out = document.getElementById('orres');
  if (!C.gClientId) { toast('Set up Google in Settings first'); return go('cai-dat'); }
  if (!window.google?.accounts?.oauth2) { out.innerHTML = '<p class="small muted">Loading Google sign-in… tap again in a moment.</p>'; orPreload(); return; }
  if (Gtok.token && Date.now() < Gtok.exp) return orRun(out);
  if (!Gtok.client || Gtok.cid !== C.gClientId) {
    Gtok.cid = C.gClientId;
    Gtok.client = google.accounts.oauth2.initTokenClient({ client_id: C.gClientId, scope: OR_SCOPE, callback: r => {
      if (r.error) { out.innerHTML = `<p class="flag">Google sign-in failed: ${esc(r.error_description || r.error)}</p>`; return; }
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...OR_SCOPE.split(' '))) { out.innerHTML = '<p class="flag">Both Gmail and Calendar access are needed. Tap again and allow both.</p>'; return; }
      Gtok.token = r.access_token; Gtok.exp = Date.now() + (r.expires_in - 60) * 1000; orRun(out);
    }, error_callback: e => { out.innerHTML = `<p class="flag">Google sign-in was closed or blocked (${esc(e.type || 'error')}).</p>`; } });
  }
  Gtok.client.requestAccessToken({ prompt: '' });
}
async function orRun(out) {
  const btn = document.getElementById('orsync'); if (btn) btn.disabled = true;
  out.innerHTML = '<p class="small muted">Checking Gmail for schedule emails…</p>';
  try {
    await loadScript(XLSX_URL);
    const readXlsx = u8 => { const wb = XLSX.read(u8, { type: 'array' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: true }); };
    const res = await ORS.run({ token: Gtok.token, calendarId: C.gCalendarId || 'primary', days: C.orDays || 2, readXlsx });
    C.orLast = Date.now(); saveCfg();
    const d = x => (x ? x.split('-').reverse().join('/') : '—');
    const MSG = { created: '✓ Added to Calendar', exists: 'Already in Calendar', nocases: 'No Pt tim cases', noxlsx: 'No .xlsx attachment', nodate: 'No date in the email subject', error: '✗ Error (will retry next time)' };
    out.innerHTML = res.length ? `<ul class="orlist">${res.map(r => `<li class="${r.status}"><b>${d(r.date)}</b> · ${MSG[r.status] || r.status}${r.title ? `<br><small>${esc(r.title)}</small>` : ''}${r.error ? `<br><small>${esc(r.error)}</small>` : ''}</li>`).join('')}</ul>`
      : `<p class="small muted">No new schedule emails in the last ${C.orDays || 2} days.</p>`;
  } catch (e) {
    if (e.status === 401) { Gtok.token = ''; out.innerHTML = '<p class="flag">Google sign-in expired. Tap the button again.</p>'; }
    else out.innerHTML = `<p class="flag">${esc(e.status === 403 ? 'Access denied by Google (check the OAuth setup / test user in Settings).' : e.status === 404 ? 'Calendar not found — check the Calendar ID in Settings.' : e.message)}</p>`;
  } finally { if (btn) btn.disabled = false; }
}

// ---------- danh sách ca ----------
function renderList() {
  const cs = [...S.cases].sort((a, b) => b.updated - a.updated);
  $app.innerHTML = `
    ${!C.key ? `<div class="notice"><b>Getting started:</b> open <a href="#cai-dat">Settings</a> and paste a Claude API key (stored on this device only). Dictation works without a key.</div>` : ''}
    <button class="newcase" type="button" id="new">+ New case</button>
    <div class="orbox"><button class="ghost orbtn" type="button" id="orsync">Update OR schedule → Calendar</button><div id="orres">${C.orLast ? `<p class="small muted">Last updated ${fmtTime(C.orLast)}</p>` : ''}</div></div>
    <div class="cases">${cs.map(c => `<button class="case" type="button" data-id="${c.id}"><b>${esc(caseName(c))}</b><span>${esc(caseSub(c)) || '—'}</span><i><span class="st ${c.status}">${STATUS[c.status]}</span></i>${tagsHtml(c)}</button>`).join('') || '<p class="empty">No cases yet.</p>'}</div>
    <button class="ghost demo" type="button" id="demo">View sample case (fake patient)</button>
    <p class="muted small">${syncLine()}${C.keepDays > 0 ? `; auto-deleted after ${C.keepDays} days without edits` : ''}. When dictating, do not say the patient's name, phone or record number.</p>`;
  document.getElementById('new').onclick = () => {
    const c = { id: uid(), label: '', bn: { ...BN_DEF }, created: Date.now(), updated: Date.now(), status: 'draft', segs: [], form: null, meta: null };
    S.cases.push(c); save(); go('c/' + c.id + '/ghi');
  };
  document.getElementById('orsync').onclick = orButton;
  orPreload();
  document.getElementById('demo').onclick = () => {
    let c = S.cases.find(x => x.demo);
    if (!c) { c = demoCase(); S.cases.push(c); save(); }
    go('c/' + c.id + '/duyet');
  };
  $app.querySelectorAll('.case').forEach(b => (b.onclick = () => go('c/' + b.dataset.id)));
}

// ---------- một ca ----------
function renderCase(c, tab) {
  $app.innerHTML = `
    <div class="casehead">
      <div class="row"><button class="back" type="button" id="back">‹ Cases</button><button class="back delcase" type="button" id="delcase">Delete case</button></div>
      ${bnBlock(c)}
      <div class="tabs" role="tablist">${[['ghi', 'Record'], ['duyet', 'Review'], ['hep', 'Heparin'], ['xuat', 'Export']].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    </div>
    <div id="pane" style="display:grid;gap:12px"></div>`;
  document.getElementById('back').onclick = () => go('');
  document.getElementById('delcase').onclick = () => { if (confirm(`Permanently delete "${caseName(c)}"${c._s ? ' (also on Supabase)' : ''}?`)) { forget(c.id); go(''); } };
  wireBn(c, $app.querySelector('.casehead'));
  $app.querySelectorAll('.tabs [data-t]').forEach(b => (b.onclick = () => go(`c/${c.id}/${b.dataset.t}`)));
  document.querySelector('.dock')?.remove();
  ({ ghi: paneRecord, duyet: paneReview, hep: paneHeparin, xuat: paneExport })[tab](c, document.getElementById('pane'));
}

// --- Ghi ---
function paneRecord(c, $p) {
  let topic = '';
  $p.innerHTML = `
    <div class="topics" role="group" aria-label="Topic of the next segment">${TOPICS.map(([k, , l]) => `<button type="button" data-k="${k}" aria-pressed="${k === topic}">${l}</button>`).join('')}</div>
    ${SR ? '' : `<div class="notice">This browser has no speech recognition. Tap <b>Type</b>, then use the <b>microphone on the iPhone keyboard</b> to dictate.</div>`}
    <div class="segs" id="segs"></div>`;
  const $segs = $p.querySelector('#segs');
  const syncOrg = () => { const b = document.getElementById('org'); if (b) b.disabled = !c.segs.some(s => s.text.trim()); };
  $p.querySelectorAll('.topics button').forEach(b => (b.onclick = () => { topic = b.dataset.k; $p.querySelectorAll('.topics button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
  const drawSegs = () => {
    $segs.innerHTML = c.segs.map((s, i) => `<div class="seg" data-i="${i}"><div class="meta"><b>Segment ${i + 1}</b>${s.topic ? '· ' + esc(TOPIC_EN[s.topic]) : ''}${s.dur ? ' · ' + mmss(s.dur) : ''}<button class="ghost" type="button" data-del="${i}">Delete</button></div><textarea aria-label="Segment ${i + 1} text">${esc(s.text)}</textarea></div>`).join('')
      || '<p class="empty">Pick a topic (optional), then tap the red button to dictate. Dictate in segments, in any order.</p>';
    $segs.querySelectorAll('textarea').forEach(t => { autosize(t); t.oninput = () => autosize(t); t.onchange = () => { c.segs[+t.closest('.seg').dataset.i].text = t.value; touch(c); syncOrg(); }; });
    $segs.querySelectorAll('[data-del]').forEach(b => (b.onclick = () => { if (confirm('Delete this segment?')) { c.segs.splice(+b.dataset.del, 1); touch(c); drawSegs(); syncOrg(); } }));
  };
  drawSegs();

  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.innerHTML = `<div class="in"><button class="side" type="button" id="type">Type</button><div><button class="rec" type="button" id="rec" aria-label="Start recording"></button><div class="timer" id="timer"></div></div><button class="side" type="button" id="org" ${c.segs.some(s => s.text.trim()) ? '' : 'disabled'}>Organise →</button></div>`;
  document.body.append(dock);
  const $rec = dock.querySelector('#rec'), $timer = dock.querySelector('#timer'), $org = dock.querySelector('#org');
  let live = null, tick = null;
  const finish = () => {
    const t = Dict.stop();
    clearInterval(tick); $rec.classList.remove('on'); $rec.setAttribute('aria-label', 'Start recording'); $timer.textContent = '';
    live?.remove(); live = null;
    if (t) { c.segs.push({ id: uid(), at: Date.now(), topic, text: t, dur: Math.round((Date.now() - Dict.started) / 1000) }); c.status = c.form ? 'review' : 'draft'; touch(c); drawSegs(); syncOrg(); }
  };
  $rec.onclick = async () => {
    if (!SR) return dock.querySelector('#type').click();
    if (Dict.active) return finish();
    live = document.createElement('div');
    live.className = 'seg live';
    live.innerHTML = `<div class="meta"><b>Listening…</b>${topic ? '· ' + esc(TOPIC_EN[topic]) : ''}</div><p><span class="fin"></span> <span class="interim"></span></p>`;
    $segs.querySelector('.empty')?.remove(); $segs.append(live);
    const ok = await Dict.start((fin, interim, failed) => {
      if (!live) return;
      live.querySelector('.fin').textContent = fin; live.querySelector('.interim').textContent = interim;
      if (failed) finish();
    });
    if (!ok) return;
    $rec.classList.add('on'); $rec.setAttribute('aria-label', 'Stop recording');
    tick = setInterval(() => { $timer.textContent = mmss(Math.round((Date.now() - Dict.started) / 1000)); }, 500);
  };
  dock.querySelector('#type').onclick = () => {
    if (Dict.active) finish();
    c.segs.push({ id: uid(), at: Date.now(), topic, text: '' }); touch(c); drawSegs();
    const ts = $segs.querySelectorAll('textarea'); ts[ts.length - 1].focus();
  };
  $org.onclick = () => { if (Dict.active) finish(); runOrganize(c); };
}

async function runOrganize(c) {
  if (!c.segs.some(s => s.text.trim())) return toast('No segment has any text yet.');
  const risks = idRisks(c);
  if (risks.length && !confirm(`Possible identifying information (${risks.join('; ')}).\nClaude will replace it with [ẩn], but the text is still sent. Continue?`)) return;
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.innerHTML = `<div><div class="spin"></div><p>Claude is organising the case…<br>usually 15–60 seconds</p></div>`;
  document.body.append(busy);
  try {
    const { out, usage } = await organize(c);
    c.form = Object.fromEntries(FKEYS.map(k => [k, String(out[k] ?? '')]));
    c.meta = { can_kiem_tra: out.can_kiem_tra || [], chuan_hoa: out.chuan_hoa || [], usage, at: Date.now(), segCount: c.segs.length };
    const bx = out.benh_nen || {}, b = bnOf(c);
    if (bx.dai_thao_duong) b.dtd = true;
    if (bx.bmv_can_thiep) b.bmv = true;
    if (!b.creat && numv(bx.creatinin_umol_l) > 0) b.creat = String(numv(bx.creatinin_umol_l));
    c.bn = b;
    c.status = 'review'; touch(c);
    go(`c/${c.id}/duyet`);
  } catch (e) {
    toast(apiError(e));
  } finally { busy.remove(); }
}

// --- Duyệt ---
// --- Phân độ PAD (Fontaine / Rutherford / WIfI) — logic ở pad.js (bản chuyển từ scripts/pad/classification.py) ---
const FONT_VI = { I: 'không triệu chứng', IIa: 'đau cách hồi nhẹ, đi > 200 m', IIb: 'đau cách hồi vừa–nặng, đi ≤ 200 m', III: 'đau khi nghỉ do thiếu máu', IV: 'loét hoặc hoại tử' };
const RUTH_VI = ['không triệu chứng', 'đau cách hồi nhẹ', 'đau cách hồi vừa', 'đau cách hồi nặng', 'đau khi nghỉ do thiếu máu', 'mất mô nhỏ, dưới mức khớp cổ–bàn ngón', 'mất mô lớn, trên mức khớp cổ–bàn ngón'];
const LVL_VI = { 1: 'rất thấp', 2: 'thấp', 3: 'trung bình', 4: 'cao' };
const PAD_DEF = { side: 'phải', sym: 'none', dist: '', tread: 'na', post: '', tm: 'below', w: '1', fi: '0', abi: '', rap: '', tp: '', tc: '' };
function padForm(v) {
  const r = (n, val, l) => `<label class="pc-o"><input type="radio" name="${n}" value="${val}"${v[n] === val ? ' checked' : ''}> ${l}</label>`;
  const n = (k, l, u, step = 1) => `<label class="pc-n">${l}<input name="${k}" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(v[k])}">${u ? `<small>${u}</small>` : ''}</label>`;
  return `<form class="pc" onsubmit="return false" autocomplete="off">
    <div class="pc-g pc-in"><b>Leg</b>${r('side', 'phải', 'Right')}${r('side', 'trái', 'Left')}</div>
    <div class="pc-g pc-in"><b>Worst symptom</b>${r('sym', 'none', 'Asymptomatic')}${r('sym', 'claud', 'Claudication')}${r('sym', 'rest', 'Rest pain')}${r('sym', 'tissue', 'Ulcer / gangrene')}</div>
    <div class="pc-g" data-if="claud"><b>Claudication</b>${n('dist', 'Pain-free walking distance', 'm')}
      <span class="pc-sub">Treadmill (5 min, 12% grade, 2 mph):</span>${r('tread', 'yes', 'Completed')}${r('tread', 'no', 'Not completed')}${r('tread', 'na', 'Not done')}${n('post', 'Post-exercise ankle pressure', 'mmHg')}</div>
    <div class="pc-g" data-if="tissue"><b>Tissue loss</b>${r('tm', 'below', 'Distal to transmetatarsal level')}${r('tm', 'above', 'Proximal to TM level / foot not salvageable')}${r('tm', 'unknown', 'Unknown')}
      <span class="pc-sub">W — wound:</span>${r('w', '1', '1 · Small shallow ulcer, no exposed bone')}${r('w', '2', '2 · Deeper ulcer with exposed tendon/capsule/bone, or shallow heel ulcer')}${r('w', '3', '3 · Extensive deep forefoot ± midfoot ulcer, or deep heel ulcer')}
      <span class="pc-sub">fI — foot infection:</span>${r('fi', '0', '0 · None')}${r('fi', '1', '1 · Mild, local (erythema 0.5–2 cm)')}${r('fi', '2', '2 · Moderate (erythema > 2 cm, lymphangitis, deep abscess, gangrene)')}${r('fi', '3', '3 · Severe (≥ 2 SIRS criteria)')}</div>
    <div class="pc-g"><b>Haemodynamics</b><div class="pc-ns">${n('abi', 'ABI', '', 0.01)}${n('rap', 'Ankle pressure', 'mmHg')}${n('tp', 'Toe pressure', 'mmHg')}${n('tc', 'TcPO₂', 'mmHg')}</div></div>
  </form><div class="pc-res"></div>`;
}
function padCalc(v) {
  const num = k => { const x = parseFloat(String(v[k]).replace(',', '.')); return Number.isFinite(x) ? x : null; };
  const sym = v.sym, tissue = sym === 'tissue', rest = sym === 'rest', claud = sym === 'claud';
  const f = PAD.classifyFontaine({ abi: num('abi'), hasClaudication: claud, walkingDistanceM: num('dist'), hasRestPain: rest, hasTissueLoss: tissue });
  const ru = PAD.classifyRutherford({ hasTissueLoss: tissue, tissueLossAboveTm: tissue ? ({ above: true, below: false }[v.tm] ?? null) : null,
    hasRestPain: rest, restingApMmhg: num('rap'), toePressureMmhg: num('tp'), hasClaudication: claud,
    completesTreadmill: { yes: true, no: false }[v.tread] ?? null, postExerciseApMmhg: num('post'), restingApForClaudication: num('rap') });
  const lines = [`Fontaine ${f.stage} (${FONT_VI[f.stage]})`, `Rutherford độ ${ru.grade}, nhóm ${ru.category} (${RUTH_VI[ru.category]})`];
  const linesEn = [`Fontaine ${f.stage} — ${f.description}`, `Rutherford grade ${ru.grade}, category ${ru.category} — ${ru.description}`];
  const warns = [...f.warnings, ...ru.warnings];
  let wifi = '', ws = '';
  if (rest || tissue) {
    const m = { abi: num('abi'), anklePressureMmhg: num('rap'), toePressureMmhg: num('tp'), tcpo2Mmhg: num('tc') };
    if (Object.values(m).every(x => x == null)) wifi = 'WIfI: needs at least one perfusion measure (ABI, ankle pressure, toe pressure or TcPO₂).';
    else {
      const w = tissue ? +v.w : 0, fi = tissue ? +v.fi : 0, i = PAD.scoreWifiIschemia(m), r = PAD.classifyWifi({ w, i, fi });
      ws = ` · WIfI ${r.clinical_stage}`;
      lines.push(`WIfI W${w} I${i} fI${fi} → giai đoạn ${r.clinical_stage} (nguy cơ cắt cụt 1 năm ${LVL_VI[r.clinical_stage]}; lợi ích tái thông ${LVL_VI[r.revasc_benefit]})`);
      linesEn.push(`WIfI W${w} I${i} fI${fi} → stage ${r.clinical_stage} (${r.amp_risk_description}; ${r.revasc_benefit_description})`);
      warns.push(...r.notes);
    }
  }
  return { text: `- Phân độ (chân ${v.side}): ${lines.join('; ')}.`, lines, linesEn, wifi, warns, short: `Fontaine ${f.stage} · R${ru.category}${ws}` };
}
function padPanel(c, box, t, onInsert) {
  const v = Object.assign({}, PAD_DEF, c.pad || {});
  box.innerHTML = padForm(v) + `<div class="row"><button type="button" class="grow pc-ins">Insert into field</button><button type="button" class="ghost pc-x">Close</button></div>
    <p class="small muted" style="margin:0">Per Fontaine 1954, Rutherford 1986, WIfI (Mills 2014). Decision support only. The inserted line is in Vietnamese.</p>`;
  const fm = box.querySelector('form'), res = box.querySelector('.pc-res');
  let out;
  const upd = () => {
    new FormData(fm).forEach((x, k) => (v[k] = x));
    fm.querySelectorAll('[data-if]').forEach(g => (g.hidden = g.dataset.if !== v.sym));
    out = padCalc(v);
    res.innerHTML = `<ul>${out.linesEn.map(l => `<li>${esc(l)}</li>`).join('')}</ul>${out.wifi ? `<p class="small muted">${esc(out.wifi)}</p>` : ''}
      ${out.warns.length ? `<details><summary>Notes (${out.warns.length})</summary><ul class="small">${out.warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}`;
  };
  fm.addEventListener('input', upd); fm.addEventListener('change', upd); upd();
  box.querySelector('.pc-x').onclick = () => { c.pad = { ...v }; touch(c); box.hidden = true; };
  box.querySelector('.pc-ins').onclick = () => {
    const ls = t.value.split('\n'), i = ls.findIndex(l => /^\s*-?\s*Phân độ/i.test(l));
    if (i >= 0) ls[i] = out.text; else if (t.value.trim()) ls.push(out.text); else ls.splice(0, ls.length, out.text);
    c.pad = { ...v };
    onInsert(ls.join('\n'));
    box.hidden = true;
  };
}

function paneReview(c, $p) {
  if (!c.form) {
    $p.innerHTML = `<div class="notice">Not organised yet. Dictate segments in the <b>Record</b> tab, then tap <b>Organise</b>.</div>
      ${c.segs.length ? `<button type="button" id="org">Organise ${c.segs.length} segment${c.segs.length > 1 ? 's' : ''} into the form</button>` : ''}`;
    $p.querySelector('#org')?.addEventListener('click', () => runOrganize(c));
    return;
  }
  const m = c.meta || {}, flags = m.can_kiem_tra || [], norm = m.chuan_hoa || [];
  const nEmpty = FKEYS.filter(k => !c.form[k].trim()).length;
  const newSegs = c.segs.length - (m.segCount || 0);
  $p.innerHTML = `
    <div class="notice">${nEmpty ? `<b>${nEmpty} empty field${nEmpty > 1 ? 's' : ''}</b> (yellow) — tap 🎤 to dictate straight into a field, or type. ` : ''}${flags.length ? `<b>${flags.length} item${flags.length > 1 ? 's' : ''} to check</b> (orange). ` : ''}ICD-10 codes are suggestions only — confirm them. The summary text stays in Vietnamese.${newSegs > 0 ? ` <b>${newSegs} new segment${newSegs > 1 ? 's' : ''}</b> not organised yet.` : ''}</div>
    ${norm.length ? `<details class="norm"><summary>Normalised terms (${norm.length})</summary><ul>${norm.map(n => `<li>“${esc(n.goc)}” → <b>${esc(n.chuan)}</b></li>`).join('')}</ul></details>` : ''}
    <div class="fields">${FIELDS.map(([k, , , t, h]) => {
      const fl = flags.filter(f => f.muc === k);
      return `<div class="field${c.form[k].trim() ? '' : ' blank'}" data-k="${k}">
        <div class="fh"><b>${esc(t)}${h ? `<small>${esc(h)}</small>` : ''}</b>${k === 'mach_mau' && typeof PAD !== 'undefined' ? '<button class="padbtn" type="button">Staging</button>' : ''}${SR ? `<button class="mic" type="button" aria-label="Dictate into ${esc(t)}">🎤</button>` : ''}</div>
        <textarea aria-label="${esc(t)}" placeholder="Empty — dictate or type">${esc(c.form[k])}</textarea>
        ${k === 'mach_mau' ? '<div class="padbox" hidden></div>' : ''}
        ${fl.length ? `<div class="flags">${fl.map(f => `<div class="flag"><b>Check:</b> ${esc(f.noi_dung)} — ${esc(f.ly_do)}</div>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="row"><button type="button" id="reorg" class="grow">${newSegs > 0 ? `Organise ${newSegs} new segment${newSegs > 1 ? 's' : ''}` : 'Re-organise'}</button><button type="button" id="toexp" class="grow">View export →</button></div>
    ${m.usage ? `<p class="cost">${esc(m.usage.model)} · ${m.usage.in.toLocaleString('en-US')} + ${m.usage.out.toLocaleString('en-US')} tokens · ≈ ${Math.round(m.usage.usd * USD_VND).toLocaleString('en-US')} VND</p>` : ''}`;
  $p.querySelectorAll('.field').forEach(f => {
    const k = f.dataset.k, t = f.querySelector('textarea'), mic = f.querySelector('.mic'), pb = f.querySelector('.padbtn');
    autosize(t);
    if (pb) pb.onclick = () => {
      const box = f.querySelector('.padbox');
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false;
      padPanel(c, box, t, val => { t.value = val; c.form[k] = val; touch(c); autosize(t); f.classList.remove('blank'); toast('Staging inserted'); });
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    t.oninput = () => { autosize(t); f.classList.toggle('blank', !t.value.trim()); };
    t.onchange = () => { c.form[k] = t.value; touch(c); };
    if (mic) mic.onclick = async () => {
      if (mic.classList.contains('on')) {
        const add = Dict.stop(); mic.classList.remove('on');
        $p.querySelectorAll('.mic').forEach(x => (x.disabled = false));
        if (add) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + add; c.form[k] = t.value; touch(c); autosize(t); f.classList.remove('blank'); }
        return;
      }
      if (Dict.active) return;
      const base = t.value.trim();
      const ok = await Dict.start((fin, interim, failed) => {
        t.value = (base ? base + '\n' : '') + fin + (interim ? ' ' + interim : ''); autosize(t);
        if (failed) { mic.classList.remove('on'); $p.querySelectorAll('.mic').forEach(x => (x.disabled = false)); }
      });
      if (!ok) return;
      mic.classList.add('on');
      $p.querySelectorAll('.mic').forEach(x => (x.disabled = x !== mic));
    };
  });
  $p.querySelector('#reorg').onclick = () => {
    if (!newSegs && !confirm('Re-organise everything? Claude keeps your edits and only adds to them.')) return;
    runOrganize(c);
  };
  $p.querySelector('#toexp').onclick = () => go(`c/${c.id}/xuat`);
}

// --- Xuất ---
function asText(c) {
  // chỉ in các mục có nội dung, đánh số liên tục
  const lines = ['TÓM TẮT BỆNH ÁN', ''];
  filled(c).forEach(([t, v], i) => lines.push(`${i + 1}. ${t}: ${v.includes('\n') ? '\n' + v : v}`));
  return lines.join('\n');
}
function filled(c) { return FIELDS.map(([k, t]) => [t, (c.form?.[k] || '').trim()]).filter(([, v]) => v); }
function asDocHtml(c) {
  const body = filled(c).map(([t, v], i) => `<p><b>${i + 1}. ${esc(t)}:</b>${v.includes('\n') ? '<br>' : ' '}${esc(v).replace(/\n/g, '<br>')}</p>`).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Tóm tắt bệnh án</title><style>body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.4}h1{font-size:15pt;text-align:center}p{margin:0 0 6pt}</style></head><body><h1>TÓM TẮT BỆNH ÁN</h1>${body}</body></html>`;
}
function paneExport(c, $p) {
  if (!c.form) { $p.innerHTML = `<div class="notice">Nothing to export yet. Organise the case in the <b>Review</b> tab first.</div>`; return; }
  const flags = (c.meta?.can_kiem_tra || []).length, nEmpty = FKEYS.filter(k => !c.form[k].trim()).length;
  $p.innerHTML = `
    ${flags || nEmpty ? `<div class="notice">${nEmpty ? `<b>${nEmpty} empty field${nEmpty > 1 ? 's' : ''}</b>` : ''}${nEmpty && flags ? ' and ' : ''}${flags ? `<b>${flags} item${flags > 1 ? 's' : ''} to check</b>` : ''} left in the Review tab. The export only includes fields with content (in Vietnamese).</div>` : ''}
    <div class="preview">${esc(asText(c))}</div>
    <div class="expbtns">
      <button type="button" id="copy" class="wide">Copy all</button>
      <button type="button" id="doc">Download Word (.doc)</button>
      <button type="button" id="share">Share…</button>
      <button type="button" id="done" class="wide ghost">${c.status === 'done' ? 'Marked as exported' : 'Mark as exported'}</button>
    </div>`;
  const fname = `TTBA ${caseName(c).replace(/[\\/:*?"<>|]/g, '-')} ${new Date().toISOString().slice(0, 10)}.doc`;
  const docBlob = () => new Blob(['\ufeff', asDocHtml(c)], { type: 'application/msword' });
  $p.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(asText(c)); toast('Copied — paste into the hospital system'); }
    catch { toast('Could not copy; select and copy from the preview'); }
  };
  $p.querySelector('#doc').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(docBlob()); a.download = fname;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const $share = $p.querySelector('#share');
  const file = new File([docBlob()], fname, { type: 'application/msword' });
  if (!navigator.canShare?.({ files: [file] }) && !navigator.share) $share.disabled = true;
  $share.onclick = async () => {
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Case summary' });
      else await navigator.share({ title: 'Case summary', text: asText(c) });
    } catch (e) { if (e.name !== 'AbortError') toast('Could not share: ' + e.message); }
  };
  $p.querySelector('#done').onclick = () => { c.status = 'done'; touch(c); toast('Marked'); paneExport(c, $p); };
}

// ---------- cài đặt ----------
function renderSettings() {
  document.querySelector('.dock')?.remove();
  $app.innerHTML = `
    <button class="back" type="button" id="back">‹ Cases</button>
    <h2>Settings</h2>
    <div class="set card">
      <label>Claude API key
        <div class="row"><input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" class="grow" value="${esc(C.key)}"><button type="button" id="show" class="ghost">Show</button></div>
        <small>Create one at platform.claude.com › API keys. The key is stored only in this device's browser and is used to call Claude when you tap “Organise”. Set a spend limit on the key. Do not use it on a shared device.</small>
      </label>
      <div class="row"><button type="button" id="test">Test key</button><span id="testres" class="small muted"></span></div>
      <label>Model
        <select id="model">${MODELS.map(([id, l]) => `<option value="${id}"${id === C.model ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <small>Estimate per case (5,000 tokens in, 2,000 out): Opus ≈ 1,500 VND, Sonnet ≈ 800 VND, Haiku ≈ 40 VND.</small>
      </label>
      <label>Personal glossary
        <textarea id="gloss" rows="7" spellcheck="false">${esc(C.glossary)}</textarea>
        <small>One per line: “as heard = standard spelling”. Claude uses it to normalise terms; add words the recogniser often mishears.</small>
      </label>
      <label>Auto-delete cases after (days)
        <input id="keep" type="number" min="0" max="365" step="1" value="${C.keepDays}">
        <small>Counted from the last edit; 0 = never.</small>
      </label>
      <button type="button" id="saveset">Save settings</button>
    </div>
    <div class="set card">
      <h3 style="margin:0">OR schedule → Google Calendar</h3>
      <p class="small" style="margin:0">The <b>Update OR schedule</b> button on the case list reads schedule emails (“lịch mổ” with an .xlsx) in your Gmail, keeps the Pt tim cases and adds one all-day event per operating day to Google Calendar — the same format as the old operation-schedule GitHub Action. The spreadsheet is read in this browser only; the event has no patient names.</p>
      <label>Google OAuth Client ID
        <input id="gcid" autocomplete="off" spellcheck="false" placeholder="…apps.googleusercontent.com" value="${esc(C.gClientId)}">
      </label>
      <label>Calendar ID
        <input id="gcal" autocomplete="off" spellcheck="false" value="${esc(C.gCalendarId || 'primary')}">
        <small>“primary” = your main calendar, or the calendar ID used by the old GitHub Action (secret CALENDAR_ID).</small>
      </label>
      <label>Look back (days)
        <input id="ordays" type="number" min="1" max="30" step="1" value="${C.orDays || 2}">
      </label>
      <details class="small"><summary>One-time Google setup</summary><ol style="padding-left:18px;line-height:1.55">
        <li>console.cloud.google.com → the same project as operation-schedule (Gmail API and Calendar API already enabled).</li>
        <li>APIs &amp; Services → Credentials → Create credentials → OAuth client ID → <b>Web application</b>.</li>
        <li>Authorized JavaScript origins: <code>https://theodore-ng.github.io</code> → Create → copy the Client ID here and save.</li>
        <li>OAuth consent screen: keep the app in Testing with your Gmail as a test user. The first time, Google warns the app is unverified: tap Continue and allow Gmail + Calendar.</li>
        <li>After it works, the old GitHub Action schedule can be turned off.</li>
      </ol></details>
      <button type="button" id="saveor">Save</button>
    </div>
    <div class="card set">
      <p class="small" style="margin:0">Speech recognition: ${SR ? 'available (Vietnamese, Safari/Apple).' : 'not available in this browser — use the microphone on the iPhone keyboard.'} The first time you record, the iPhone asks for microphone and speech recognition access: tap Allow.</p>
      <button type="button" id="wipe" class="danger">Delete all cases (${S.cases.length})</button>
    </div>`;
  document.getElementById('back').onclick = () => go('');
  const $k = document.getElementById('key');
  document.getElementById('show').onclick = e => { $k.type = $k.type === 'password' ? 'text' : 'password'; e.target.textContent = $k.type === 'password' ? 'Show' : 'Hide'; };
  const collect = () => { C.key = $k.value.trim(); C.model = document.getElementById('model').value; C.glossary = document.getElementById('gloss').value; C.keepDays = Math.max(0, parseInt(document.getElementById('keep').value, 10) || 0); saveCfg(); };
  document.getElementById('saveset').onclick = () => { collect(); toast('Settings saved'); };
  document.getElementById('saveor').onclick = () => {
    C.gClientId = document.getElementById('gcid').value.trim(); C.gCalendarId = document.getElementById('gcal').value.trim() || 'primary';
    C.orDays = Math.min(30, Math.max(1, parseInt(document.getElementById('ordays').value, 10) || 2)); saveCfg(); Gtok.token = ''; toast('Saved');
  };
  document.getElementById('test').onclick = async () => {
    collect();
    const $r = document.getElementById('testres'); $r.textContent = 'Testing…';
    try { const cl = await claude(); const m = await cl.models.retrieve(C.model); $r.textContent = '✓ Key works: ' + (m.display_name || m.id); }
    catch (e) { $r.textContent = '✗ ' + apiError(e); }
  };
  document.getElementById('wipe').onclick = () => {
    if (!S.cases.length || !confirm(`Permanently delete ${S.cases.length} case${S.cases.length > 1 ? 's' : ''}${Sync.user ? ' (on this device and on Supabase)' : ' on this device'}?`)) return;
    S.cases.map(c => c.id).forEach(forget); toast('All cases deleted'); renderSettings();
  };
}

expired();
route();
Sync.init().then(() => { if (Sync.state !== 'off') quietRoute(); });
})();
