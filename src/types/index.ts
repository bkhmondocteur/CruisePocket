export type Role = 'medecin' | 'societe';

export type Civility = 'M.' | 'Mme' | 'Autre';

export type ContractType = 
  | 'Nouveau contrat' 
  | 'Contrat intermédiaire' 
  | 'Renouvellement de contrat';

export type MedicalStatus = 'En instance' | 'Effectué';

export type FinancialStatus = 'Payé' | 'Non payé';

export type PayerName = 'Le candidat lui-même' | 'La société';

export interface Candidate {
  id: string;
  civility: Civility;
  last_name: string;
  first_name: string;
  birth_date: string;
  age: number;
  passport_number: string;
  passport_file_url?: string;
  passport_file_name?: string;
  cruise_company: string;
  position: string;
  contract_type: ContractType;
  embarkation_date: string;
  medical_status: MedicalStatus;
  medical_notes?: string;
  financial_amount: number;
  financial_status: FinancialStatus;
  payer_name: PayerName;
  service_company_id?: string;
  service_company_name: string;
  doctor_id?: string;
  doctor_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceCompany {
  id: string;
  name: string;
  manager_name: string;
  phone: string;
  location: string;
  license_key: string;
  created_at?: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  order_number: string;
  practice_location: string;
  license_key: string;
  created_at?: string;
}

export interface CruiseCompany {
  id: string;
  name: string;
}

export interface LicenseGenerationCompanyInput {
  name: string;
  manager_name: string;
  phone: string;
  location: string;
}

export interface LicenseGenerationDoctorInput {
  full_name: string;
  order_number: string;
  practice_location: string;
}

export interface DeletionInfo {
  candidateId: string;
  candidateName: string;
  deletedBy: {
    role: Role;
    name: string;
  };
  timestamp: string;
}

export interface CandidateEvent {
  type: string;
  payload?: Candidate;
  deletion?: DeletionInfo;
}
