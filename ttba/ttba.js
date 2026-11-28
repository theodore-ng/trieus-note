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
  ['claude-opus-5-5', 'Claude Opus 5.5 — chính xác nhất (mặc định)', 4, 20],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — nhanh, rẻ hơn', 2, 10],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — rẻ nhất', 0.1, 0.5],
];
const USD_VND = 26000; // chỉ để ước tính chi phí hiển thị

// Mẫu chung: các mục tóm tắt bệnh án (ẩn danh) + chỉ số mạch máu
const FIELDS = [
  ['nguoi_benh', 'Người bệnh (ẩn danh)', 'Giới, tuổi, khoa/giường; không ghi họ tên, số hồ sơ'],
  ['ngay_vao_vien', 'Ngày vào viện', ''],
  ['ly_do', 'Lý do vào viện', ''],
  ['benh_su', 'Bệnh sử', 'Quá trình bệnh lý và diễn biến lâm sàng'],
  ['tien_su', 'Tiền sử', 'Bản thân, gia đình, dị ứng, thuốc đang dùng'],
  ['kham', 'Khám lâm sàng', 'Những dấu hiệu lâm sàng chính'],
  ['mach_mau', 'Chỉ số mạch máu', 'ABI/TBI, siêu âm Doppler, phân độ Rutherford / Fontaine / WIfI, CEAP'],
  ['cls', 'Cận lâm sàng', 'Kết quả xét nghiệm, chẩn đoán hình ảnh có giá trị chẩn đoán'],
  ['cd_vao', 'Chẩn đoán vào viện', 'Kèm mã ICD-10 (gợi ý, cần xác nhận)'],
  ['cd_hien_tai', 'Chẩn đoán xác định / ra viện', 'Bệnh chính, bệnh kèm, mã ICD-10 (gợi ý, cần xác nhận)'],
  ['dieu_tri', 'Phương pháp điều trị', 'Thuốc, phẫu thuật / thủ thuật đã làm'],
  ['tinh_trang', 'Tình trạng người bệnh', 'Hiện tại hoặc lúc ra viện'],
  ['huong_tiep', 'Hướng điều trị và chế độ tiếp theo', ''],
];
const FKEYS = FIELDS.map(f => f[0]);
const TOPICS = [['', 'Tự do'], ['benh_su', 'Bệnh sử'], ['tien_su', 'Tiền sử'], ['kham', 'Khám'], ['mach_mau', 'Mạch máu'], ['cls', 'CLS'], ['cd', 'Chẩn đoán'], ['dieu_tri', 'Điều trị'], ['ra_vien', 'Ra viện']];
const TOPIC_NAME = Object.fromEntries(TOPICS);
const DEFAULT_GLOSSARY = `# Mỗi dòng: cách đọc = cách viết chuẩn (bỏ dòng bắt đầu bằng #)
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
  },
  required: [...FKEYS, 'can_kiem_tra', 'chuan_hoa'],
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
- Ẩn danh: không ghi họ tên, số điện thoại, số căn cước, số hồ sơ, địa chỉ chi tiết; nếu đoạn đọc có thì thay bằng [ẩn]. Mục "nguoi_benh" chỉ gồm giới, tuổi, khoa/giường nếu có.
- "mach_mau": gom chỉ số ABI/TBI hai bên, kết quả Doppler, phân độ (Rutherford, Fontaine, WIfI, CEAP) nếu được nói tới; không tự phân độ khi bác sĩ không nói.
- Nếu có "bản hiện tại": đó là bản bác sĩ đã duyệt/sửa — giữ nguyên nội dung đó, chỉ bổ sung hoặc sửa theo đoạn đọc mới.
- Viết từng mục thành câu/gạch đầu dòng ngắn, mỗi ý một dòng (dùng "- " đầu dòng khi liệt kê).`;

// ---------- lưu trữ ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Không lưu được: bộ nhớ trình duyệt đầy hoặc bị chặn'); } Sync.soon(); };
const saveCfg = () => { try { localStorage.setItem(CFG, JSON.stringify(C)); } catch {} };
const S = load(KEY, { cases: [] });
const C = Object.assign({ key: '', model: MODELS[0][0], glossary: DEFAULT_GLOSSARY, keepDays: 30 }, load(CFG, {}));
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
  const t = { off: 'Ca chỉ lưu trên máy này', login: 'Ca chỉ lưu trên máy này — <a href="../">đăng nhập Trieu&#39;s Note</a> để đồng bộ', on: '✓ Đồng bộ Supabase (tài khoản Trieu&#39;s Note)', err: '⚠ Chưa đồng bộ được: ' + esc(Sync.err) + ' — vẫn lưu trên máy, sẽ thử lại' }[Sync.state];
  return `<span id="syncst">${t}</span>`;
}

// ---------- tiện ích ----------
const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtTime = t => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
let toastT;
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
const caseById = id => S.cases.find(c => c.id === id);
const touch = c => { c.updated = Date.now(); save(); };
const STATUS = { draft: 'Đang ghi', review: 'Chờ duyệt', done: 'Đã xuất' };
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
      const msg = { 'not-allowed': 'Chưa cho phép micro / nhận dạng giọng nói (Cài đặt › Safari › Micro).', 'service-not-allowed': 'iPhone chưa bật nhận dạng giọng nói (Cài đặt › Siri / Đọc chính tả).', network: 'Mất mạng khi nhận dạng giọng nói.', 'language-not-supported': 'Máy chưa hỗ trợ nhận dạng tiếng Việt.' }[e.error] || 'Lỗi nhận dạng giọng nói: ' + e.error;
      toast(msg); this.onUpdate?.(this.finalText, '', true);
    };
    // iOS hay tự dừng sau khoảng lặng: tự bật lại khi người dùng chưa bấm dừng
    r.onend = () => { if (this.active) { try { r.start(); } catch { this._run(); } } };
    this.rec = r;
    try { r.start(); } catch (err) { this.active = false; toast('Không bật được micro: ' + err.message); }
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
  if (!C.key) throw Object.assign(new Error('Chưa có khóa API Claude. Vào Cài đặt để dán khóa.'), { code: 'nokey' });
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
  return (g ? `Từ điển cá nhân của bác sĩ (cách đọc = cách viết):\n${g}\n\n` : '')
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
  if (res.stop_reason === 'refusal') throw new Error('Claude từ chối xử lý nội dung này' + (res.stop_details?.explanation ? ': ' + res.stop_details.explanation : '.'));
  if (res.stop_reason === 'max_tokens') throw new Error('Kết quả quá dài, bị cắt. Thử chia ca thành ít đoạn hơn.');
  const txt = (res.content || []).find(b => b.type === 'text')?.text;
  if (!txt) throw new Error('Claude không trả về nội dung.');
  const out = JSON.parse(txt);
  const m = MODELS.find(x => x[0] === C.model) || MODELS[0], u = res.usage || {};
  const usd = ((u.input_tokens || 0) * m[2] + (u.output_tokens || 0) * m[3]) / 1e6;
  return { out, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, usd, model: res.model || C.model } };
}
function apiError(e) {
  const st = e?.status;
  if (e?.code === 'nokey') return e.message;
  if (st === 401) return 'Khóa API không đúng hoặc đã bị thu hồi (Cài đặt).';
  if (st === 403) return 'Khóa API không có quyền dùng model này.';
  if (st === 404) return 'Không tìm thấy model — chọn model khác trong Cài đặt.';
  if (st === 429) return 'Quá giới hạn tốc độ hoặc hết hạn mức chi tiêu. Thử lại sau ít phút.';
  if (st === 529 || st >= 500) return 'Máy chủ Claude đang quá tải. Thử lại sau.';
  if (e instanceof SyntaxError) return 'Kết quả trả về không đúng định dạng. Thử lại.';
  if (!navigator.onLine) return 'Không có mạng.';
  return e?.message || String(e);
}

// ---------- kiểm tra thông tin định danh trước khi gửi ----------
function idRisks(c) {
  const txt = c.segs.map(s => s.text).join('\n'), hits = [];
  if (/(họ tên|họ và tên|tên là|tên bệnh nhân|bệnh nhân tên)/i.test(txt)) hits.push('có nhắc tên người bệnh');
  if (/(?<!\d)(0\d{9}|\d{12})(?!\d)/.test(txt.replace(/[\s.]/g, ''))) hits.push('có dãy số giống số điện thoại / căn cước');
  if (/(số hồ sơ|mã bệnh án|mã y tế|số vào viện|số căn cước|cccd)/i.test(txt)) hits.push('có nhắc số hồ sơ / căn cước');
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
  const m = h.match(/^c\/([^/]+)(?:\/(ghi|duyet|xuat))?$/);
  if (m && caseById(m[1])) return renderCase(caseById(m[1]), m[2] || (caseById(m[1]).form ? 'duyet' : 'ghi'));
  renderList();
}
window.addEventListener('hashchange', route);
const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };

// Ca mẫu (bệnh nhân giả, đã sắp xếp sẵn) để xem giao diện — không gọi API
function demoCase() {
  const t = Date.now(), seg = (topic, text, dur, ago) => ({ id: uid(), at: t - ago * 60000, topic, text, dur });
  return {
    id: uid(), label: 'Ca mẫu · Giường 12 · Nam 68t', created: t, updated: t, status: 'review', demo: true,
    segs: [
      seg('', 'bệnh nhân nam 68 tuổi giường 12 khoa phẫu thuật mạch máu vào viện ngày 20 tháng 11 vì đau nhức bàn chân phải và vết loét ngón 1 chân phải', 18, 30),
      seg('benh_su', 'khoảng 6 tháng nay đau cách hồi bắp chân phải đi khoảng 100 mét phải nghỉ 2 tuần nay đau cả khi nghỉ về đêm loét đầu ngón 1 chân phải không lành', 22, 28),
      seg('tien_su', 'tăng huyết áp 10 năm đái tháo đường típ 2 8 năm đang dùng metformin 850 mi li gam ngày 2 lần hút thuốc lá 30 gói năm không dị ứng thuốc', 20, 26),
      seg('kham', 'chân phải lạnh hơn chân trái mạch khoeo phải bắt yếu mạch mu chân và chày sau phải không bắt được loét ngón 1 kích thước 1 x 1 cm đáy nhợt không có mủ', 21, 24),
      seg('mach_mau', 'a bê i phải 0,45 trái 0,9 siêu âm đốp lơ hẹp tắc động mạch đùi nông phải đoạn giữa dài khoảng 12 cm dòng chảy sau tắc dạng đơn pha', 19, 22),
      seg('cls', 'glucose 9,8 hba1c 8,2 phần trăm creatinin 98 cholesterol LDL 3,4', 12, 20),
      seg('dieu_tri', 'đã can thiệp nong bóng đặt stent động mạch đùi nông phải ngày 22 tháng 11 dùng aspirin 81 clopidogrel 75 atorvastatin 40 thay băng vết loét hằng ngày', 23, 10),
    ],
    form: {
      nguoi_benh: 'Nam, 68 tuổi, Khoa Phẫu thuật mạch máu, giường 12.',
      ngay_vao_vien: '20/11',
      ly_do: 'Đau nhức bàn chân phải, loét ngón I chân phải.',
      benh_su: 'Khoảng 6 tháng nay đau cách hồi bắp chân phải, quãng đường đi bộ khoảng 100 m. 2 tuần nay đau cả khi nghỉ, tăng về đêm; xuất hiện vết loét đầu ngón I chân phải không lành.',
      tien_su: '- Tăng huyết áp 10 năm.\n- Đái tháo đường típ 2, 8 năm, đang dùng metformin 850 mg × 2 lần/ngày.\n- Hút thuốc lá 30 gói-năm.\n- Không ghi nhận dị ứng thuốc.',
      kham: 'Chân phải lạnh hơn chân trái. Mạch khoeo phải bắt yếu; mạch mu chân và chày sau phải không bắt được. Loét đầu ngón I chân phải kích thước 1 × 1 cm, đáy nhợt, không có mủ.',
      mach_mau: '- ABI: phải 0,45; trái 0,90.\n- Siêu âm Doppler: hẹp tắc động mạch đùi nông phải đoạn giữa, dài khoảng 12 cm; dòng chảy sau chỗ tắc dạng đơn pha.\n- Phân độ: Rutherford 5, Fontaine IV.',
      cls: 'Glucose 9,8 mmol/L; HbA1c 8,2 %; creatinin 98 µmol/L; LDL-cholesterol 3,4 mmol/L.',
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
        { muc: 'cls', noi_dung: 'creatinin 98 µmol/L', ly_do: 'Không đọc đơn vị; ghi theo đơn vị thường dùng.' },
      ],
      chuan_hoa: [
        { goc: 'a bê i', chuan: 'ABI' }, { goc: 'đốp lơ', chuan: 'Doppler' }, { goc: 'mi li gam', chuan: 'mg' },
        { goc: 'hba1c', chuan: 'HbA1c' }, { goc: 'ngón 1', chuan: 'ngón I' },
      ],
      usage: { in: 3120, out: 1450, usd: 0.0415, model: 'ca mẫu (không gọi API)' }, at: t, segCount: 7,
    },
  };
}

// ---------- danh sách ca ----------
function renderList() {
  const cs = [...S.cases].sort((a, b) => b.updated - a.updated);
  $app.innerHTML = `
    ${!C.key ? `<div class="notice"><b>Bắt đầu:</b> vào <a href="#cai-dat">Cài đặt</a> dán khóa API Claude (chỉ lưu trên máy này). Ghi âm vẫn dùng được khi chưa có khóa.</div>` : ''}
    <button class="newcase" type="button" id="new">+ Ca mới</button>
    <div class="cases">${cs.map(c => `<button class="case" type="button" data-id="${c.id}"><b>${esc(c.label)}</b><span>${fmtTime(c.updated)} · ${c.segs.length} đoạn</span><i><span class="st ${c.status}">${STATUS[c.status]}</span></i></button>`).join('') || '<p class="empty">Chưa có ca nào.</p>'}</div>
    <button class="ghost demo" type="button" id="demo">Xem ca mẫu (bệnh nhân giả)</button>
    <p class="muted small">${syncLine()}${C.keepDays > 0 ? `, tự xóa sau ${C.keepDays} ngày không sửa` : ''}. Khi ghi, không đọc họ tên, số điện thoại, số hồ sơ của người bệnh.</p>`;
  document.getElementById('new').onclick = () => {
    const label = prompt('Tên ca (ẩn danh, vd: Giường 12 · Nam 68t):', '');
    if (label === null) return;
    const c = { id: uid(), label: label.trim() || 'Ca ' + fmtTime(Date.now()), created: Date.now(), updated: Date.now(), status: 'draft', segs: [], form: null, meta: null };
    S.cases.push(c); save(); go('c/' + c.id + '/ghi');
  };
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
      <div class="row"><button class="back" type="button" id="back">‹ Danh sách ca</button><button class="back delcase" type="button" id="delcase">Xóa ca</button></div>
      <input id="label" value="${esc(c.label)}" aria-label="Tên ca">
      <div class="tabs" role="tablist">${[['ghi', 'Ghi'], ['duyet', 'Duyệt'], ['xuat', 'Xuất']].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    </div>
    <div id="pane" style="display:grid;gap:12px"></div>`;
  document.getElementById('back').onclick = () => go('');
  document.getElementById('delcase').onclick = () => { if (confirm(`Xóa vĩnh viễn ca "${c.label}"${c._s ? ' (cả trên Supabase)' : ''}?`)) { forget(c.id); go(''); } };
  const $l = document.getElementById('label');
  $l.onchange = () => { c.label = $l.value.trim() || c.label; touch(c); };
  $app.querySelectorAll('.tabs [data-t]').forEach(b => (b.onclick = () => go(`c/${c.id}/${b.dataset.t}`)));
  document.querySelector('.dock')?.remove();
  ({ ghi: paneRecord, duyet: paneReview, xuat: paneExport })[tab](c, document.getElementById('pane'));
}

// --- Ghi ---
function paneRecord(c, $p) {
  let topic = '';
  $p.innerHTML = `
    <div class="topics" role="group" aria-label="Chủ đề đoạn sắp ghi">${TOPICS.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === topic}">${l}</button>`).join('')}</div>
    ${SR ? '' : `<div class="notice">Trình duyệt này không có nhận dạng giọng nói. Bấm <b>Gõ tay</b> rồi chạm biểu tượng <b>micro trên bàn phím iPhone</b> để đọc.</div>`}
    <div class="segs" id="segs"></div>`;
  const $segs = $p.querySelector('#segs');
  const syncOrg = () => { const b = document.getElementById('org'); if (b) b.disabled = !c.segs.some(s => s.text.trim()); };
  $p.querySelectorAll('.topics button').forEach(b => (b.onclick = () => { topic = b.dataset.k; $p.querySelectorAll('.topics button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
  const drawSegs = () => {
    $segs.innerHTML = c.segs.map((s, i) => `<div class="seg" data-i="${i}"><div class="meta"><b>Đoạn ${i + 1}</b>${s.topic ? '· ' + esc(TOPIC_NAME[s.topic]) : ''}${s.dur ? ' · ' + mmss(s.dur) : ''}<button class="ghost" type="button" data-del="${i}">Xóa</button></div><textarea aria-label="Nội dung đoạn ${i + 1}">${esc(s.text)}</textarea></div>`).join('')
      || '<p class="empty">Chọn chủ đề (không bắt buộc) rồi bấm nút đỏ để đọc. Đọc từng đoạn, không cần theo thứ tự bệnh án.</p>';
    $segs.querySelectorAll('textarea').forEach(t => { autosize(t); t.oninput = () => autosize(t); t.onchange = () => { c.segs[+t.closest('.seg').dataset.i].text = t.value; touch(c); syncOrg(); }; });
    $segs.querySelectorAll('[data-del]').forEach(b => (b.onclick = () => { if (confirm('Xóa đoạn này?')) { c.segs.splice(+b.dataset.del, 1); touch(c); drawSegs(); syncOrg(); } }));
  };
  drawSegs();

  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.innerHTML = `<div class="in"><button class="side" type="button" id="type">Gõ tay</button><div><button class="rec" type="button" id="rec" aria-label="Bắt đầu ghi"></button><div class="timer" id="timer"></div></div><button class="side" type="button" id="org" ${c.segs.some(s => s.text.trim()) ? '' : 'disabled'}>Sắp xếp →</button></div>`;
  document.body.append(dock);
  const $rec = dock.querySelector('#rec'), $timer = dock.querySelector('#timer'), $org = dock.querySelector('#org');
  let live = null, tick = null;
  const finish = () => {
    const t = Dict.stop();
    clearInterval(tick); $rec.classList.remove('on'); $rec.setAttribute('aria-label', 'Bắt đầu ghi'); $timer.textContent = '';
    live?.remove(); live = null;
    if (t) { c.segs.push({ id: uid(), at: Date.now(), topic, text: t, dur: Math.round((Date.now() - Dict.started) / 1000) }); c.status = c.form ? 'review' : 'draft'; touch(c); drawSegs(); syncOrg(); }
  };
  $rec.onclick = async () => {
    if (!SR) return dock.querySelector('#type').click();
    if (Dict.active) return finish();
    live = document.createElement('div');
    live.className = 'seg live';
    live.innerHTML = `<div class="meta"><b>Đang nghe…</b>${topic ? '· ' + esc(TOPIC_NAME[topic]) : ''}</div><p><span class="fin"></span> <span class="interim"></span></p>`;
    $segs.querySelector('.empty')?.remove(); $segs.append(live);
    const ok = await Dict.start((fin, interim, failed) => {
      if (!live) return;
      live.querySelector('.fin').textContent = fin; live.querySelector('.interim').textContent = interim;
      if (failed) finish();
    });
    if (!ok) return;
    $rec.classList.add('on'); $rec.setAttribute('aria-label', 'Dừng ghi');
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
  if (!c.segs.some(s => s.text.trim())) return toast('Chưa có đoạn nào có nội dung.');
  const risks = idRisks(c);
  if (risks.length && !confirm(`Có thể có thông tin định danh (${risks.join('; ')}).\nClaude sẽ thay bằng [ẩn], nhưng nội dung vẫn được gửi đi. Tiếp tục?`)) return;
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.innerHTML = `<div><div class="spin"></div><p>Claude đang sắp xếp vào mẫu…<br>thường 15–60 giây</p></div>`;
  document.body.append(busy);
  try {
    const { out, usage } = await organize(c);
    c.form = Object.fromEntries(FKEYS.map(k => [k, String(out[k] ?? '')]));
    c.meta = { can_kiem_tra: out.can_kiem_tra || [], chuan_hoa: out.chuan_hoa || [], usage, at: Date.now(), segCount: c.segs.length };
    c.status = 'review'; touch(c);
    go(`c/${c.id}/duyet`);
  } catch (e) {
    toast(apiError(e));
  } finally { busy.remove(); }
}

// --- Duyệt ---
function paneReview(c, $p) {
  if (!c.form) {
    $p.innerHTML = `<div class="notice">Chưa sắp xếp vào mẫu. Ghi các đoạn ở tab <b>Ghi</b> rồi bấm <b>Sắp xếp</b>.</div>
      ${c.segs.length ? `<button type="button" id="org">Sắp xếp ${c.segs.length} đoạn vào mẫu</button>` : ''}`;
    $p.querySelector('#org')?.addEventListener('click', () => runOrganize(c));
    return;
  }
  const m = c.meta || {}, flags = m.can_kiem_tra || [], norm = m.chuan_hoa || [];
  const nEmpty = FKEYS.filter(k => !c.form[k].trim()).length;
  const newSegs = c.segs.length - (m.segCount || 0);
  $p.innerHTML = `
    <div class="notice">${nEmpty ? `<b>${nEmpty} mục còn trống</b> (nền vàng) — chạm 🎤 để nói thẳng vào mục, hoặc gõ. ` : ''}${flags.length ? `<b>${flags.length} chỗ cần kiểm tra</b> (cam). ` : ''}Mã ICD-10 chỉ là gợi ý, cần bác sĩ xác nhận.${newSegs > 0 ? ` <b>${newSegs} đoạn mới</b> chưa sắp xếp.` : ''}</div>
    ${norm.length ? `<details class="norm"><summary>Thuật ngữ đã chuẩn hóa (${norm.length})</summary><ul>${norm.map(n => `<li>“${esc(n.goc)}” → <b>${esc(n.chuan)}</b></li>`).join('')}</ul></details>` : ''}
    <div class="fields">${FIELDS.map(([k, t, h]) => {
      const fl = flags.filter(f => f.muc === k);
      return `<div class="field${c.form[k].trim() ? '' : ' blank'}" data-k="${k}">
        <div class="fh"><b>${esc(t)}${h ? `<small>${esc(h)}</small>` : ''}</b>${SR ? `<button class="mic" type="button" aria-label="Đọc vào mục ${esc(t)}">🎤</button>` : ''}</div>
        <textarea aria-label="${esc(t)}" placeholder="Trống — nói hoặc gõ thêm">${esc(c.form[k])}</textarea>
        ${fl.length ? `<div class="flags">${fl.map(f => `<div class="flag"><b>Kiểm tra:</b> ${esc(f.noi_dung)} — ${esc(f.ly_do)}</div>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="row"><button type="button" id="reorg" class="grow">${newSegs > 0 ? `Sắp xếp thêm ${newSegs} đoạn mới` : 'Sắp xếp lại'}</button><button type="button" id="toexp" class="grow">Xem bản xuất →</button></div>
    ${m.usage ? `<p class="cost">${esc(m.usage.model)} · ${m.usage.in.toLocaleString('vi-VN')} + ${m.usage.out.toLocaleString('vi-VN')} token · ~${Math.round(m.usage.usd * USD_VND).toLocaleString('vi-VN')} đ</p>` : ''}`;
  $p.querySelectorAll('.field').forEach(f => {
    const k = f.dataset.k, t = f.querySelector('textarea'), mic = f.querySelector('.mic');
    autosize(t);
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
    if (!newSegs && !confirm('Sắp xếp lại toàn bộ? Claude giữ phần bạn đã sửa và chỉ bổ sung.')) return;
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
  if (!c.form) { $p.innerHTML = `<div class="notice">Chưa có bản để xuất. Sắp xếp vào mẫu ở tab <b>Duyệt</b> trước.</div>`; return; }
  const flags = (c.meta?.can_kiem_tra || []).length, nEmpty = FKEYS.filter(k => !c.form[k].trim()).length;
  $p.innerHTML = `
    ${flags || nEmpty ? `<div class="notice">Còn ${nEmpty ? `<b>${nEmpty} mục trống</b>` : ''}${nEmpty && flags ? ' và ' : ''}${flags ? `<b>${flags} chỗ cần kiểm tra</b>` : ''} ở tab Duyệt. Bản xuất chỉ gồm các mục có nội dung.</div>` : ''}
    <div class="preview">${esc(asText(c))}</div>
    <div class="expbtns">
      <button type="button" id="copy" class="wide">Chép toàn bộ</button>
      <button type="button" id="doc">Tải Word (.doc)</button>
      <button type="button" id="share">Chia sẻ…</button>
      <button type="button" id="done" class="wide ghost">${c.status === 'done' ? 'Đã đánh dấu xuất' : 'Đánh dấu đã xuất'}</button>
    </div>`;
  const fname = `TTBA ${c.label.replace(/[\\/:*?"<>|]/g, '-')} ${new Date().toISOString().slice(0, 10)}.doc`;
  const docBlob = () => new Blob(['\ufeff', asDocHtml(c)], { type: 'application/msword' });
  $p.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(asText(c)); toast('Đã chép — dán vào phần mềm bệnh viện'); }
    catch { toast('Không chép được, hãy chọn và chép trong khung xem trước'); }
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
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Tóm tắt bệnh án' });
      else await navigator.share({ title: 'Tóm tắt bệnh án', text: asText(c) });
    } catch (e) { if (e.name !== 'AbortError') toast('Không chia sẻ được: ' + e.message); }
  };
  $p.querySelector('#done').onclick = () => { c.status = 'done'; touch(c); toast('Đã đánh dấu'); paneExport(c, $p); };
}

// ---------- cài đặt ----------
function renderSettings() {
  document.querySelector('.dock')?.remove();
  $app.innerHTML = `
    <button class="back" type="button" id="back">‹ Danh sách ca</button>
    <h2>Cài đặt</h2>
    <div class="set card">
      <label>Khóa API Claude
        <div class="row"><input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" class="grow" value="${esc(C.key)}"><button type="button" id="show" class="ghost">Hiện</button></div>
        <small>Tạo ở platform.claude.com › API keys. Khóa chỉ lưu trong trình duyệt của máy này, dùng để gọi Claude khi bấm “Sắp xếp”. Nên đặt hạn mức chi tiêu cho khóa. Không dùng khóa này trên máy dùng chung.</small>
      </label>
      <div class="row"><button type="button" id="test">Kiểm tra khóa</button><span id="testres" class="small muted"></span></div>
      <label>Model
        <select id="model">${MODELS.map(([id, l]) => `<option value="${id}"${id === C.model ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <small>Ước tính mỗi ca (5.000 token vào, 2.000 ra): Opus ~1.500 đ, Sonnet ~800 đ, Haiku ~40 đ.</small>
      </label>
      <label>Từ điển cá nhân
        <textarea id="gloss" rows="7" spellcheck="false">${esc(C.glossary)}</textarea>
        <small>Mỗi dòng “cách đọc = cách viết chuẩn”. Claude dùng khi chuẩn hóa thuật ngữ; thêm các từ máy hay nghe sai.</small>
      </label>
      <label>Tự xóa ca sau (ngày)
        <input id="keep" type="number" min="0" max="365" step="1" value="${C.keepDays}">
        <small>Tính từ lần sửa cuối; 0 = không tự xóa.</small>
      </label>
      <button type="button" id="saveset">Lưu cài đặt</button>
    </div>
    <div class="card set">
      <p class="small" style="margin:0">Nhận dạng giọng nói: ${SR ? 'có (tiếng Việt, của Safari/Apple).' : 'trình duyệt này không có — dùng micro trên bàn phím iPhone.'} Lần đầu bấm ghi, iPhone hỏi quyền micro và nhận dạng giọng nói: chọn Cho phép.</p>
      <button type="button" id="wipe" class="danger">Xóa tất cả ca (${S.cases.length})</button>
    </div>`;
  document.getElementById('back').onclick = () => go('');
  const $k = document.getElementById('key');
  document.getElementById('show').onclick = e => { $k.type = $k.type === 'password' ? 'text' : 'password'; e.target.textContent = $k.type === 'password' ? 'Hiện' : 'Ẩn'; };
  const collect = () => { C.key = $k.value.trim(); C.model = document.getElementById('model').value; C.glossary = document.getElementById('gloss').value; C.keepDays = Math.max(0, parseInt(document.getElementById('keep').value, 10) || 0); saveCfg(); };
  document.getElementById('saveset').onclick = () => { collect(); toast('Đã lưu cài đặt'); };
  document.getElementById('test').onclick = async () => {
    collect();
    const $r = document.getElementById('testres'); $r.textContent = 'Đang kiểm tra…';
    try { const cl = await claude(); const m = await cl.models.retrieve(C.model); $r.textContent = '✓ Khóa dùng được: ' + (m.display_name || m.id); }
    catch (e) { $r.textContent = '✗ ' + apiError(e); }
  };
  document.getElementById('wipe').onclick = () => {
    if (!S.cases.length || !confirm(`Xóa vĩnh viễn ${S.cases.length} ca${Sync.user ? ' (trên máy này và trên Supabase)' : ' trên máy này'}?`)) return;
    S.cases.map(c => c.id).forEach(forget); toast('Đã xóa tất cả ca'); renderSettings();
  };
}

expired();
route();
Sync.init().then(() => { if (Sync.state !== 'off') quietRoute(); });
})();
