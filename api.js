// PediCare Office — Supabase Data Access & Edge Function API Layer

import { supabase } from './supabaseClient.js';
import { SUPABASE_EDGE_FUNCTION_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { state, formatShortDate } from './state.js';

export async function callClinicEdgeFunction(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchCurrentUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function loadDashboardData() {
  if (!state.profile) return;
  const role = state.profile.role;

  // Always load doctors & nurses so names/rooms resolve cleanly across portals
  const [doctorsRes, nursesRes, profilesRes] = await Promise.all([
    supabase.from('doctors').select('*, profile:profiles(id, full_name, email, phone, is_active)').order('id'),
    supabase.from('nurses').select('*, profile:profiles(id, full_name, email, phone, is_active)').order('id'),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ]);

  state.doctors = doctorsRes.data || [];
  state.nurses = nursesRes.data || [];
  state.profiles = profilesRes.data || [];

  if (role === 'guardian') {
    const { data: guardianRows } = await supabase
      .from('guardians')
      .select('*, profile:profiles(id, full_name, email, phone, role, is_active)')
      .eq('profile_id', state.profile.id);

    state.guardians = guardianRows || [];
    const myGuardian = state.guardians[0];

    const { data: patientRows } = await supabase
      .from('patients')
      .select('*')
      .eq('guardian_id', myGuardian?.id || -1)
      .order('id');

    state.patients = patientRows || [];
    if (!state.selectedPatientId && state.patients.length > 0) {
      state.selectedPatientId = state.patients[0].id;
    } else if (
      state.selectedPatientId &&
      !state.patients.some((p) => p.id === Number(state.selectedPatientId))
    ) {
      state.selectedPatientId = state.patients[0]?.id || null;
    }

    const patientIds = state.patients.map((p) => p.id);
    if (patientIds.length > 0) {
      const [appts, visits, growth, msgs, rx, recs, vitals] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .in('patient_id', patientIds)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('visit_summaries')
          .select('*')
          .in('patient_id', patientIds)
          .order('visit_date', { ascending: false }),
        supabase
          .from('growth_records')
          .select('*')
          .in('patient_id', patientIds)
          .order('age_years', { ascending: true }),
        supabase
          .from('messages')
          .select('*')
          .or(`recipient_id.eq.${state.profile.id},sender_id.eq.${state.profile.id}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('prescriptions')
          .select('*')
          .in('patient_id', patientIds)
          .order('prescribed_date', { ascending: false }),
        supabase
          .from('medical_records')
          .select('*')
          .in('patient_id', patientIds)
          .order('diagnosed_date', { ascending: false }),
        supabase
          .from('vital_signs')
          .select('*')
          .in('patient_id', patientIds)
          .order('recorded_at', { ascending: false }),
      ]);

      state.appointments = appts.data || [];
      state.visitSummaries = visits.data || [];
      state.growthRecords = growth.data || [];
      state.messages = msgs.data || [];
      state.prescriptions = rx.data || [];
      state.medicalRecords = recs.data || [];
      state.vitalSigns = vitals.data || [];
    } else {
      state.appointments = [];
      state.visitSummaries = [];
      state.growthRecords = [];
      state.messages = [];
      state.prescriptions = [];
      state.medicalRecords = [];
      state.vitalSigns = [];
    }
    return;
  }

  // Staff & Admin load clinic-wide operational & clinical records
  const [
    guardiansRes,
    patientsRes,
    apptsRes,
    medRecsRes,
    examsRes,
    vitalsRes,
    rxRes,
    visitsRes,
    growthRes,
    msgsRes,
    tasksRes,
    adminsRes,
    logsRes,
  ] = await Promise.all([
    supabase
      .from('guardians')
      .select('*, profile:profiles!inner(id, full_name, email, phone, role, is_active)')
      .eq('profile.role', 'guardian')
      .order('id'),
    supabase.from('patients').select('*').order('id'),
    supabase.from('appointments').select('*').order('scheduled_at', { ascending: true }),
    supabase.from('medical_records').select('*').order('diagnosed_date', { ascending: false }),
    supabase.from('examinations').select('*').order('exam_date', { ascending: false }),
    supabase.from('vital_signs').select('*').order('recorded_at', { ascending: false }),
    supabase.from('prescriptions').select('*').order('prescribed_date', { ascending: false }),
    supabase.from('visit_summaries').select('*').order('visit_date', { ascending: false }),
    supabase.from('growth_records').select('*').order('age_years', { ascending: true }),
    supabase.from('messages').select('*').order('created_at', { ascending: false }),
    supabase.from('nurse_tasks').select('*').order('id', { ascending: true }),
    supabase.from('admins').select('*, profile:profiles(id, full_name, email, phone, is_active)').order('id'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  state.guardians = guardiansRes.data || [];
  state.patients = patientsRes.data || [];
  state.appointments = apptsRes.data || [];
  state.medicalRecords = medRecsRes.data || [];
  state.examinations = examsRes.data || [];
  state.vitalSigns = vitalsRes.data || [];
  state.prescriptions = rxRes.data || [];
  state.visitSummaries = visitsRes.data || [];
  state.growthRecords = growthRes.data || [];
  state.messages = msgsRes.data || [];
  state.nurseTasks = tasksRes.data || [];
  state.admins = adminsRes.data || [];
  state.auditLogs = logsRes.data || [];

  if (!state.selectedPatientId && state.patients.length > 0) {
    // Default Doctor dashboard to Benjamin Thompson (PC-6821) if present to match screenshot
    const ben = state.patients.find((p) => p.patient_code === 'PC-6821') || state.patients[0];
    state.selectedPatientId = ben.id;
  }
}

export function getSelectedPatient() {
  if (!state.patients.length) return null;
  return (
    state.patients.find((p) => Number(p.id) === Number(state.selectedPatientId)) ||
    state.patients[0]
  );
}

export async function updateGuardianAndPatientInfo(patientId, guardianId, payload) {
  if (patientId) {
    const { error: pErr } = await supabase
      .from('patients')
      .update({
        full_name: payload.patient_name,
        date_of_birth: payload.date_of_birth,
        gender: payload.gender,
        blood_group: payload.blood_group,
        allergies: payload.allergies,
        emergency_contact_phone: payload.phone,
        insurance_info: `${payload.insurance_provider} - ${payload.insurance_policy_number}`,
        pharmacy_info: `${payload.pharmacy_name}, ${payload.pharmacy_address}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', patientId);
    if (pErr) throw pErr;
  }

  if (guardianId) {
    const { error: gErr } = await supabase
      .from('guardians')
      .update({
        phone: payload.phone,
        insurance_provider: payload.insurance_provider,
        insurance_policy_number: payload.insurance_policy_number,
        pharmacy_name: payload.pharmacy_name,
        pharmacy_address: payload.pharmacy_address,
        updated_at: new Date().toISOString(),
      })
      .eq('id', guardianId);
    if (gErr) throw gErr;
  }

  if (state.profile?.id && payload.guardian_name) {
    await supabase
      .from('profiles')
      .update({
        full_name: payload.guardian_name,
        phone: payload.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.profile.id);
    state.profile.full_name = payload.guardian_name;
    state.profile.phone = payload.phone;
  }
}

export async function createNewChildForGuardian(guardianId, values) {
  const code = `PC-${Math.floor(10000 + Math.random() * 89999)}`;
  const primaryDoc = state.doctors[0]?.id || null;
  const { data, error } = await supabase
    .from('patients')
    .insert({
      patient_code: code,
      guardian_id: guardianId,
      primary_doctor_id: primaryDoc,
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      gender: values.gender || 'Male',
      blood_group: values.blood_group || 'O+',
      allergies: values.allergies || 'None reported',
      chronic_conditions: values.chronic_conditions || 'None',
      emergency_contact_phone: state.profile?.phone || '(555) 123-4567',
      insurance_info: values.insurance_info || 'BlueCare Health - #BC9982100',
      pharmacy_info: values.pharmacy_info || 'CVS Pharmacy #4402, 123 Maple St, Springfield',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendClinicMessage(values) {
  const { error } = await supabase.from('messages').insert({
    patient_id: values.patient_id ? Number(values.patient_id) : null,
    sender_id: state.profile.id,
    recipient_id: values.recipient_id || null,
    sender_name: state.profile.full_name,
    recipient_name: values.recipient_name || 'Pediatric Care Team',
    subject: values.subject,
    body: values.body,
    is_read: false,
  });
  if (error) throw error;
}

export async function markMessageRead(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId);
  if (error) throw error;
}

export async function createPrescription(values) {
  const myDoc = state.doctors.find((d) => d.profile_id === state.profile.id) || state.doctors[0];
  const { error } = await supabase.from('prescriptions').insert({
    patient_id: Number(values.patient_id),
    doctor_id: myDoc?.id || null,
    prescribed_by: state.profile.id,
    medication_name: values.medication_name,
    dosage: values.dosage,
    instructions: values.instructions,
    duration: values.duration || '7 days',
    refills: Number(values.refills || 0),
    status: 'active',
  });
  if (error) throw error;
}

export async function createExaminationAndNote(values) {
  const myDoc = state.doctors.find((d) => d.profile_id === state.profile.id) || state.doctors[0];
  const patientId = Number(values.patient_id);

  const { error: exErr } = await supabase.from('examinations').insert({
    patient_id: patientId,
    doctor_id: myDoc?.id || null,
    recorded_by: state.profile.id,
    temperature_f: Number(values.temperature_f || 98.6),
    heart_rate_bpm: Number(values.heart_rate_bpm || 90),
    respiratory_rate_min: Number(values.respiratory_rate_min || 20),
    weight_kg: Number(values.weight_kg || 21.4),
    findings: values.findings,
    diagnosis: values.diagnosis || 'Clinical Evaluation',
    recommendations: values.recommendations || 'Continue supportive pediatric care.',
  });
  if (exErr) throw exErr;

  if (values.diagnosis) {
    await supabase.from('medical_records').insert({
      patient_id: patientId,
      recorded_by: state.profile.id,
      condition_title: values.diagnosis,
      record_type: 'diagnosis',
      severity: values.severity || 'Mild',
      status: 'Active',
      notes: values.findings,
    });
  }

  if (values.create_visit_summary === 'yes') {
    const todayStr = new Date().toISOString().slice(0, 10);
    await supabase.from('visit_summaries').insert({
      patient_id: patientId,
      doctor_id: myDoc?.id || null,
      visit_date: todayStr,
      date_label: formatShortDate(todayStr),
      visit_title: values.diagnosis || 'Clinical Examination',
      provider_summary: `${state.profile.full_name} · Consultation`,
      summary_details: values.findings,
      care_recommendations: values.recommendations,
    });
  }
}

export async function recordVitalSigns(values) {
  const patientId = Number(values.patient_id);
  const bpText = values.blood_pressure_text || '110/70';
  const [sys, dia] = bpText.split('/').map((n) => Number(n.trim()) || 0);
  const nowLabel = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const { error } = await supabase.from('vital_signs').insert({
    patient_id: patientId,
    recorded_by: state.profile.id,
    temperature_f: Number(values.temperature_f || 98.6),
    heart_rate_bpm: Number(values.heart_rate_bpm || 90),
    respiratory_rate_min: Number(values.respiratory_rate_min || 19),
    bp_systolic: sys || 110,
    bp_diastolic: dia || 70,
    blood_pressure_text: bpText,
    weight_kg: Number(values.weight_kg || 21.0),
    height_cm: Number(values.height_cm || 118.0),
    recorded_time_label: values.recorded_time_label || nowLabel,
    notes: values.notes || '',
  });
  if (error) throw error;
}

export async function createMedicalRecordEntry(values) {
  const { error } = await supabase.from('medical_records').insert({
    patient_id: Number(values.patient_id),
    recorded_by: state.profile.id,
    condition_title: values.condition_title,
    record_type: values.record_type || 'health_info',
    severity: values.severity || 'Normal',
    status: values.status || 'Active',
    notes: values.notes || '',
  });
  if (error) throw error;
}

export async function toggleNurseTask(taskId, isCompleted) {
  const { error } = await supabase
    .from('nurse_tasks')
    .update({ is_completed: isCompleted })
    .eq('id', taskId);
  if (error) throw error;
}

export async function createNurseTask(values) {
  const myNurse = state.nurses.find((n) => n.profile_id === state.profile.id) || state.nurses[0];
  const { error } = await supabase.from('nurse_tasks').insert({
    nurse_id: myNurse?.id || null,
    patient_id: values.patient_id ? Number(values.patient_id) : null,
    title: values.title,
    priority: values.priority || 'normal',
    is_completed: false,
  });
  if (error) throw error;
}

export async function createAppointment(values) {
  const code = `APT-${Math.floor(1000 + Math.random() * 8999)}`;
  const { error } = await supabase.from('appointments').insert({
    appointment_code: code,
    patient_id: Number(values.patient_id),
    doctor_id: values.doctor_id ? Number(values.doctor_id) : state.doctors[0]?.id || null,
    nurse_id: values.nurse_id ? Number(values.nurse_id) : state.nurses[0]?.id || null,
    scheduled_at: values.scheduled_at ? new Date(values.scheduled_at).toISOString() : new Date().toISOString(),
    appointment_time_label: values.appointment_time_label || '10:00 AM',
    visit_type: values.visit_type || 'Consultation',
    status: values.status || 'scheduled',
    reason: values.reason || 'Pediatric consultation',
    notes: values.notes || '',
  });
  if (error) throw error;
}

export async function updateAppointmentStatus(appointmentId, newStatus) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw error;
}
