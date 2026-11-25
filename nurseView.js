// PediCare Office — Nurse Dashboard & Nursing Workflow Subpages

import {
  state,
  $,
  escapeHtml,
  formatDate,
  calculateAge,
  showFormModal,
  toast,
} from '../state.js';
import {
  getSelectedPatient,
  recordVitalSigns,
  createMedicalRecordEntry,
  toggleNurseTask,
  createNurseTask,
  updateAppointmentStatus,
  loadDashboardData,
} from '../api.js';
import { supabase } from '../supabaseClient.js';

export function renderNurseDashboardContent() {
  if (state.page === 'find-patient') {
    return renderNurseFindPatientSubpage();
  }
  if (state.page === 'measurements') {
    return renderNurseMeasurementsSubpage();
  }
  if (state.page === 'health-info') {
    return renderNurseHealthInfoSubpage();
  }
  if (state.page === 'patient-history') {
    return renderNursePatientHistorySubpage();
  }
  if (state.page === 'reports') {
    return renderNurseReportsSubpage();
  }
  if (state.page === 'schedule' || state.page === 'checked-in') {
    return renderNurseScheduleSubpage();
  }

  const totalAppointments = state.appointments.length;
  const checkedInCount = state.appointments.filter((a) =>
    ['checked_in', 'in_progress'].includes(a.status)
  ).length;
  const pendingReportsCount = state.nurseTasks.filter((t) => !t.is_completed).length;
  const vitalsCount = state.vitalSigns.length;

  const stats = [
    ['Today’s Appointments', String(totalAppointments), '▦', 'View Schedule', 'schedule'],
    ['Patients Checked In', String(checkedInCount), '♙', 'View List', 'checked-in'],
    ['Pending Reports', String(pendingReportsCount), '▤', 'View Reports', 'reports'],
    ['Vitals Recorded', String(vitalsCount), '♡', 'View All', 'measurements'],
  ];

  const recentPatients = state.patients.slice(0, 3);
  const latestVitals = state.vitalSigns.slice(0, 5);
  const scheduleRows = state.appointments.slice(0, 5);

  return `
    <h1>Nurse Dashboard</h1>
    <div class="sub">Manage patient flow, vitals, records and prepare reports for the doctor.</div>

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
        <h3>⌕ Find Patient</h3>
        <div class="searchrow">
          <input id="nurseSearch" placeholder="Enter Patient Name or ID...">
          <button class="primary" onclick="window.pedicare.handleNurseSearch()">Search</button>
        </div>
        <div style="margin-top:10px;font-size:12px;color:#5e6b80">
          Selected Patient: <strong>${escapeHtml(getSelectedPatient()?.full_name || 'Benjamin Thompson')} (${escapeHtml(getSelectedPatient()?.patient_code || 'PC-6821')})</strong>
        </div>
      </section>

      <section class="card">
        <h3>Recent Patients</h3>
        ${recentPatients
          .map((p, i) => {
            const times = ['10:30 AM', '09:45 AM', '09:15 AM'];
            return `
              <div class="history-item">
                <span>
                  <b>${escapeHtml(p.full_name)}</b><br>
                  <small>ID: ${escapeHtml(p.patient_code)}</small>
                </span>
                <div class="actions">
                  <span style="align-self:center">${times[i] || '09:00 AM'}</span>
                  <button style="padding:5px 10px" onclick="window.pedicare.selectPatient(${p.id})">Select</button>
                </div>
              </div>`;
          })
          .join('')}
        <button style="width:100%;border:0" onclick="window.pedicare.navigate('find-patient')">View All Patients →</button>
      </section>
    </div>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <h3>Patient Measurements (Latest)</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Temp (°F)</th>
              <th>HR (bpm)</th>
              <th>Resp (/min)</th>
              <th>BP (mmHg)</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${latestVitals
              .map((v) => {
                const pt = state.patients.find((p) => Number(p.id) === Number(v.patient_id));
                return `
                  <tr>
                    <td>${escapeHtml(pt?.full_name || 'Patient')}</td>
                    <td>${escapeHtml(v.temperature_f)}</td>
                    <td>${escapeHtml(v.heart_rate_bpm)}</td>
                    <td>${escapeHtml(v.respiratory_rate_min)}</td>
                    <td>${escapeHtml(v.blood_pressure_text || `${v.bp_systolic}/${v.bp_diastolic}`)}</td>
                    <td>${escapeHtml(v.recorded_time_label || '10:30 AM')}</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <button style="width:100%;border:0;margin-top:8px" onclick="window.pedicare.navigate('measurements')">View All Measurements →</button>
      </section>

      <section class="card tasks">
        <h3>Tasks &amp; Reminders</h3>
        ${state.nurseTasks
          .map(
            (t) => `
            <label>
              <input type="checkbox" ${t.is_completed ? 'checked' : ''} onchange="window.pedicare.handleNurseTaskToggle(${t.id}, this.checked)">
              <span style="${t.is_completed ? 'text-decoration:line-through;color:#8a94a4' : ''}">${escapeHtml(t.title)}</span>
            </label>`
          )
          .join('')}
        <button style="width:100%;border:0" onclick="window.pedicare.openNurseTasksModal()">＋ Add / Manage Tasks →</button>
      </section>
    </div>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <h3>Today's Schedule</h3>
        ${scheduleRows
          .map((a) => {
            const pt = state.patients.find((p) => Number(p.id) === Number(a.patient_id));
            return `
              <div class="schedule">
                <b>${escapeHtml(a.appointment_time_label)}</b>
                <span>${escapeHtml(pt?.full_name || 'Patient')} (ID: ${escapeHtml(pt?.patient_code || 'PC-000')})</span>
                <strong>${escapeHtml(a.visit_type)}</strong>
              </div>`;
          })
          .join('')}
        <button style="width:100%;border:0;margin-top:8px" onclick="window.pedicare.navigate('schedule')">View Full Schedule →</button>
      </section>

      <section class="card">
        <h3>Quick Actions</h3>
        <div class="quick">
          <button onclick="window.pedicare.openAddMeasurementsModal()">♡ Add Measurements</button>
          <button onclick="window.pedicare.openUpdateHealthInfoModal()">▤ Update Health Info</button>
          <button onclick="window.pedicare.openRecordVitalsModal()">♧ Record Vitals</button>
          <button onclick="window.pedicare.openGenerateReportModal()">▧ Generate Report</button>
        </div>
      </section>
    </div>
  `;
}

function renderNurseFindPatientSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.patients.filter(
    (p) =>
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.patient_code.toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Find Patient</h1>
        <div class="sub">Search patients to record measurements, update health information, or check in.</div>
      </div>
      <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search by patient name or ID...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>
      <table class="table" style="margin-top:16px">
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Full Name</th>
            <th>Age / Gender</th>
            <th>Blood Group</th>
            <th>Allergies</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (p) => `
              <tr>
                <td><b>${escapeHtml(p.patient_code)}</b></td>
                <td><strong>${escapeHtml(p.full_name)}</strong></td>
                <td>${escapeHtml(calculateAge(p.date_of_birth))} · ${escapeHtml(p.gender)}</td>
                <td>${escapeHtml(p.blood_group)}</td>
                <td>${escapeHtml(p.allergies)}</td>
                <td class="actions">
                  <button class="primary" style="padding:6px 10px" onclick="window.pedicare.openAddMeasurementsModal(${p.id})">Record Vitals</button>
                  <button style="padding:6px 10px" onclick="window.pedicare.openUpdateHealthInfoModal(${p.id})">Update Health Info</button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderNurseMeasurementsSubpage() {
  return `
    <div class="row">
      <div>
        <h1>Patient Measurements &amp; Vitals</h1>
        <div class="sub">Complete log of temperature, heart rate, respiratory rate, blood pressure, and weight measurements.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAddMeasurementsModal()">＋ Add Measurements</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Temp (°F)</th>
            <th>HR (bpm)</th>
            <th>Resp (/min)</th>
            <th>BP (mmHg)</th>
            <th>Weight (kg)</th>
            <th>Time</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${state.vitalSigns
            .map((v) => {
              const pt = state.patients.find((p) => Number(p.id) === Number(v.patient_id));
              return `
                <tr>
                  <td><b>${escapeHtml(pt?.full_name || 'Patient')}</b> (${escapeHtml(pt?.patient_code || '')})</td>
                  <td>${escapeHtml(v.temperature_f)}</td>
                  <td>${escapeHtml(v.heart_rate_bpm)}</td>
                  <td>${escapeHtml(v.respiratory_rate_min)}</td>
                  <td>${escapeHtml(v.blood_pressure_text || `${v.bp_systolic}/${v.bp_diastolic}`)}</td>
                  <td>${escapeHtml(v.weight_kg || '21.0')}</td>
                  <td>${escapeHtml(v.recorded_time_label)}</td>
                  <td>${escapeHtml(v.notes || '—')}</td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderNurseHealthInfoSubpage() {
  return `
    <div class="row">
      <div>
        <h1>Patient Health Information</h1>
        <div class="sub">Review and update patient allergies, blood groups, chronic conditions, and immunization notes.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openUpdateHealthInfoModal()">▤ Update Health Info</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Patient Name</th>
            <th>Blood Group</th>
            <th>Allergies</th>
            <th>Chronic Conditions</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.patients
            .map(
              (p) => `
              <tr>
                <td><b>${escapeHtml(p.patient_code)}</b></td>
                <td><strong>${escapeHtml(p.full_name)}</strong></td>
                <td>${escapeHtml(p.blood_group)}</td>
                <td>${escapeHtml(p.allergies)}</td>
                <td>${escapeHtml(p.chronic_conditions || 'None')}</td>
                <td><button style="padding:6px 10px" onclick="window.pedicare.openUpdateHealthInfoModal(${p.id})">Edit Health Info</button></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderNursePatientHistorySubpage() {
  return `
    <div class="row">
      <div>
        <h1>Patient Medical History Registry</h1>
        <div class="sub">View clinical diagnoses, immunizations, and nursing entries across patients.</div>
      </div>
      <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
    </div>

    <section class="card">
      ${state.medicalRecords
        .map((r) => {
          const pt = state.patients.find((p) => Number(p.id) === Number(r.patient_id));
          return `
            <div class="history-item">
              <span>
                <b>${escapeHtml(pt?.full_name || 'Patient')} (${escapeHtml(pt?.patient_code || '')}) — ${escapeHtml(r.condition_title)}</b><br>
                <small>${escapeHtml(r.record_type.toUpperCase())} · ${escapeHtml(formatDate(r.diagnosed_date))} · ${escapeHtml(r.notes || '')}</small>
              </span>
              <strong>${escapeHtml(r.status)}</strong>
            </div>`;
        })
        .join('')}
    </section>
  `;
}

function renderNurseReportsSubpage() {
  const reports = state.medicalRecords.filter((r) =>
    ['report', 'health_info', 'immunization', 'lab_result'].includes(r.record_type)
  );
  return `
    <div class="row">
      <div>
        <h1>Nursing Reports &amp; Lab Prep</h1>
        <div class="sub">Prepare clinical intake reports, immunization logs, and lab summaries for the pediatrician.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openGenerateReportModal()">▧ Generate Report</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      ${
        reports.length
          ? reports
              .map((r) => {
                const pt = state.patients.find((p) => Number(p.id) === Number(r.patient_id));
                return `
                  <div class="history-item">
                    <span>
                      <b>${escapeHtml(r.condition_title)} — ${escapeHtml(pt?.full_name || 'Patient')}</b><br>
                      <small>${escapeHtml(formatDate(r.diagnosed_date))} · ${escapeHtml(r.notes || '')}</small>
                    </span>
                    <strong>${escapeHtml(r.status)}</strong>
                  </div>`;
              })
              .join('')
          : '<p style="color:#657187;font-size:13px">No nursing reports recorded yet.</p>'
      }
    </section>
  `;
}

function renderNurseScheduleSubpage() {
  return `
    <div class="row">
      <div>
        <h1>Today's Schedule &amp; Patient Check-In</h1>
        <div class="sub">Manage patient arrivals, check-in status, and room flow.</div>
      </div>
      <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
    </div>

    <section class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Appointment ID</th>
            <th>Patient</th>
            <th>Visit Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.appointments
            .map((a) => {
              const pt = state.patients.find((p) => Number(p.id) === Number(a.patient_id));
              return `
                <tr>
                  <td><b>${escapeHtml(a.appointment_time_label)}</b></td>
                  <td>${escapeHtml(a.appointment_code)}</td>
                  <td><strong>${escapeHtml(pt?.full_name || 'Patient')}</strong> (${escapeHtml(pt?.patient_code || '')})</td>
                  <td>${escapeHtml(a.visit_type)}</td>
                  <td>${escapeHtml(a.reason || '—')}</td>
                  <td><strong>${escapeHtml(a.status.toUpperCase())}</strong></td>
                  <td class="actions">
                    ${
                      a.status === 'scheduled'
                        ? `<button class="primary" style="padding:6px 10px" onclick="window.pedicare.handleAppointmentStatus(${a.id}, 'checked_in')">Check In</button>`
                        : a.status === 'checked_in'
                        ? `<button style="padding:6px 10px" onclick="window.pedicare.handleAppointmentStatus(${a.id}, 'completed')">Complete</button>`
                        : `<button style="padding:6px 10px" onclick="window.pedicare.handleAppointmentStatus(${a.id}, 'checked_in')">Re-open</button>`
                    }
                  </td>
                </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

export function registerNurseActions(refreshApp) {
  window.pedicare.handleNurseSearch = () => {
    const q = ($('#nurseSearch')?.value || '').trim().toLowerCase();
    if (!q) {
      toast('Enter a patient name or ID.', true);
      return;
    }
    const match = state.patients.find(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_code.toLowerCase().includes(q)
    );
    if (!match) {
      toast(`No patient found matching "${q}".`, true);
      return;
    }
    state.selectedPatientId = match.id;
    refreshApp();
    toast(`Patient found in clinic records: ${match.full_name} (${match.patient_code})`);
  };

  window.pedicare.handleNurseTaskToggle = async (taskId, checked) => {
    await toggleNurseTask(taskId, checked);
    await loadDashboardData();
    refreshApp();
    toast(checked ? 'Task marked completed.' : 'Task reopened.');
  };

  window.pedicare.openNurseTasksModal = () => {
    showFormModal({
      title: 'Add Nursing Task / Reminder',
      description: 'Add a new task to the pediatric nursing checklist.',
      fields: [
        { name: 'title', label: 'Task Description', placeholder: 'e.g. Prepare nebulizer for Room 204' },
        {
          name: 'patient_id',
          label: 'Related Patient (Optional)',
          type: 'select',
          value: String(getSelectedPatient()?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          value: 'normal',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ],
        },
      ],
      submitLabel: 'Add Task',
      onSubmit: async (values) => {
        await createNurseTask(values);
        await loadDashboardData();
        refreshApp();
        toast('Nursing task added.');
      },
    });
  };

  window.pedicare.openAddMeasurementsModal = (patientIdOverride) => {
    const defaultId = patientIdOverride || getSelectedPatient()?.id || state.patients[0]?.id;
    showFormModal({
      title: 'Add Measurements',
      description: 'Record patient measurements and vital signs in Supabase.',
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(defaultId || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        { name: 'temperature_f', label: 'Temperature (°F)', type: 'number', value: '98.6' },
        { name: 'heart_rate_bpm', label: 'Heart Rate (bpm)', type: 'number', value: '90' },
        { name: 'respiratory_rate_min', label: 'Respiratory Rate (/min)', type: 'number', value: '19' },
        { name: 'blood_pressure_text', label: 'Blood Pressure (mmHg)', value: '110/70' },
        { name: 'weight_kg', label: 'Weight (kg)', type: 'number', value: '21.4' },
        { name: 'notes', label: 'Measurement Notes', type: 'textarea', placeholder: 'Optional intake notes...', required: false },
      ],
      submitLabel: 'Save Measurements',
      onSubmit: async (values) => {
        await recordVitalSigns(values);
        await loadDashboardData();
        refreshApp();
        toast('Patient measurements recorded.');
      },
    });
  };

  window.pedicare.openRecordVitalsModal = () => {
    window.pedicare.openAddMeasurementsModal();
  };

  window.pedicare.openUpdateHealthInfoModal = (patientIdOverride) => {
    const pt =
      state.patients.find((p) => Number(p.id) === Number(patientIdOverride)) ||
      getSelectedPatient() ||
      state.patients[0];
    if (!pt) return;

    showFormModal({
      title: 'Update Health Info',
      description: `Update health profile and allergies for ${pt.full_name} (${pt.patient_code}).`,
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(pt.id),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        { name: 'blood_group', label: 'Blood Group', value: pt.blood_group || 'O+' },
        { name: 'allergies', label: 'Allergies', value: pt.allergies || 'None reported' },
        { name: 'chronic_conditions', label: 'Chronic Conditions', value: pt.chronic_conditions || 'None' },
        { name: 'notes', label: 'Health Information Update Notes', type: 'textarea', placeholder: 'Enter nursing health notes...' },
      ],
      submitLabel: 'Update Health Info',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('patients')
          .update({
            blood_group: values.blood_group,
            allergies: values.allergies,
            chronic_conditions: values.chronic_conditions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', Number(values.patient_id));
        if (error) throw error;

        if (values.notes) {
          await createMedicalRecordEntry({
            patient_id: values.patient_id,
            condition_title: 'Nursing Health Info Update',
            record_type: 'health_info',
            severity: 'Normal',
            status: 'Active',
            notes: values.notes,
          });
        }
        await loadDashboardData();
        refreshApp();
        toast('Patient health information updated.');
      },
    });
  };

  window.pedicare.openGenerateReportModal = () => {
    const pt = getSelectedPatient() || state.patients[0];
    showFormModal({
      title: 'Generate Report',
      description: 'Generate a clinical nursing report for the selected patient.',
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(pt?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        {
          name: 'condition_title',
          label: 'Report Title / Type',
          placeholder: 'e.g. Pre-Consultation Vitals & Triage Report',
        },
        {
          name: 'record_type',
          label: 'Category',
          type: 'select',
          value: 'report',
          options: [
            { value: 'report', label: 'Clinical Nursing Report' },
            { value: 'immunization', label: 'Immunization Report' },
            { value: 'lab_result', label: 'Lab Screening Summary' },
          ],
        },
        { name: 'notes', label: 'Report Details & Findings', type: 'textarea', placeholder: 'Enter report summary for doctor...' },
      ],
      submitLabel: 'Generate Report',
      onSubmit: async (values) => {
        await createMedicalRecordEntry(values);
        await loadDashboardData();
        refreshApp();
        toast('Nursing report generated and saved to patient chart.');
      },
    });
  };

  window.pedicare.handleAppointmentStatus = async (apptId, newStatus) => {
    await updateAppointmentStatus(apptId, newStatus);
    await loadDashboardData();
    refreshApp();
    toast(`Appointment status updated to ${newStatus}.`);
  };
}
