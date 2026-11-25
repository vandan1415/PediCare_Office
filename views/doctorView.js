// PediCare Office — Doctor Dashboard & Clinical Subpages

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
  createPrescription,
  createExaminationAndNote,
  createMedicalRecordEntry,
  loadDashboardData,
} from '../api.js';
import { supabase } from '../supabaseClient.js';

export function renderDoctorDashboardContent() {
  const patient = getSelectedPatient() || {
    id: 0,
    full_name: 'Benjamin Thompson',
    patient_code: 'PC-6821',
    date_of_birth: '2018-03-22',
    gender: 'Male',
    blood_group: 'O+',
    allergies: 'Seasonal Allergies',
    emergency_contact_phone: '+1 555 246 8214',
    last_visit_date: '2025-05-12',
  };

  if (state.page === 'find-patient') {
    return renderDoctorFindPatientSubpage();
  }
  if (state.page === 'patient-history') {
    return renderDoctorPatientHistorySubpage(patient);
  }
  if (state.page === 'physical-examination') {
    return renderDoctorExaminationSubpage(patient);
  }
  if (state.page === 'prescription') {
    return renderDoctorPrescriptionSubpage(patient);
  }

  const patientHistory = state.medicalRecords.filter(
    (r) => Number(r.patient_id) === Number(patient.id)
  );
  const patientExams = state.examinations.filter(
    (e) => Number(e.patient_id) === Number(patient.id)
  );
  const latestExam = patientExams[0] || {
    temperature_f: 98.6,
    heart_rate_bpm: 92,
    respiratory_rate_min: 20,
    weight_kg: 21.4,
    findings:
      'Patient appears well. Mild wheezing in the upper respiratory tract. No fever detected. Throat appears slightly inflamed.',
    recommendations:
      'Increase fluid intake. Rest for 48 hours. Monitor temperature every 6 hours. Follow up if wheezing persists beyond 3 days.',
  };

  const patientVitals = state.vitalSigns.filter(
    (v) => Number(v.patient_id) === Number(patient.id)
  );
  const latestVital = patientVitals[0] || {};
  const tempDisplay = latestExam.temperature_f || latestVital.temperature_f || '98.6';
  const hrDisplay = latestExam.heart_rate_bpm || latestVital.heart_rate_bpm || '92';
  const respDisplay = latestExam.respiratory_rate_min || latestVital.respiratory_rate_min || '20';
  const weightDisplay = latestExam.weight_kg || latestVital.weight_kg || '21.4';

  const patientRx = state.prescriptions.filter(
    (rx) => Number(rx.patient_id) === Number(patient.id) && rx.status === 'active'
  );
  const primaryRx = patientRx[0] || {
    medication_name: 'Albuterol Inhaler 90mcg',
    instructions: '2 puffs every 4-6 hours as needed for wheezing',
  };

  return `
    <div class="row">
      <div>
        <h1>Doctor Dashboard</h1>
        <div class="sub">Review patient records, examination findings, and manage prescriptions.</div>
      </div>
      <div class="actions">
        <button onclick="window.pedicare.openNewPrescriptionModal()">✎ New Prescription</button>
        <button onclick="window.pedicare.openAddClinicalNoteModal()">▤ Add Note</button>
      </div>
    </div>

    <div class="grid grid2">
      <section class="card">
        <h3>⌕ Find Patient</h3>
        <div class="searchrow">
          <input id="docSearch" placeholder="Enter Patient Name or ID (e.g. Emma, PC-56801)...">
          <button class="primary" onclick="window.pedicare.handleDoctorPatientSearch()">Search</button>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <small style="color:#657187">Quick Switch:</small>
          ${state.patients
            .map(
              (p) =>
                `<button style="padding:5px 10px;font-size:12px;${Number(p.id) === Number(patient.id) ? 'background:#092d78;color:#fff;border-color:#092d78' : ''}" onclick="window.pedicare.selectPatient(${p.id})">${escapeHtml(p.full_name)} (${escapeHtml(p.patient_code)})</button>`
            )
            .join('')}
        </div>
      </section>
      <section class="card">
        <h3>Selected Patient</h3>
        <div class="patient-summary">
          <strong id="selectedName">${escapeHtml(patient.full_name)}</strong>
          <p style="margin:8px 0 0">ID: <span id="selectedId">${escapeHtml(patient.patient_code)}</span></p>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:18px">
      <h3>▣ Patient Overview</h3>
      <div class="grid grid4">
        <div>♧ <small class="label">Age</small><strong>${escapeHtml(calculateAge(patient.date_of_birth))}</strong></div>
        <div>♟ <small class="label">Gender</small><strong>${escapeHtml(patient.gender)}</strong></div>
        <div>♢ <small class="label">Blood Group</small><strong>${escapeHtml(patient.blood_group || 'O+')}</strong></div>
        <div>☎ <small class="label">Contact</small><strong>${escapeHtml(patient.emergency_contact_phone || '+1 555 246 8214')}</strong></div>
        <div>❀ <small class="label">Allergies</small><strong>${escapeHtml(patient.allergies || 'None reported')}</strong></div>
        <div>▣ <small class="label">Last Visit</small><strong>${escapeHtml(formatDate(patient.last_visit_date))}</strong></div>
      </div>
    </section>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <div class="row">
          <h3>⌕ Recent Medical History</h3>
          <button onclick="window.pedicare.navigate('patient-history')">View All</button>
        </div>
        ${
          patientHistory.length
            ? patientHistory
                .slice(0, 4)
                .map(
                  (rec) => `
                  <div class="history-item">
                    <span>
                      <b>${escapeHtml(rec.condition_title)}</b><br>
                      <small>${escapeHtml(formatDate(rec.diagnosed_date))}</small>
                    </span>
                    <button onclick="window.pedicare.openMedicalRecordModal(${rec.id})">›</button>
                  </div>`
                )
                .join('')
            : '<p style="color:#657187;font-size:13px">No medical history records found for this patient.</p>'
        }
      </section>

      <section class="card">
        <div class="row">
          <h3>⌕ Today's Examination</h3>
          <button onclick="window.pedicare.openAddClinicalNoteModal()">Record Exam</button>
        </div>
        <p style="font-size:13px">Vitals</p>
        <div class="mini-grid">
          <div class="mini"><small>Temperature</small><strong>${escapeHtml(tempDisplay)} °F</strong></div>
          <div class="mini"><small>Heart Rate</small><strong>${escapeHtml(hrDisplay)} bpm</strong></div>
          <div class="mini"><small>Respiratory Rate</small><strong>${escapeHtml(respDisplay)} /min</strong></div>
          <div class="mini"><small>Weight</small><strong>${escapeHtml(weightDisplay)} kg</strong></div>
        </div>
        <p style="font-size:13px;margin-top:18px">Notes</p>
        <div class="hint">${escapeHtml(latestExam.findings)}</div>
      </section>
    </div>

    <section class="card" style="margin-top:18px">
      <div class="row">
        <div>
          <h3>▣ Prescription Summary</h3>
          <b>${escapeHtml(primaryRx.medication_name)}</b>
          <p style="font-size:13px;margin:6px 0">${escapeHtml(primaryRx.instructions)}</p>
        </div>
        <div style="text-align:center">
          <b style="font-size:25px">${patientRx.length}</b>
          <small style="display:block">Total Medications</small>
        </div>
        <button class="primary" onclick="window.pedicare.navigate('prescription')">View Prescription</button>
      </div>
    </section>

    <section class="card" style="margin-top:18px">
      <div class="row">
        <h3>♡ Recommendations</h3>
        <button onclick="window.pedicare.openAddClinicalNoteModal()">Update Recommendations</button>
      </div>
      ${escapeHtml(latestExam.recommendations || 'Increase fluid intake. Rest for 48 hours. Monitor temperature every 6 hours.')}
    </section>
  `;
}

function renderDoctorFindPatientSubpage() {
  const q = (state.searchQuery || '').toLowerCase();
  const filtered = state.patients.filter(
    (p) =>
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.patient_code.toLowerCase().includes(q) ||
      (p.allergies || '').toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Find Patient</h1>
        <div class="sub">Search the pediatric patient registry and select a patient to load their clinical chart.</div>
      </div>
      <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search by patient name, ID (PC-...), or allergy...">
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
            <th>Last Visit</th>
            <th>Action</th>
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
                <td>${escapeHtml(formatDate(p.last_visit_date))}</td>
                <td><button class="primary" style="padding:7px 12px" onclick="window.pedicare.selectPatientAndGoDashboard(${p.id})">Open Chart</button></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderDoctorPatientHistorySubpage(patient) {
  const records = state.medicalRecords.filter((r) => Number(r.patient_id) === Number(patient.id));
  return `
    <div class="row">
      <div>
        <h1>Patient History — ${escapeHtml(patient.full_name)} (${escapeHtml(patient.patient_code)})</h1>
        <div class="sub">Complete diagnosis, allergy, immunization, and clinical history for the selected patient.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAddMedicalHistoryModal()">＋ Add History Entry</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      ${
        records.length
          ? records
              .map(
                (r) => `
                <div class="history-item">
                  <span>
                    <b>${escapeHtml(r.condition_title)}</b> <small>(${escapeHtml(r.record_type)} · ${escapeHtml(r.severity || 'Normal')})</small><br>
                    <small>${escapeHtml(formatDate(r.diagnosed_date))} — ${escapeHtml(r.notes || 'No extra notes')}</small>
                  </span>
                  <div class="actions">
                    <span style="font-size:12px;font-weight:700;color:#092d78;align-self:center">${escapeHtml(r.status)}</span>
                    <button onclick="window.pedicare.openMedicalRecordModal(${r.id})">Edit</button>
                  </div>
                </div>`
              )
              .join('')
          : '<p style="color:#657187;font-size:13px">No medical history records found for this patient.</p>'
      }
    </section>
  `;
}

function renderDoctorExaminationSubpage(patient) {
  const exams = state.examinations.filter((e) => Number(e.patient_id) === Number(patient.id));
  return `
    <div class="row">
      <div>
        <h1>Physical Examinations — ${escapeHtml(patient.full_name)} (${escapeHtml(patient.patient_code)})</h1>
        <div class="sub">Review and record physical examination findings, vitals, diagnoses, and care recommendations.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openAddClinicalNoteModal()">＋ Record New Examination</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      ${
        exams.length
          ? exams
              .map(
                (ex) => `
                <div class="visit" style="align-items:flex-start;flex-direction:column">
                  <div class="row" style="width:100%">
                    <strong>${escapeHtml(ex.diagnosis || 'Clinical Examination')} — ${escapeHtml(formatDate(ex.exam_date))}</strong>
                    <small style="color:#5e6b80">Temp: ${escapeHtml(ex.temperature_f)} °F · HR: ${escapeHtml(ex.heart_rate_bpm)} bpm · Resp: ${escapeHtml(ex.respiratory_rate_min)} /min · Weight: ${escapeHtml(ex.weight_kg)} kg</small>
                  </div>
                  <div style="font-size:13px;color:#27364f;margin-top:6px"><b>Findings:</b> ${escapeHtml(ex.findings)}</div>
                  <div style="font-size:13px;color:#087443;margin-top:4px"><b>Recommendations:</b> ${escapeHtml(ex.recommendations || 'None')}</div>
                </div>`
              )
              .join('')
          : '<p style="color:#657187;font-size:13px">No physical examinations recorded yet for this patient.</p>'
      }
    </section>
  `;
}

function renderDoctorPrescriptionSubpage(patient) {
  const rxList = state.prescriptions.filter((r) => Number(r.patient_id) === Number(patient.id));
  return `
    <div class="row">
      <div>
        <h1>Prescriptions — ${escapeHtml(patient.full_name)} (${escapeHtml(patient.patient_code)})</h1>
        <div class="sub">Manage active and past prescriptions for the selected patient.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openNewPrescriptionModal()">✎ New Prescription</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Instructions</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${
            rxList.length
              ? rxList
                  .map(
                    (rx) => `
                    <tr>
                      <td>${escapeHtml(formatDate(rx.prescribed_date))}</td>
                      <td><b>${escapeHtml(rx.medication_name)}</b></td>
                      <td>${escapeHtml(rx.dosage)}</td>
                      <td>${escapeHtml(rx.instructions)}</td>
                      <td>${escapeHtml(rx.duration || '7 days')}</td>
                      <td><strong>${escapeHtml(rx.status.toUpperCase())}</strong></td>
                      <td>
                        <button style="padding:6px 10px" onclick="window.pedicare.togglePrescriptionStatus(${rx.id}, '${rx.status === 'active' ? 'completed' : 'active'}')">
                          ${rx.status === 'active' ? 'Mark Completed' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>`
                  )
                  .join('')
              : '<tr><td colspan="7">No prescriptions recorded for this patient.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

export function registerDoctorActions(refreshApp) {
  window.pedicare.selectPatient = (patientId) => {
    state.selectedPatientId = Number(patientId);
    refreshApp();
    const p = getSelectedPatient();
    if (p) toast(`Selected patient: ${p.full_name} (${p.patient_code})`);
  };

  window.pedicare.selectPatientAndGoDashboard = (patientId) => {
    state.selectedPatientId = Number(patientId);
    state.page = 'dashboard';
    refreshApp();
    const p = getSelectedPatient();
    if (p) toast(`Loaded clinical chart for ${p.full_name}`);
  };

  window.pedicare.handleDoctorPatientSearch = () => {
    const q = ($('#docSearch')?.value || '').trim().toLowerCase();
    if (!q) {
      toast('Enter a patient name or ID to search.', true);
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
    toast(`Loaded record for ${match.full_name} (${match.patient_code}).`);
  };

  window.pedicare.openNewPrescriptionModal = () => {
    const patient = getSelectedPatient();
    showFormModal({
      title: 'New Prescription',
      description: `Create a prescription for ${patient?.full_name || 'selected patient'}.`,
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(patient?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        { name: 'medication_name', label: 'Medication', placeholder: 'e.g. Amoxicillin Oral Suspension 250mg/5mL' },
        { name: 'dosage', label: 'Dosage', placeholder: 'e.g. 5 mL (250 mg)' },
        { name: 'instructions', label: 'Instructions', type: 'textarea', placeholder: 'e.g. Take 5 mL by mouth every 8 hours with food' },
        { name: 'duration', label: 'Duration', value: '10 days' },
        { name: 'refills', label: 'Refills', type: 'number', value: '1' },
      ],
      submitLabel: 'Prescribe Medication',
      onSubmit: async (values) => {
        await createPrescription(values);
        await loadDashboardData();
        refreshApp();
        toast('Prescription saved to patient chart.');
      },
    });
  };

  window.pedicare.openAddClinicalNoteModal = () => {
    const patient = getSelectedPatient();
    const latestExam =
      state.examinations.find((e) => Number(e.patient_id) === Number(patient?.id)) || {};

    showFormModal({
      title: 'Add Clinical Examination & Note',
      description: `Record physical examination findings and care recommendations for ${patient?.full_name || 'patient'}.`,
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(patient?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        { name: 'diagnosis', label: 'Primary Diagnosis / Impression', value: latestExam.diagnosis || 'Upper Respiratory Check' },
        { name: 'temperature_f', label: 'Temperature (°F)', type: 'number', value: String(latestExam.temperature_f || 98.6) },
        { name: 'heart_rate_bpm', label: 'Heart Rate (bpm)', type: 'number', value: String(latestExam.heart_rate_bpm || 90) },
        { name: 'respiratory_rate_min', label: 'Respiratory Rate (/min)', type: 'number', value: String(latestExam.respiratory_rate_min || 20) },
        { name: 'weight_kg', label: 'Weight (kg)', type: 'number', value: String(latestExam.weight_kg || 21.4) },
        { name: 'findings', label: 'Clinical Examination Notes', type: 'textarea', value: latestExam.findings || '' },
        { name: 'recommendations', label: 'Care Recommendations', type: 'textarea', value: latestExam.recommendations || '' },
        {
          name: 'create_visit_summary',
          label: 'Publish to Patient Portal Visit Summaries?',
          type: 'select',
          value: 'yes',
          options: [
            { value: 'yes', label: 'Yes — Publish Visit Summary for Guardian' },
            { value: 'no', label: 'No — Internal Clinical Chart Only' },
          ],
        },
      ],
      submitLabel: 'Save Examination',
      onSubmit: async (values) => {
        await createExaminationAndNote(values);
        await loadDashboardData();
        refreshApp();
        toast('Clinical examination and notes saved.');
      },
    });
  };

  window.pedicare.openAddMedicalHistoryModal = () => {
    const patient = getSelectedPatient();
    showFormModal({
      title: 'Add Medical History Record',
      description: `Add a condition, allergy, immunization, or lab record for ${patient?.full_name || 'patient'}.`,
      fields: [
        {
          name: 'patient_id',
          label: 'Patient',
          type: 'select',
          value: String(patient?.id || ''),
          options: state.patients.map((p) => ({
            value: String(p.id),
            label: `${p.full_name} (${p.patient_code})`,
          })),
        },
        { name: 'condition_title', label: 'Condition / Record Title', placeholder: 'e.g. Mild Seasonal Asthma' },
        {
          name: 'record_type',
          label: 'Record Type',
          type: 'select',
          value: 'diagnosis',
          options: [
            { value: 'diagnosis', label: 'Diagnosis' },
            { value: 'allergy', label: 'Allergy' },
            { value: 'immunization', label: 'Immunization' },
            { value: 'lab_result', label: 'Lab Result' },
          ],
        },
        {
          name: 'severity',
          label: 'Severity',
          type: 'select',
          value: 'Mild',
          options: [
            { value: 'Normal', label: 'Normal' },
            { value: 'Mild', label: 'Mild' },
            { value: 'Moderate', label: 'Moderate' },
            { value: 'Severe', label: 'Severe' },
          ],
        },
        { name: 'notes', label: 'Clinical Notes', type: 'textarea', placeholder: 'Enter clinical details...' },
      ],
      submitLabel: 'Save Record',
      onSubmit: async (values) => {
        await createMedicalRecordEntry(values);
        await loadDashboardData();
        refreshApp();
        toast('Medical history record added.');
      },
    });
  };

  window.pedicare.openMedicalRecordModal = (recId) => {
    const rec = state.medicalRecords.find((r) => Number(r.id) === Number(recId));
    if (!rec) return;
    showFormModal({
      title: `Medical History — ${rec.condition_title}`,
      description: `Diagnosed: ${formatDate(rec.diagnosed_date)} · Type: ${rec.record_type}`,
      fields: [
        { name: 'condition_title', label: 'Condition Title', value: rec.condition_title },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          value: rec.status || 'Active',
          options: [
            { value: 'Active', label: 'Active' },
            { value: 'Managed', label: 'Managed' },
            { value: 'Resolved', label: 'Resolved' },
            { value: 'Completed', label: 'Completed' },
          ],
        },
        { name: 'notes', label: 'Clinical Notes', type: 'textarea', value: rec.notes || '' },
      ],
      submitLabel: 'Update Record',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('medical_records')
          .update({
            condition_title: values.condition_title,
            status: values.status,
            notes: values.notes,
          })
          .eq('id', rec.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Medical history record updated.');
      },
    });
  };

  window.pedicare.togglePrescriptionStatus = async (rxId, newStatus) => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ status: newStatus })
      .eq('id', rxId);
    if (error) {
      toast(error.message, true);
      return;
    }
    await loadDashboardData();
    refreshApp();
    toast(`Prescription marked as ${newStatus}.`);
  };
}
