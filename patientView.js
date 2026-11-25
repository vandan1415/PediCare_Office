// PediCare Office — Patient / Parent / Guardian Portal View

import {
  state,
  escapeHtml,
  formatDate,
  calculateAge,
  showFormModal,
  toast,
} from '../state.js';
import {
  getSelectedPatient,
  updateGuardianAndPatientInfo,
  createNewChildForGuardian,
  sendClinicMessage,
  markMessageRead,
  createAppointment,
  loadDashboardData,
} from '../api.js';
import { supabase } from '../supabaseClient.js';

export function renderGrowthChartSvg(growthRows = []) {
  // If growth records exist for this child, compute dynamic coordinates; fallback to standard curve
  const sorted = [...growthRows].sort((a, b) => Number(a.age_years) - Number(b.age_years));
  const xCoords = [35, 210, 390, 570, 750, 880];

  let heightPoints = '35,205 210,165 390,125 570,85 750,45 880,25';
  let weightPoints = '35,145 210,115 390,85 570,55 750,35 880,45';
  let ageLabels = ['2 Years', '3 Years', '4 Years', '5 Years', '6 Years'];

  if (sorted.length >= 2) {
    const ptsH = [];
    const ptsW = [];
    ageLabels = [];
    sorted.slice(0, 6).forEach((row, idx) => {
      const x = xCoords[idx] || 880;
      const hVal = Number(row.height_in) || 38;
      const wVal = Number(row.weight_lbs) || 34;
      // Map [28..48] onto y=[205..25]
      const yH = Math.max(20, Math.min(205, Math.round(205 - ((hVal - 28) / 20) * 180)));
      const yW = Math.max(20, Math.min(205, Math.round(205 - ((wVal - 26) / 22) * 175)));
      ptsH.push(`${x},${yH}`);
      ptsW.push(`${x},${yW}`);
      ageLabels.push(`${Math.round(Number(row.age_years))} Years`);
    });
    if (ptsH.length === 5) {
      const lastH = ptsH[ptsH.length - 1].split(',')[1];
      const lastW = ptsW[ptsW.length - 1].split(',')[1];
      ptsH.push(`880,${Math.max(22, Number(lastH) - 12)}`);
      ptsW.push(`880,${Math.max(28, Number(lastW) - 6)}`);
    }
    heightPoints = ptsH.join(' ');
    weightPoints = ptsW.join(' ');
  }

  const hPath = 'M' + heightPoints.split(' ').join(' L') + ' L880 205 L35 205 Z';
  const wPath = 'M' + weightPoints.split(' ').join(' L') + ' L880 205 L35 205 Z';

  return `<div class="chart"><svg viewBox="0 0 900 230" preserveAspectRatio="none"><g stroke="#e6eaf1" stroke-width="1">${[30, 65, 100, 135, 170, 205]
    .map((y) => `<line x1="35" y1="${y}" x2="880" y2="${y}"/>`)
    .join('')}</g><path d="${hPath}" fill="#6e9bc7" opacity=".55"/><path d="${wPath}" fill="#08aaa9" opacity=".12"/><polyline points="${heightPoints}" fill="none" stroke="#174a9a" stroke-width="3"/><polyline points="${weightPoints}" fill="none" stroke="#05aaa9" stroke-width="3"/><g fill="#123d8c" font-size="12"><text x="5" y="210">28</text><text x="5" y="175">34</text><text x="5" y="140">38</text><text x="5" y="105">42</text><text x="5" y="70">44</text><text x="5" y="35">46</text></g><g fill="#4e5e78" font-size="12" text-anchor="middle">${[35, 210, 390, 570, 750]
    .map((x, i) => `<text x="${x}" y="225">${escapeHtml(ageLabels[i] || `${i + 2} Years`)}</text>`)
    .join('')}</g></svg></div>`;
}

export function renderPatientDashboardContent() {
  const guardian = state.guardians[0] || {};
  const patient = getSelectedPatient() || {
    full_name: 'Leo Jenkins',
    patient_code: 'PC-56801',
    date_of_birth: '2018-05-14',
    gender: 'Male',
    blood_group: 'O+',
    allergies: 'Seasonal Allergies',
  };

  const patientVisits = state.visitSummaries.filter(
    (v) => Number(v.patient_id) === Number(patient.id)
  );
  const patientGrowth = state.growthRecords.filter(
    (g) => Number(g.patient_id) === Number(patient.id)
  );
  const unreadMessages = state.messages.filter(
    (m) => !m.is_read && m.sender_id !== state.profile?.id
  );
  const latestMsg = state.messages[0] || {
    sender_name: 'Dr. Emily Thorne',
    subject: 'Follow-up on Lab Results',
    body: "Hello Sarah, I've reviewed Leo's recent blood work and everything looks excellent. No changes needed to his current routine.",
  };

  const childSelectorHtml =
    state.patients.length > 1
      ? `<select id="guardianChildSelect" style="padding:8px 12px;border-radius:7px;border:1px solid #d5d9e0;font-size:13px;font-weight:600">${state.patients
          .map(
            (p) =>
              `<option value="${p.id}" ${Number(p.id) === Number(patient.id) ? 'selected' : ''}>${escapeHtml(p.full_name)} (${escapeHtml(p.patient_code)})</option>`
          )
          .join('')}</select>`
      : '';

  if (state.page === 'my-information') {
    return renderGuardianMyInformationSubpage(guardian, patient);
  }
  if (state.page === 'visit-summaries') {
    return renderGuardianVisitSummariesSubpage(patient, patientVisits);
  }
  if (state.page === 'messages') {
    return renderGuardianMessagesSubpage(patient);
  }

  const insuranceText =
    guardian.insurance_provider && guardian.insurance_policy_number
      ? `${guardian.insurance_provider} - ${guardian.insurance_policy_number}`
      : patient.insurance_info || 'BlueCare Health - #BC9982100';

  const pharmacyName = guardian.pharmacy_name || 'CVS Pharmacy #4402';
  const pharmacyAddress = guardian.pharmacy_address || '123 Maple St, Springfield';

  return `
    <div class="row" style="flex-wrap:wrap;margin-bottom:6px">
      <div>
        <h1>Patient Portal</h1>
        <div class="sub">Manage your information and stay connected with your pediatric care team.</div>
      </div>
      <div class="actions">
        ${childSelectorHtml}
        <button onclick="window.pedicare.openBookAppointmentModal()">📅 Book Appointment</button>
        <button onclick="window.pedicare.openAddChildModal()">＋ Add Child</button>
      </div>
    </div>
    <section class="card">
      <div class="row">
        <h3>▣ &nbsp; My Information</h3>
        <button class="primary" onclick="window.pedicare.openEditPatientInfoModal()">View / Edit Information</button>
      </div>
      <div class="patient-info">
        <div>
          <div class="label">Patient Name</div>
          <div class="value">${escapeHtml(patient.full_name)} <small style="color:#5e6b80;font-weight:500">(${escapeHtml(patient.patient_code || 'PC-56801')})</small></div>
          <div class="label">Date of Birth</div>
          <div class="value">${escapeHtml(formatDate(patient.date_of_birth))} (${escapeHtml(calculateAge(patient.date_of_birth))})</div>
        </div>
        <div>
          <div class="label">Contact Information</div>
          <div class="value">${escapeHtml(state.profile?.email || 'sarah.j@email.com')}<br>${escapeHtml(guardian.phone || state.profile?.phone || '(555) 123-4567')}</div>
          <div class="label">Insurance Information</div>
          <div class="value">${escapeHtml(insuranceText)}</div>
        </div>
        <div>
          <div class="label">Pharmacy Information</div>
          <div class="value">${escapeHtml(pharmacyName)}<br>${escapeHtml(pharmacyAddress)}</div>
          <div class="label">Allergies &amp; Blood Group</div>
          <div class="value">${escapeHtml(patient.allergies || 'None')} · ${escapeHtml(patient.blood_group || 'O+')}</div>
        </div>
      </div>
    </section>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <div class="row">
          <h3>◴ &nbsp; Visit Summaries</h3>
          <button onclick="window.pedicare.navigate('visit-summaries')">View All</button>
        </div>
        ${
          patientVisits.length
            ? patientVisits
                .slice(0, 3)
                .map(
                  (v) => `
                  <div class="visit">
                    <div class="datebox">${escapeHtml(v.date_label || formatDate(v.visit_date).slice(0, 6))}</div>
                    <div class="detail">
                      <strong>${escapeHtml(v.visit_title)}</strong>
                      <small>${escapeHtml(v.provider_summary)}</small>
                    </div>
                    <button onclick="window.pedicare.openVisitSummaryDetailModal(${v.id})">View Visit Summary</button>
                  </div>`
                )
                .join('')
            : `<p style="color:#657187;font-size:13px">No visit summaries recorded yet for ${escapeHtml(patient.full_name)}.</p>`
        }
      </section>

      <section class="card">
        <div class="row">
          <h3>● &nbsp; Messages</h3>
          <span style="color:#d44;background:#ffeded;border-radius:15px;padding:4px 10px;font-size:12px">${unreadMessages.length} New</span>
        </div>
        <div class="msg">
          <strong>Sender: ${escapeHtml(latestMsg.sender_name)}</strong>
          <b>${escapeHtml(latestMsg.subject)}</b><br>
          ${escapeHtml(latestMsg.body)}
        </div>
        <div class="actions" style="margin-top:16px">
          <button class="primary" onclick="window.pedicare.openSendMessageModal()">➤ Send</button>
          <button onclick="window.pedicare.navigate('messages')">View Messages</button>
        </div>
        <small style="display:block;color:#8a94a4;margin-top:15px">Messages are for non-emergency medical questions only. In case of emergency, please dial 9-1-1 immediately.</small>
      </section>
    </div>

    <section class="card" style="margin-top:18px">
      <div class="row">
        <h3>Growth Tracking Overview (${escapeHtml(patient.full_name)})</h3>
        <small style="color:#5e6b80">Blue: Height (in) · Teal: Weight (lbs)</small>
      </div>
      ${renderGrowthChartSvg(patientGrowth)}
    </section>
  `;
}

function renderGuardianMyInformationSubpage(guardian, patient) {
  const rxList = state.prescriptions.filter((r) => Number(r.patient_id) === Number(patient.id));
  const medList = state.medicalRecords.filter((m) => Number(m.patient_id) === Number(patient.id));

  return `
    <div class="row">
      <div>
        <h1>My Information &amp; Child Health Profile</h1>
        <div class="sub">Review and update guardian contact details, child demographics, insurance, and active medications.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openEditPatientInfoModal()">✎ Edit Profile &amp; Insurance</button>
        <button onclick="window.pedicare.openAddChildModal()">＋ Add Child</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <h3>Patient &amp; Guardian Details</h3>
      <div class="patient-info">
        <div>
          <div class="label">Patient Full Name</div>
          <div class="value">${escapeHtml(patient.full_name)} (${escapeHtml(patient.patient_code)})</div>
          <div class="label">Date of Birth &amp; Gender</div>
          <div class="value">${escapeHtml(formatDate(patient.date_of_birth))} · ${escapeHtml(patient.gender)}</div>
          <div class="label">Blood Group &amp; Allergies</div>
          <div class="value">${escapeHtml(patient.blood_group || 'O+')} · ${escapeHtml(patient.allergies || 'None')}</div>
        </div>
        <div>
          <div class="label">Guardian Name &amp; Relationship</div>
          <div class="value">${escapeHtml(state.profile?.full_name)} (${escapeHtml(guardian.relationship || 'Parent')})</div>
          <div class="label">Email &amp; Phone</div>
          <div class="value">${escapeHtml(state.profile?.email)}<br>${escapeHtml(guardian.phone || state.profile?.phone || '')}</div>
          <div class="label">Home Address</div>
          <div class="value">${escapeHtml(guardian.address || '742 Evergreen Terrace, Springfield')}</div>
        </div>
        <div>
          <div class="label">Insurance Provider &amp; Policy</div>
          <div class="value">${escapeHtml(guardian.insurance_provider || 'BlueCare Health')}<br>${escapeHtml(guardian.insurance_policy_number || '#BC9982100')}</div>
          <div class="label">Preferred Pharmacy</div>
          <div class="value">${escapeHtml(guardian.pharmacy_name || 'CVS Pharmacy #4402')}<br>${escapeHtml(guardian.pharmacy_address || '123 Maple St, Springfield')}</div>
        </div>
      </div>
    </section>

    <div class="grid grid2" style="margin-top:18px">
      <section class="card">
        <h3>Active Prescriptions (${rxList.length})</h3>
        ${
          rxList.length
            ? rxList
                .map(
                  (rx) => `
                  <div class="history-item">
                    <span>
                      <b>${escapeHtml(rx.medication_name)} (${escapeHtml(rx.dosage)})</b><br>
                      <small>${escapeHtml(rx.instructions)} · Duration: ${escapeHtml(rx.duration || 'As directed')}</small>
                    </span>
                    <span style="font-size:12px;font-weight:700;color:#087443">${escapeHtml(rx.status.toUpperCase())}</span>
                  </div>`
                )
                .join('')
            : '<p style="color:#657187;font-size:13px">No active prescriptions on file.</p>'
        }
      </section>

      <section class="card">
        <h3>Medical &amp; Immunization Records (${medList.length})</h3>
        ${
          medList.length
            ? medList
                .map(
                  (m) => `
                  <div class="history-item">
                    <span>
                      <b>${escapeHtml(m.condition_title)}</b> <small>(${escapeHtml(m.record_type)})</small><br>
                      <small>${escapeHtml(formatDate(m.diagnosed_date))} — ${escapeHtml(m.notes || '')}</small>
                    </span>
                    <span style="font-size:12px;color:#123575;font-weight:600">${escapeHtml(m.status)}</span>
                  </div>`
                )
                .join('')
            : '<p style="color:#657187;font-size:13px">No medical records on file.</p>'
        }
      </section>
    </div>
  `;
}

function renderGuardianVisitSummariesSubpage(patient, visits) {
  const appts = state.appointments.filter((a) => Number(a.patient_id) === Number(patient.id));
  const q = (state.searchQuery || '').toLowerCase();
  const filteredVisits = visits.filter(
    (v) =>
      !q ||
      v.visit_title.toLowerCase().includes(q) ||
      v.provider_summary.toLowerCase().includes(q) ||
      (v.summary_details || '').toLowerCase().includes(q)
  );

  return `
    <div class="row">
      <div>
        <h1>Visit Summaries &amp; Appointments</h1>
        <div class="sub">Review past visit summaries, clinical care recommendations, and scheduled appointments for ${escapeHtml(patient.full_name)}.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openBookAppointmentModal()">＋ Book Appointment</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <div class="searchrow">
        <input id="subpageSearchInput" value="${escapeHtml(state.searchQuery)}" placeholder="Search visit summaries by title, doctor, or notes...">
        <button class="primary" onclick="window.pedicare.applySubpageSearch()">Search</button>
      </div>
      <div style="margin-top:16px">
        ${
          filteredVisits.length
            ? filteredVisits
                .map(
                  (v) => `
                  <div class="visit">
                    <div class="datebox">${escapeHtml(v.date_label || formatDate(v.visit_date).slice(0, 6))}</div>
                    <div class="detail">
                      <strong>${escapeHtml(v.visit_title)}</strong>
                      <small>${escapeHtml(v.provider_summary)} · ${escapeHtml(formatDate(v.visit_date))}</small>
                      <small style="color:#27364f;margin-top:4px">${escapeHtml(v.summary_details)}</small>
                    </div>
                    <button onclick="window.pedicare.openVisitSummaryDetailModal(${v.id})">View Visit Summary</button>
                  </div>`
                )
                .join('')
            : '<p style="color:#657187;font-size:13px">No matching visit summaries found.</p>'
        }
      </div>
    </section>

    <section class="card" style="margin-top:18px">
      <h3>Scheduled &amp; Recent Appointments (${appts.length})</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Date / Time</th>
            <th>Visit Type</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            appts.length
              ? appts
                  .map(
                    (a) => `
                    <tr>
                      <td><b>${escapeHtml(a.appointment_code)}</b></td>
                      <td>${escapeHtml(formatDate(a.scheduled_at))} · ${escapeHtml(a.appointment_time_label)}</td>
                      <td>${escapeHtml(a.visit_type)}</td>
                      <td>${escapeHtml(a.reason || 'Routine visit')}</td>
                      <td><strong>${escapeHtml(a.status.toUpperCase())}</strong></td>
                    </tr>`
                  )
                  .join('')
              : '<tr><td colspan="5">No appointments scheduled yet.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

function renderGuardianMessagesSubpage(patient) {
  return `
    <div class="row">
      <div>
        <h1>Care Team Messages</h1>
        <div class="sub">Direct non-emergency communication with your child's pediatricians and nurses.</div>
      </div>
      <div class="actions">
        <button class="primary" onclick="window.pedicare.openSendMessageModal()">➤ Send New Message</button>
        <button onclick="window.pedicare.navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>

    <section class="card">
      <h3>Inbox &amp; Sent Messages (${state.messages.length})</h3>
      ${
        state.messages.length
          ? state.messages
              .map(
                (m) => `
                <div class="msg" style="margin-bottom:12px;background:${m.is_read ? '#f8faff' : '#eef4ff'}">
                  <div class="row">
                    <strong>From: ${escapeHtml(m.sender_name)} → To: ${escapeHtml(m.recipient_name)}</strong>
                    <small style="color:#5e6b80">${escapeHtml(formatDate(m.created_at))} ${!m.is_read ? '· <b style="color:#d44">NEW</b>' : ''}</small>
                  </div>
                  <b>${escapeHtml(m.subject)}</b><br>
                  <span>${escapeHtml(m.body)}</span>
                  <div class="actions" style="margin-top:10px">
                    ${
                      !m.is_read && m.sender_id !== state.profile?.id
                        ? `<button onclick="window.pedicare.handleMarkMessageRead(${m.id})">✓ Mark as Read</button>`
                        : ''
                    }
                    <button onclick="window.pedicare.openSendMessageModal('${escapeHtml(m.sender_id || '')}', 'Re: ${escapeHtml(m.subject)}')">↩ Reply</button>
                  </div>
                </div>`
              )
              .join('')
          : '<p style="color:#657187;font-size:13px">No messages yet.</p>'
      }
    </section>
  `;
}

export function registerPatientPortalActions(refreshApp) {
  window.pedicare.openEditPatientInfoModal = () => {
    const guardian = state.guardians[0] || {};
    const patient = getSelectedPatient() || {};
    showFormModal({
      title: 'Edit My Information',
      description: 'Update patient and guardian details in Supabase.',
      fields: [
        { name: 'guardian_name', label: 'Guardian Full Name', value: state.profile?.full_name || 'Sarah Jenkins' },
        { name: 'patient_name', label: 'Patient Name', value: patient.full_name || 'Leo Jenkins' },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', value: patient.date_of_birth || '2018-05-14' },
        {
          name: 'gender',
          label: 'Gender',
          type: 'select',
          value: patient.gender || 'Male',
          options: [
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other', label: 'Other' },
          ],
        },
        { name: 'blood_group', label: 'Blood Group', value: patient.blood_group || 'O+' },
        { name: 'allergies', label: 'Allergies', value: patient.allergies || 'Seasonal Allergies' },
        { name: 'phone', label: 'Phone Number', value: guardian.phone || state.profile?.phone || '(555) 123-4567' },
        { name: 'insurance_provider', label: 'Insurance Provider', value: guardian.insurance_provider || 'BlueCare Health' },
        { name: 'insurance_policy_number', label: 'Insurance Policy Number', value: guardian.insurance_policy_number || '#BC9982100' },
        { name: 'pharmacy_name', label: 'Pharmacy Name', value: guardian.pharmacy_name || 'CVS Pharmacy #4402' },
        { name: 'pharmacy_address', label: 'Pharmacy Address', value: guardian.pharmacy_address || '123 Maple St, Springfield' },
      ],
      submitLabel: 'Save Changes',
      onSubmit: async (values) => {
        await updateGuardianAndPatientInfo(patient.id, guardian.id, values);
        await loadDashboardData();
        refreshApp();
        toast('Patient and guardian information updated in database.');
      },
    });
  };

  window.pedicare.openAddChildModal = () => {
    const guardian = state.guardians[0];
    if (!guardian) {
      toast('Guardian record not found.', true);
      return;
    }
    showFormModal({
      title: 'Register Child Profile',
      description: 'Link an additional child to your guardian account.',
      fields: [
        { name: 'full_name', label: 'Child Full Name', placeholder: 'e.g. Mia Jenkins' },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', value: '2021-04-10' },
        {
          name: 'gender',
          label: 'Gender',
          type: 'select',
          value: 'Female',
          options: [
            { value: 'Female', label: 'Female' },
            { value: 'Male', label: 'Male' },
          ],
        },
        { name: 'blood_group', label: 'Blood Group', value: 'O+' },
        { name: 'allergies', label: 'Known Allergies', value: 'None reported' },
      ],
      submitLabel: 'Register Child',
      onSubmit: async (values) => {
        const created = await createNewChildForGuardian(guardian.id, values);
        state.selectedPatientId = created.id;
        await loadDashboardData();
        refreshApp();
        toast(`${created.full_name} (${created.patient_code}) registered!`);
      },
    });
  };

  window.pedicare.openVisitSummaryDetailModal = (visitId) => {
    const visit = state.visitSummaries.find((v) => Number(v.id) === Number(visitId));
    if (!visit) return;
    showFormModal({
      title: `Visit Summary — ${visit.visit_title}`,
      description: `${visit.provider_summary} (${formatDate(visit.visit_date)})`,
      fields: [
        { name: 'summary_ro', label: 'Clinical Summary', type: 'readonly', value: visit.summary_details, required: false },
        { name: 'rec_ro', label: 'Care Recommendations', type: 'readonly', value: visit.care_recommendations || 'Follow standard pediatric care plan.', required: false },
        {
          name: 'guardian_questions',
          label: 'Questions or Notes for Care Team',
          type: 'textarea',
          value: visit.guardian_questions || '',
          placeholder: 'Add follow-up questions for your pediatrician...',
          required: false,
        },
      ],
      submitLabel: 'Save Question',
      onSubmit: async (values) => {
        const { error } = await supabase
          .from('visit_summaries')
          .update({ guardian_questions: values.guardian_questions })
          .eq('id', visit.id);
        if (error) throw error;
        await loadDashboardData();
        refreshApp();
        toast('Your notes for this visit summary have been saved.');
      },
    });
  };

  window.pedicare.openSendMessageModal = (defaultRecipientId = '', defaultSubject = '') => {
    const patient = getSelectedPatient();
    const staffOptions = [
      ...state.doctors.map((d) => ({
        value: d.profile_id,
        label: `${d.profile?.full_name || 'Doctor'} (${d.specialty})`,
      })),
      ...state.nurses.map((n) => ({
        value: n.profile_id,
        label: `${n.profile?.full_name || 'Nurse'} (${n.title})`,
      })),
    ];

    showFormModal({
      title: 'Send Message',
      description: 'Write a non-emergency message to your pediatric care team.',
      fields: [
        {
          name: 'recipient_id',
          label: 'Recipient Care Provider',
          type: 'select',
          value: defaultRecipientId || staffOptions[0]?.value || '',
          options: staffOptions.length
            ? staffOptions
            : [{ value: '', label: 'Pediatric Care Team' }],
        },
        { name: 'subject', label: 'Subject', value: defaultSubject, placeholder: 'Enter subject' },
        { name: 'body', label: 'Message', type: 'textarea', placeholder: 'Enter message details' },
      ],
      submitLabel: 'Send Message',
      onSubmit: async (values) => {
        const chosen = staffOptions.find((s) => s.value === values.recipient_id);
        await sendClinicMessage({
          patient_id: patient?.id || null,
          recipient_id: values.recipient_id || null,
          recipient_name: chosen ? chosen.label.split(' (')[0] : 'Dr. Emily Thorne',
          subject: values.subject,
          body: values.body,
        });
        await loadDashboardData();
        refreshApp();
        toast('Message sent to your pediatric care team.');
      },
    });
  };

  window.pedicare.handleMarkMessageRead = async (msgId) => {
    await markMessageRead(msgId);
    await loadDashboardData();
    refreshApp();
    toast('Message marked as read.');
  };

  window.pedicare.openBookAppointmentModal = () => {
    const patient = getSelectedPatient();
    const doctorOptions = state.doctors.map((d) => ({
      value: String(d.id),
      label: `${d.profile?.full_name || 'Doctor'} — ${d.specialty}`,
    }));

    showFormModal({
      title: 'Book Pediatric Appointment',
      description: `Schedule an appointment for ${patient?.full_name || 'your child'}.`,
      fields: [
        {
          name: 'patient_id',
          label: 'Child / Patient',
          type: 'select',
          value: String(patient?.id || ''),
          options: state.patients.map((p) => ({ value: String(p.id), label: `${p.full_name} (${p.patient_code})` })),
        },
        {
          name: 'doctor_id',
          label: 'Preferred Pediatrician',
          type: 'select',
          value: String(doctorOptions[0]?.value || ''),
          options: doctorOptions,
        },
        {
          name: 'visit_type',
          label: 'Visit Type',
          type: 'select',
          value: 'Consultation',
          options: [
            { value: 'Annual Wellness Exam', label: 'Annual Wellness Exam' },
            { value: 'Consultation', label: 'Consultation' },
            { value: 'Follow Up', label: 'Follow Up' },
            { value: 'Vaccination', label: 'Vaccination' },
          ],
        },
        {
          name: 'appointment_time_label',
          label: 'Preferred Time Slot',
          type: 'select',
          value: '10:30 AM',
          options: [
            { value: '09:00 AM', label: '09:00 AM' },
            { value: '09:30 AM', label: '09:30 AM' },
            { value: '10:00 AM', label: '10:00 AM' },
            { value: '10:30 AM', label: '10:30 AM' },
            { value: '11:30 AM', label: '11:30 AM' },
            { value: '02:00 PM', label: '02:00 PM' },
          ],
        },
        { name: 'reason', label: 'Reason for Visit', type: 'textarea', placeholder: 'Describe symptoms or checkup needs...' },
      ],
      submitLabel: 'Confirm Booking',
      onSubmit: async (values) => {
        await createAppointment(values);
        await loadDashboardData();
        refreshApp();
        toast('Appointment booked and added to clinic schedule.');
      },
    });
  };
}
