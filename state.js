// PediCare Office — Shared State & UI Helpers

export const state = {
  session: null,
  profile: null, // { id, email, full_name, role, phone, is_active }
  role: 'login', // 'login' | 'guardian' | 'doctor' | 'nurse' | 'admin'
  page: 'dashboard',
  loading: false,

  // Data caches loaded from Supabase for current user session
  patients: [],
  guardians: [],
  doctors: [],
  nurses: [],
  admins: [],
  profiles: [],
  appointments: [],
  medicalRecords: [],
  examinations: [],
  vitalSigns: [],
  prescriptions: [],
  visitSummaries: [],
  growthRecords: [],
  messages: [],
  nurseTasks: [],
  auditLogs: [],

  // Active selections & filters
  selectedPatientId: null,
  searchQuery: '',
  filterStatus: 'all',
  filterRole: 'all',
  currentPage: 1,
  pageSize: 6,
};

export function $(selector) {
  return document.querySelector(selector);
}

export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(dateStr) {
  if (!dateStr) return 'Oct 12';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculateAge(dobStr) {
  if (!dobStr) return '6 Years';
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return '6 Years';
  const diffMs = Date.now() - dob.getTime();
  const years = Math.max(0, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000)));
  if (years === 0) {
    const months = Math.max(1, Math.floor(diffMs / (30.44 * 24 * 3600 * 1000)));
    return `${months} Months`;
  }
  return `${years} Year${years === 1 ? '' : 's'}`;
}

export function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (isError) {
    el.style.background = '#b42318';
  }
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 3400);
}

export function closeModal() {
  const root = $('#modalRoot');
  if (root) root.innerHTML = '';
}

/**
 * Renders a customizable modal dialog matching the original PediCare Office styling.
 * @param {object} config
 * @param {string} config.title
 * @param {string} config.description
 * @param {Array<{name: string, label: string, type?: string, value?: string, placeholder?: string, required?: boolean, options?: Array<{value: string, label: string}>}>} config.fields
 * @param {string} [config.submitLabel]
 * @param {(values: Record<string, string>) => Promise<void>|void} config.onSubmit
 */
export function showFormModal({ title, description, fields = [], submitLabel = 'Save', onSubmit }) {
  const root = $('#modalRoot');
  if (!root) return;

  const fieldsHtml = fields
    .map((f) => {
      const val = f.value !== undefined && f.value !== null ? escapeHtml(f.value) : '';
      const req = f.required !== false ? 'required' : '';
      const placeholder = escapeHtml(f.placeholder || `Enter ${f.label.toLowerCase()}`);

      if (f.type === 'select') {
        const opts = (f.options || [])
          .map(
            (o) =>
              `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
          )
          .join('');
        return `<div class="field"><label>${escapeHtml(f.label)}</label><select name="${escapeHtml(f.name)}" ${req}>${opts}</select></div>`;
      }

      if (f.type === 'textarea') {
        return `<div class="field"><label>${escapeHtml(f.label)}</label><textarea name="${escapeHtml(f.name)}" placeholder="${placeholder}" ${req}>${val}</textarea></div>`;
      }

      if (f.type === 'readonly') {
        return `<div class="field"><label>${escapeHtml(f.label)}</label><div style="padding:11px 13px;background:#f4f7fc;border:1px solid #e1e6f0;border-radius:7px;font-size:13px;color:#27364f;line-height:1.5">${val}</div></div>`;
      }

      const inputType = f.type || 'text';
      return `<div class="field"><label>${escapeHtml(f.label)}</label><input name="${escapeHtml(f.name)}" type="${escapeHtml(inputType)}" value="${val}" placeholder="${placeholder}" step="${f.step || 'any'}" ${req}></div>`;
    })
    .join('');

  root.innerHTML = `
    <div class="modal-back" id="modalBackdrop">
      <section class="modal" style="max-height:90vh;overflow-y:auto">
        <div class="row">
          <h2>${escapeHtml(title)}</h2>
          <button type="button" id="modalCloseBtn">✕</button>
        </div>
        <p style="color:#68758a;font-size:14px;line-height:1.6;margin-top:6px">${escapeHtml(description)}</p>
        <form id="dynamicModalForm">
          ${fieldsHtml}
          <div class="actions" style="justify-content:flex-end;margin-top:18px">
            <button type="button" id="modalCancelBtn">Cancel</button>
            <button type="submit" class="primary" id="modalSubmitBtn">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </section>
    </div>
  `;

  $('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  $('#modalCloseBtn').addEventListener('click', closeModal);
  $('#modalCancelBtn').addEventListener('click', closeModal);

  const form = $('#dynamicModalForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#modalSubmitBtn');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const formData = new FormData(form);
    const values = {};
    for (const [k, v] of formData.entries()) {
      values[k] = typeof v === 'string' ? v.trim() : v;
    }

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
      closeModal();
    } catch (err) {
      toast(err?.message || 'Operation failed.', true);
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}
