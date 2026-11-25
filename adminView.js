// PediCare Office — Admin Dashboard (5th Role) & Clinic Operations Management

import {
  state,
  $,
  escapeHtml,
  formatDate,
  formatDateTime,
  calculateAge,
  showFormModal,
  toast,
} from '../state.js';
import {
  callClinicEdgeFunction,
  createAppointment,
  updateAppointmentStatus,
  loadDashboardData,
} from '../api.js';
import { supabase } from '../supabaseClient.js';

function renderPaginationControls(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (totalPages <= 1) return '';

  return `
    <div class="row" style="margin-top:14px;padding-top:10px;border-top:1px solid #e9edf3">
      <small style="color:#5e6b80">Showing page ${state.currentPage} of ${totalPages} (${totalItems} total records)</small>
      <div class="actions">
        <button style="padding:6px 12px" ${state.currentPage <= 1 ? 'disabled' : ''} onclick="window.pedicare.setPage(${state.currentPage - 1})">← Previous</button>
        <button style="padding:6px 12px" ${state.currentPage >= totalPages ? 'disabled' : ''} onclick="window.pedicare.setPage(${state.currentPage + 1})">Next →</button>
      </div>
    </div>
  `;
}

function paginate(items) {
  const start = (state.currentPage - 1) * state.pageSize;
  return items.slice(start, start + state.pageSize);
}

export function renderAdminDashboardContent() {
  if (state.page === 'patients') return renderAdminPatientsSubpage();
  if (state.page === 'doctors') return renderAdminDoctorsSubpage();
  if (state.page === 'nurses') return renderAdminNursesSubpage();
  if (state.page === 'guardians') return renderAdminGuardiansSubpage();
  if (state.page === 'appointments') return renderAdminAppointmentsSubpage();
  if (state.page === 'roles-permissions') return renderAdminRolesSubpage();
  if (state.page === 'audit-logs') return renderAdminAuditLogsSubpage();

  const activeStaffCount = state.profiles.filter(
    (p) => ['doctor', 'nurse', 'admin'].includes(p.role) && p.is_active
  ).length;

  const stats = [
    ['Total Patients', String(state.patients.length), '♟', 'Manage Patients', 'patients'],
    ['Active Clinic Staff', String(activeStaffCount), '✚', 'Manage Doctors', 'doctors'],
    ['Clinic Appointments', String(state.appointments.length), '▦', 'View Schedule', 'appointments'],
    ['Security Audit Logs', String(state.auditLogs.length), '🛡', 'View Audit Trail', 'audit-logs'],
  ];

  return `
    <div class="row">
      <div>
        <h1>Admin Dashboard</h1>
        <div class="sub">Clinic operations, staff provisioning, patient &amp; guardian registry, appointments, and security audit logs.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateStaffModal()">＋ Create Staff Account</button>
        <button onclick="window.pedicare.openAdminCreatePatientModal()">＋ Register Patient</button>
        <button onclick="window.pedicare.openAdminCreateAppointmentModal()">📅 New Appointment</button>
      </div>
    </div>

    <div class="grid grid4">
      ${stats
        .map(
          (a) => `
          <section class="card stat">
            <div>
              <strong>${escapeHtml(a[0])}</strong>
              <div class="number">${escapeHtml(a[1])}</div>
              <button style="padding:0;border:0" onclick="window.pedicare.navigate('${a[4]}')">${escapeHtml(a[3])} →</button>
            </div>
            <span class="bigico">${a[2]}</span>
          </section>`
        )
        .join('')}
    </div>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <div class="row">
          <h3>✚ Medical Staff &amp; Role Overview</h3>
          <button onclick="window.pedicare.navigate('roles-permissions')">Manage Roles →</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${state.profiles
              .slice(0, 6)
              .map(
                (p) => `
                <tr>
                  <td><b>${escapeHtml(p.full_name)}</b></td>
                  <td>${escapeHtml(p.email)}</td>
                  <td><strong style="text-transform:uppercase;color:#092d78">${escapeHtml(p.role)}</strong></td>
                  <td>
                    <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${p.is_active ? '#e6f6ee;color:#087443' : '#ffeded;color:#b42318'}">
                      ${p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>
                    <button style="padding:5px 10px" onclick="window.pedicare.openEditUserRoleModal('${p.id}')">Configure</button>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>

      <section class="card">
        <div class="row">
          <h3>▦ Recent Clinic Appointments</h3>
          <button onclick="window.pedicare.navigate('appointments')">Full Schedule →</button>
        </div>
        ${state.appointments
          .slice(0, 5)
          .map((a) => {
            const pt = state.patients.find((p) => Number(p.id) === Number(a.patient_id));
            const doc = state.doctors.find((d) => Number(d.id) === Number(a.doctor_id));
            return `
              <div class="schedule">
                <b>${escapeHtml(a.appointment_time_label)}</b>
                <span><b>${escapeHtml(pt?.full_name || 'Patient')}</b> · ${escapeHtml(doc?.profile?.full_name || 'Doctor')}</span>
                <strong style="text-transform:uppercase">${escapeHtml(a.status)}</strong>
              </div>`;
          })
          .join('')}
        <div class="quick" style="margin-top:16px">
          <button onclick="window.pedicare.navigate('doctors')">👨‍⚕️ Doctor Directory (${state.doctors.length})</button>
          <button onclick="window.pedicare.navigate('nurses')">👩‍⚕️ Nurse Directory (${state.nurses.length})</button>
          <button onclick="window.pedicare.navigate('guardians')">👪 Guardian Directory (${state.guardians.length})</button>
          <button onclick="window.pedicare.navigate('audit-logs')">🛡 Compliance Audit Logs</button>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:18px">
      <div class="row">
        <h3>🛡 Recent Security &amp; Clinical Audit Trail</h3>
        <button onclick="window.pedicare.navigate('audit-logs')">View All Audit Logs →</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Role</th>
            <th>Action</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          ${state.auditLogs
            .slice(0, 6)
            .map(
              (log) => `
              <tr>
                <td>${escapeHtml(formatDateTime(log.created_at))}</td>
                <td><b>${escapeHtml(log.actor_name || 'System')}</b></td>
                <td>${escapeHtml((log.actor_role || 'system').toUpperCase())}</td>
                <td><strong>${escapeHtml(log.action)}</strong></td>
                <td>${escapeHtml(log.entity_type)} #${escapeHtml(String(log.entity_id || '').slice(0, 8))}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderAdminPatientsSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.patients.filter(
    (p) =>
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.patient_code.toLowerCase().includes(q) ||
      (p.allergies || '').toLowerCase().includes(q)
  );
  const pageRows = paginate(filtered);

  return `
    <div class="row">
      <div>
        <h1>Patient Management</h1>
        <div class="sub">Register pediatric patients, assign guardians and primary pediatricians, and manage records.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreatePatientModal()">＋ Register Patient</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search patients by name, ID (PC-...), or allergies...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Full Name</th>
            <th>DOB / Age</th>
            <th>Guardian</th>
            <th>Primary Doctor</th>
            <th>Allergies</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map((p) => {
              const g = state.guardians.find((x) => Number(x.id) === Number(p.guardian_id));
              const d = state.doctors.find((x) => Number(x.id) === Number(p.primary_doctor_id));
              return `
                <tr>
                  <td><b>${escapeHtml(p.patient_code)}</b></td>
                  <td><strong>${escapeHtml(p.full_name)}</strong></td>
                  <td>${escapeHtml(formatDate(p.date_of_birth))} (${escapeHtml(calculateAge(p.date_of_birth))})</td>
                  <td>${escapeHtml(g?.profile?.full_name || 'Linked Guardian')}</td>
                  <td>${escapeHtml(d?.profile?.full_name || 'Unassigned')}</td>
                  <td>${escapeHtml(p.allergies)}</td>
                  <td class="actions">
                    <button style="padding:5px 10px" onclick="window.pedicare.openAdminEditPatientModal(${p.id})">Edit</button>
                  </td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      ${renderPaginationControls(filtered.length)}
    </section>
  `;
}

function renderAdminDoctorsSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.doctors.filter(
    (d) =>
      !q ||
      (d.profile?.full_name || '').toLowerCase().includes(q) ||
      (d.staff_code || '').toLowerCase().includes(q) ||
      (d.specialty || '').toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Doctor Management</h1>
        <div class="sub">Provision pediatrician accounts, manage specialties, license numbers, rooms, and active status.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateStaffModal('doctor')">＋ Add Doctor Account</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search doctors by name, staff code, or specialty...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Staff Code</th>
            <th>Doctor Name</th>
            <th>Email</th>
            <th>Specialty</th>
            <th>License #</th>
            <th>Room</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (d) => `
              <tr>
                <td><b>${escapeHtml(d.staff_code)}</b></td>
                <td><strong>${escapeHtml(d.profile?.full_name || 'Doctor')}</strong></td>
                <td>${escapeHtml(d.profile?.email || '')}</td>
                <td>${escapeHtml(d.specialty)}</td>
                <td>${escapeHtml(d.license_number || '—')}</td>
                <td>${escapeHtml(d.room_number || 'Room 201')}</td>
                <td>
                  <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${d.profile?.is_active !== false ? '#e6f6ee;color:#087443' : '#ffeded;color:#b42318'}">
                    ${d.profile?.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td class="actions">
                  <button style="padding:5px 10px" onclick="window.pedicare.openAdminEditDoctorModal(${d.id})">Edit</button>
                  <button style="padding:5px 10px" onclick="window.pedicare.handleToggleUserActive('${d.profile_id}', ${d.profile?.is_active === false})">
                    ${d.profile?.is_active === false ? 'Activate' : 'Deactivate'}
                  </button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderAdminNursesSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.nurses.filter(
    (n) =>
      !q ||
      (n.profile?.full_name || '').toLowerCase().includes(q) ||
      (n.staff_code || '').toLowerCase().includes(q) ||
      (n.department || '').toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Nurse Management</h1>
        <div class="sub">Provision nursing accounts, assign departments and shifts, and manage account status.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateStaffModal('nurse')">＋ Add Nurse Account</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search nurses by name, staff code, or department...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Staff Code</th>
            <th>Nurse Name</th>
            <th>Email</th>
            <th>Title</th>
            <th>Department</th>
            <th>Shift</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (n) => `
              <tr>
                <td><b>${escapeHtml(n.staff_code)}</b></td>
                <td><strong>${escapeHtml(n.profile?.full_name || 'Nurse')}</strong></td>
                <td>${escapeHtml(n.profile?.email || '')}</td>
                <td>${escapeHtml(n.title)}</td>
                <td>${escapeHtml(n.department)}</td>
                <td>${escapeHtml(n.shift)}</td>
                <td>
                  <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${n.profile?.is_active !== false ? '#e6f6ee;color:#087443' : '#ffeded;color:#b42318'}">
                    ${n.profile?.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td class="actions">
                  <button style="padding:5px 10px" onclick="window.pedicare.openAdminEditNurseModal(${n.id})">Edit</button>
                  <button style="padding:5px 10px" onclick="window.pedicare.handleToggleUserActive('${n.profile_id}', ${n.profile?.is_active === false})">
                    ${n.profile?.is_active === false ? 'Activate' : 'Deactivate'}
                  </button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderAdminGuardiansSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.guardians.filter(
    (g) =>
      !q ||
      (g.profile?.full_name || '').toLowerCase().includes(q) ||
      (g.profile?.email || '').toLowerCase().includes(q) ||
      (g.guardian_code || '').toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Guardian Management</h1>
        <div class="sub">Manage parent/guardian accounts, contact details, insurance policies, and linked children.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateStaffModal('guardian')">＋ Add Guardian Account</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search guardians by name, email, or code...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Code</th>
            <th>Guardian Name</th>
            <th>Email &amp; Phone</th>
            <th>Insurance</th>
            <th>Pharmacy</th>
            <th>Linked Children</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((g) => {
              const kids = state.patients.filter((p) => Number(p.guardian_id) === Number(g.id));
              return `
                <tr>
                  <td><b>${escapeHtml(g.guardian_code)}</b></td>
                  <td><strong>${escapeHtml(g.profile?.full_name || 'Guardian')}</strong></td>
                  <td>${escapeHtml(g.profile?.email || '')}<br><small>${escapeHtml(g.phone || g.profile?.phone || '')}</small></td>
                  <td>${escapeHtml(g.insurance_provider || 'BlueCare')} (${escapeHtml(g.insurance_policy_number || '')})</td>
                  <td>${escapeHtml(g.pharmacy_name || 'CVS #4402')}</td>
                  <td>${kids.map((k) => escapeHtml(k.full_name)).join(', ') || 'None'}</td>
                  <td class="actions">
                    <button style="padding:5px 10px" onclick="window.pedicare.openAdminEditGuardianModal(${g.id})">Edit</button>
                  </td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderAdminAppointmentsSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const statusFilter = state.filterStatus || 'all';

  const filtered = state.appointments.filter((a) => {
    const pt = state.patients.find((p) => Number(p.id) === Number(a.patient_id));
    const matchesQ =
      !q ||
      (a.appointment_code || '').toLowerCase().includes(q) ||
      (pt?.full_name || '').toLowerCase().includes(q) ||
      (a.visit_type || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesQ && matchesStatus;
  });

  const pageRows = paginate(filtered);

  return `
    <div class="row">
      <div>
        <h1>Appointment Management</h1>
        <div class="sub">Schedule, assign, filter, and update clinic-wide pediatric appointments.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateAppointmentModal()">＋ Schedule Appointment</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow" style="flex-wrap:wrap">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search by appointment code, patient name, or visit type...">
        <select id="statusFilterSelect" style="padding:12px;border:1px solid #d9e0eb;border-radius:8px" onchange="window.pedicare.applyStatusFilter(this.value)">
          <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
          <option value="scheduled" ${statusFilter === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="checked_in" ${statusFilter === 'checked_in' ? 'selected' : ''}>Checked In</option>
          <option value="in_progress" ${statusFilter === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed" ${statusFilter === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${statusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Filter</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Code</th>
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Visit Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map((a) => {
              const pt = state.patients.find((p) => Number(p.id) === Number(a.patient_id));
              const doc = state.doctors.find((d) => Number(d.id) === Number(a.doctor_id));
              return `
                <tr>
                  <td><b>${escapeHtml(a.appointment_code)}</b></td>
                  <td>${escapeHtml(a.appointment_time_label)}</td>
                  <td><strong>${escapeHtml(pt?.full_name || 'Patient')}</strong> (${escapeHtml(pt?.patient_code || '')})</td>
                  <td>${escapeHtml(doc?.profile?.full_name || 'Unassigned')}</td>
                  <td>${escapeHtml(a.visit_type)}</td>
                  <td><strong style="text-transform:uppercase">${escapeHtml(a.status)}</strong></td>
                  <td class="actions">
                    <button style="padding:5px 10px" onclick="window.pedicare.openAdminEditAppointmentModal(${a.id})">Manage</button>
                  </td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      ${renderPaginationControls(filtered.length)}
    </section>
  `;
}

function renderAdminRolesSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const roleFilter = state.filterRole || 'all';

  const filtered = state.profiles.filter((p) => {
    const matchesQ =
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesQ && matchesRole;
  });

  return `
    <div class="row">
      <div>
        <h1>Role &amp; Permission Management</h1>
        <div class="sub">Control RBAC role assignments, account activation, password resets, and database-enforced access policies.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAdminCreateStaffModal()">＋ Provision User Account</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow" style="flex-wrap:wrap">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search accounts by name or email...">
        <select style="padding:12px;border:1px solid #d9e0eb;border-radius:8px" onchange="window.pedicare.applyRoleFilter(this.value)">
          <option value="all" ${roleFilter === 'all' ? 'selected' : ''}>All Roles</option>
          <option value="admin" ${roleFilter === 'admin' ? 'selected' : ''}>Admins</option>
          <option value="doctor" ${roleFilter === 'doctor' ? 'selected' : ''}>Doctors</option>
          <option value="nurse" ${roleFilter === 'nurse' ? 'selected' : ''}>Nurses</option>
          <option value="guardian" ${roleFilter === 'guardian' ? 'selected' : ''}>Guardians / Parents</option>
        </select>
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Email</th>
            <th>Assigned Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (p) => `
              <tr>
                <td><strong>${escapeHtml(p.full_name)}</strong></td>
                <td>${escapeHtml(p.email)}</td>
                <td><b style="text-transform:uppercase;color:#092d78">${escapeHtml(p.role)}</b></td>
                <td>
                  <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${p.is_active ? '#e6f6ee;color:#087443' : '#ffeded;color:#b42318'}">
                    ${p.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                  </span>
                </td>
                <td>${escapeHtml(formatDate(p.created_at))}</td>
                <td class="actions">
                  <button style="padding:5px 10px" onclick="window.pedicare.openEditUserRoleModal('${p.id}')">Change Role</button>
                  <button style="padding:5px 10px" onclick="window.pedicare.openAdminResetPasswordModal('${p.id}', '${escapeHtml(p.email)}')">Reset Password</button>
                  <button style="padding:5px 10px" onclick="window.pedicare.handleToggleUserActive('${p.id}', ${!p.is_active})">
                    ${p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>

    <section class="card" style="margin-top:18px">
      <h3>Database Row-Level Security (RLS) Permission Matrix</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Patient Records</th>
            <th>Examinations &amp; Prescriptions</th>
            <th>Vitals &amp; Nursing Tasks</th>
            <th>Staff &amp; Audit Logs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>GUARDIAN</b></td>
            <td>Own linked children only (Read/Update contact)</td>
            <td>Read-only for own children</td>
            <td>Read-only for own children</td>
            <td>No access</td>
          </tr>
          <tr>
            <td><b>DOCTOR</b></td>
            <td>Read &amp; clinical update for all clinic patients</td>
            <td>Full Read / Create / Update</td>
            <td>Read &amp; Record vitals</td>
            <td>Read staff directory</td>
          </tr>
          <tr>
            <td><b>NURSE</b></td>
            <td>Read &amp; update health info / check-in</td>
            <td>Read-only prescriptions &amp; exams</td>
            <td>Full Read / Create / Update</td>
            <td>Read staff directory</td>
          </tr>
          <tr>
            <td><b>ADMIN</b></td>
            <td>Full Clinic Registry CRUD</td>
            <td>Full Oversight</td>
            <td>Full Oversight</td>
            <td>Full Staff Provisioning &amp; Audit Logs</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderAdminAuditLogsSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const roleFilter = state.filterRole || 'all';

  const filtered = state.auditLogs.filter((log) => {
    const matchesQ =
      !q ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.actor_name || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q);
    const matchesRole =
      roleFilter === 'all' || (log.actor_role || '').toLowerCase() === roleFilter;
    return matchesQ && matchesRole;
  });

  const pageRows = paginate(filtered);

  return `
    <div class="row">
      <div>
        <h1>Security &amp; Clinical Audit Logs</h1>
        <div class="sub">Immutable database-triggered audit trail of account creation, role changes, and clinical record updates.</div>
      </div>
      <button onclick="window.pedicare.navigate('dashboard')">Back to Overview</button>
    </div>

    <section class="card">
      <div class="searchrow" style="flex-wrap:wrap">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search by action (e.g. INSERT_PRESCRIPTIONS), actor name, or table...">
        <select style="padding:12px;border:1px solid #d9e0eb;border-radius:8px" onchange="window.pedicare.applyRoleFilter(this.value)">
          <option value="all" ${roleFilter === 'all' ? 'selected' : ''}>All Actor Roles</option>
          <option value="admin" ${roleFilter === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="doctor" ${roleFilter === 'doctor' ? 'selected' : ''}>Doctor</option>
          <option value="nurse" ${roleFilter === 'nurse' ? 'selected' : ''}>Nurse</option>
          <option value="guardian" ${roleFilter === 'guardian' ? 'selected' : ''}>Guardian</option>
        </select>
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search Logs</button>
      </div>

      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Role</th>
            <th>Action</th>
            <th>Entity Type</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map(
              (log) => `
              <tr>
                <td>${escapeHtml(formatDateTime(log.created_at))}</td>
                <td><b>${escapeHtml(log.actor_name || 'System')}</b></td>
                <td>${escapeHtml((log.actor_role || 'system').toUpperCase())}</td>
                <td><strong>${escapeHtml(log.action)}</strong></td>
                <td>${escapeHtml(log.entity_type)}</td>
                <td><code style="font-size:11px;color:#354766">${escapeHtml(JSON.stringify(log.details || {}))}</code></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
      ${renderPaginationControls(filtered.length)}
    </section>
  `;
}

export function registerAdminActions(refreshApp) {
  window.pedicare.setPage = (p) => {
    state.currentPage = Math.max(1, Number(p));
    refreshApp();
  };

  window.pedicare.applyStatusFilter = (status) => {
    state.filterStatus = status;
    state.currentPage = 1;
    refreshApp();
  };

  window.pedicare.applyRoleFilter = (role) => {
    state.filterRole = role;
    state.currentPage = 1;
    refreshApp();
  };

  window.pedicare.openAdminCreateStaffModal = (defaultRole = 'doctor') => {
    showFormModal({
      title: 'Provision Clinic Account',
      description: 'Create a verified staff or guardian account via Supabase Admin Auth.',
      fields: [
        {
          name: 'role',
          label: 'Account Role',
          type: 'select',
          value: defaultRole,
          options: [
            { value: 'doctor', label: 'Doctor (Pediatrician)' },
            { value: 'nurse', label: 'Nurse / Nurse Practitioner' },
            { value: 'admin', label: 'Clinic Administrator' },
            { value: 'guardian', label: 'Parent / Guardian' },
          ],
        },
        { name: 'full_name', label: 'Full Name', placeholder: 'e.g. Dr. Rachel Green' },
        { name: 'email', label: 'Email Address', type: 'email', placeholder: 'rachel.green@pedicare.demo' },
        { name: 'password', label: 'Temporary Password', type: 'password', value: 'PediCare123!' },
        { name: 'phone', label: 'Phone Number', value: '(555) 800-3300' },
        { name: 'specialty', label: 'Specialty (Doctors) / Title (Nurses)', value: defaultRole === 'nurse' ? 'Registered Pediatric Nurse' : 'Pediatrician', required: false },
        { name: 'room_number', label: 'Room / Department', value: defaultRole === 'nurse' ? 'Pediatric Care' : 'Room 205', required: false },
      ],
      submitLabel: 'Create Account',
      onSubmit: async (values) => {
        await callClinicEdgeFunction({
          action: 'create_account',
          role: values.role,
          full_name: values.full_name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          specialty: values.specialty,
          title: values.specialty,
          room_number: values.room_number,
          department: values.room_number,
        });
        await loadDashboardData();
        refreshApp();
        toast(`Created ${values.role} account for ${values.full_name}.`);
      },
    });
  };

  window.pedicare.handleToggleUserActive = async (profileId, makeActive) => {
    try {
      await callClinicEdgeFunction({
        action: 'toggle_active',
        profile_id: profileId,
        is_active: Boolean(makeActive),
      });
      await loadDashboardData();
      refreshApp();
      toast(`User account ${makeActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      toast(err.message || 'Failed to update account status.', true);
    }
  };

  window.pedicare.openEditUserRoleModal = (profileId) => {
    const prof = state.profiles.find((p) => p.id === profileId);
    if (!prof) return;
    showFormModal({
      title: `Configure Role — ${prof.full_name}`,
      description: `Account: ${prof.email}`,
      fields: [
        {
          name: 'new_role',
          label: 'Authorized System Role',
          type: 'select',
          value: prof.role,
          options: [
            { value: 'guardian', label: 'Guardian / Parent' },
            { value: 'doctor', label: 'Doctor' },
            { value: 'nurse', label: 'Nurse' },
            { value: 'admin', label: 'Admin' },
          ],
        },
      ],
      submitLabel: 'Update Role',
      onSubmit: async (values) => {
        await callClinicEdgeFunction({
          action: 'update_role',
          profile_id: prof.id,
          new_role: values.new_role,
        });
        await loadDashboardData();
        refreshApp();
        toast(`Updated role for ${prof.full_name} to ${values.new_role}.`);
      },
    });
  };

  window.pedicare.openAdminResetPasswordModal = (profileId, email) => {
    showFormModal({
      title: 'Admin Password Reset',
      description: `Set a new password for ${email}.`,
      fields: [
        { name: 'new_password', label: 'New Password (min 6 characters)', type: 'password', value: 'PediCare123!' },
      ],
      submitLabel: 'Reset Password',
      onSubmit: async (values) => {
        await callClinicEdgeFunction({
          action: 'admin_reset_password',
          profile_id: profileId,
          new_password: values.new_password,
        });
        await loadDashboardData();
        refreshApp();
        toast(`Password updated for ${email}.`);
      },
    });
  };

  window.pedicare.openAdminCreatePatientModal = () => {
    showFormModal({
      title: 'Register New Pediatric Patient',
      description: 'Add a child to the clinic registry and link them to a guardian and primary pediatrician.',
      fields: [
        { name: 'full_name', label: 'Patient Full Name', placeholder: 'e.g. Ethan Carter' },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', value: '2020-09-15' },
        {
          name: 'gender',
          label: 'Gender',
          type: 'select',
          value: 'Male',
          options: [
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
          ],
        },
        {
          name: 'guardian_id',
          label: 'Linked Guardian',
          type: 'select',
          value: String(state.guardians[0]?.id || ''),
          options: state.guardians.map((g) => ({
            value: String(g.id),
            label: `${g.profile?.full_name || g.guardian_code} (${g.profile?.email || ''})`,
          })),
        },
        {
          name: 'primary_doctor_id',
          label: 'Primary Pediatrician',
          type: 'select',
          value: String(state.doctors[0]?.id || ''),
          options: state.doctors.map((d) => ({
            value: String(d.id),
            label: `${d.profile?.full_name || d.staff_code} — ${d.specialty}`,
          })),
        },
        { name: 'blood_group', label: 'Blood Group', value: 'O+' },
        { name: 'allergies', label: 'Allergies', value: 'None reported' },
      ],
      submitLabel: 'Register Patient',
      onSubmit: async (values) => {
        const code = `PC-${Math.floor(10000 + Math.random() * 89999)}`;
        const { error } = await supabase.from('patients').insert({
          patient_code: code,
          guardian_id: Number(values.guardian_id),
          primary_doctor_id: Number(values.primary_doctor_id),
          full_name: values.full_name,
          date_of_birth: values.date_of_birth,
          gender: values.gender,
          blood_group: values.blood_group,
          allergies: values.allergies,
        });
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast(`Registered patient ${values.full_name} (${code}).`);
      },
    });
  };

  window.pedicare.openAdminEditPatientModal = (patientId) => {
    const pt = state.patients.find((p) => Number(p.id) === Number(patientId));
    if (!pt) return;
    showFormModal({
      title: `Edit Patient — ${pt.full_name} (${pt.patient_code})`,
      description: 'Update patient demographics, assigned guardian, or primary doctor.',
      fields: [
        { name: 'full_name', label: 'Full Name', value: pt.full_name },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', value: pt.date_of_birth },
        { name: 'gender', label: 'Gender', value: pt.gender },
        { name: 'blood_group', label: 'Blood Group', value: pt.blood_group },
        { name: 'allergies', label: 'Allergies', value: pt.allergies },
        {
          name: 'primary_doctor_id',
          label: 'Primary Pediatrician',
          type: 'select',
          value: String(pt.primary_doctor_id || state.doctors[0]?.id || ''),
          options: state.doctors.map((d) => ({
            value: String(d.id),
            label: `${d.profile?.full_name || d.staff_code}`,
          })),
        },
      ],
      submitLabel: 'Save Patient',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('patients')
          .update({
            full_name: values.full_name,
            date_of_birth: values.date_of_birth,
            gender: values.gender,
            blood_group: values.blood_group,
            allergies: values.allergies,
            primary_doctor_id: Number(values.primary_doctor_id),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pt.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Patient record updated.');
      },
    });
  };

  window.pedicare.openAdminEditDoctorModal = (docId) => {
    const doc = state.doctors.find((d) => Number(d.id) === Number(docId));
    if (!doc) return;
    showFormModal({
      title: `Edit Doctor — ${doc.profile?.full_name || doc.staff_code}`,
      description: 'Update specialty, license number, and room assignment.',
      fields: [
        { name: 'specialty', label: 'Specialty', value: doc.specialty },
        { name: 'license_number', label: 'Medical License #', value: doc.license_number || '' },
        { name: 'room_number', label: 'Room Number', value: doc.room_number || 'Room 201' },
      ],
      submitLabel: 'Update Doctor',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('doctors')
          .update({
            specialty: values.specialty,
            license_number: values.license_number,
            room_number: values.room_number,
            updated_at: new Date().toISOString(),
          })
          .eq('id', doc.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Doctor record updated.');
      },
    });
  };

  window.pedicare.openAdminEditNurseModal = (nurseId) => {
    const nurse = state.nurses.find((n) => Number(n.id) === Number(nurseId));
    if (!nurse) return;
    showFormModal({
      title: `Edit Nurse — ${nurse.profile?.full_name || nurse.staff_code}`,
      description: 'Update nursing title, department, and shift schedule.',
      fields: [
        { name: 'title', label: 'Title', value: nurse.title },
        { name: 'department', label: 'Department', value: nurse.department },
        { name: 'shift', label: 'Shift', value: nurse.shift },
      ],
      submitLabel: 'Update Nurse',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('nurses')
          .update({
            title: values.title,
            department: values.department,
            shift: values.shift,
            updated_at: new Date().toISOString(),
          })
          .eq('id', nurse.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Nurse record updated.');
      },
    });
  };

  window.pedicare.openAdminEditGuardianModal = (guardianId) => {
    const g = state.guardians.find((x) => Number(x.id) === Number(guardianId));
    if (!g) return;
    showFormModal({
      title: `Edit Guardian — ${g.profile?.full_name || g.guardian_code}`,
      description: 'Update guardian phone, insurance, and preferred pharmacy.',
      fields: [
        { name: 'phone', label: 'Phone Number', value: g.phone || g.profile?.phone || '' },
        { name: 'insurance_provider', label: 'Insurance Provider', value: g.insurance_provider || '' },
        { name: 'insurance_policy_number', label: 'Policy Number', value: g.insurance_policy_number || '' },
        { name: 'pharmacy_name', label: 'Pharmacy Name', value: g.pharmacy_name || '' },
        { name: 'pharmacy_address', label: 'Pharmacy Address', value: g.pharmacy_address || '' },
      ],
      submitLabel: 'Update Guardian',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('guardians')
          .update({
            phone: values.phone,
            insurance_provider: values.insurance_provider,
            insurance_policy_number: values.insurance_policy_number,
            pharmacy_name: values.pharmacy_name,
            pharmacy_address: values.pharmacy_address,
            updated_at: new Date().toISOString(),
          })
          .eq('id', g.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Guardian record updated.');
      },
    });
  };

  window.pedicare.openAdminCreateAppointmentModal = () => {
    showFormModal({
      title: 'Schedule Clinic Appointment',
      description: 'Create an appointment and assign a pediatrician and nurse.',
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(state.patients[0]?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        {
          name: 'doctor_id',
          label: 'Assigned Doctor',
          type: 'select',
          value: String(state.doctors[0]?.id || ''),
          options: state.doctors.map((d) => ({
            value: String(d.id),
            label: `${d.profile?.full_name || d.staff_code} (${d.specialty})`,
          })),
        },
        {
          name: 'nurse_id',
          label: 'Assigned Nurse',
          type: 'select',
          value: String(state.nurses[0]?.id || ''),
          options: state.nurses.map((n) => ({
            value: String(n.id),
            label: `${n.profile?.full_name || n.staff_code} (${n.title})`,
          })),
        },
        {
          name: 'visit_type',
          label: 'Visit Type',
          type: 'select',
          value: 'Consultation',
          options: [
            { value: 'Consultation', label: 'Consultation' },
            { value: 'Annual Wellness Exam', label: 'Annual Wellness Exam' },
            { value: 'Follow Up', label: 'Follow Up' },
            { value: 'Vaccination', label: 'Vaccination' },
            { value: 'Vitals', label: 'Vitals Check' },
          ],
        },
        { name: 'appointment_time_label', label: 'Appointment Time', value: '11:00 AM' },
        { name: 'reason', label: 'Reason for Visit', type: 'textarea', placeholder: 'Enter visit reason...' },
      ],
      submitLabel: 'Create Appointment',
      onSubmit: async (values) => {
        await createAppointment(values);
        await loadDashboardData();
        refreshApp();
        toast('Appointment scheduled.');
      },
    });
  };

  window.pedicare.openAdminEditAppointmentModal = (apptId) => {
    const appt = state.appointments.find((a) => Number(a.id) === Number(apptId));
    if (!appt) return;
    showFormModal({
      title: `Manage Appointment — ${appt.appointment_code}`,
      description: `Time: ${appt.appointment_time_label} · Type: ${appt.visit_type}`,
      fields: [
        {
          name: 'status',
          label: 'Appointment Status',
          type: 'select',
          value: appt.status,
          options: [
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'checked_in', label: 'Checked In' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
        {
          name: 'doctor_id',
          label: 'Assigned Doctor',
          type: 'select',
          value: String(appt.doctor_id || state.doctors[0]?.id || ''),
          options: state.doctors.map((d) => ({
            value: String(d.id),
            label: `${d.profile?.full_name || d.staff_code}`,
          })),
        },
        { name: 'appointment_time_label', label: 'Time Slot', value: appt.appointment_time_label },
        { name: 'notes', label: 'Clinic Notes', type: 'textarea', value: appt.notes || '', required: false },
      ],
      submitLabel: 'Save Appointment',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('appointments')
          .update({
            status: values.status,
            doctor_id: Number(values.doctor_id),
            appointment_time_label: values.appointment_time_label,
            notes: values.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appt.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Appointment updated.');
      },
    });
  };
}
