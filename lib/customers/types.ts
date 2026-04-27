export type CustomerConsultScope = "full" | "team" | "self" | "none";

export type CustomerConsultSummary = {
  ref: string;
  display_name: string;
  phone: string | null;
  city: string | null;
  origin_label: string;
  latest_status: string | null;
  latest_service: string | null;
  latest_created_at: string | null;
  has_lead: boolean;
  has_appointments: boolean;
  has_commercial_case: boolean;
};

export type CustomerConsultLead = {
  id: string;
  source: string | null;
  status: string | null;
  interest_service: string | null;
  capture_location: string | null;
  created_at: string;
  created_by_name: string | null;
};

export type CustomerConsultAppointment = {
  id: string;
  date: string;
  time: string;
  status: string;
  service: string | null;
  city: string | null;
  notes: string | null;
};

export type CustomerConsultCommercialCase = {
  id: string;
  support_code: string | null;
  created_at: string;
  status: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  payment_method: string | null;
  sale_origin_type: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  commercial_name: string | null;
  assigned_by_name: string | null;
  commercial_notes: string | null;
  sales_assessment: string | null;
  proposal_text: string | null;
  closing_notes: string | null;
};

export type CustomerConsultDetail = {
  ref: string;
  identity: {
    full_name: string;
    phone: string | null;
    city: string | null;
  };
  lead: CustomerConsultLead | null;
  appointments: CustomerConsultAppointment[];
  commercial_cases: CustomerConsultCommercialCase[];
};

export type CustomerConsultResponse = {
  items: CustomerConsultSummary[];
  detail: CustomerConsultDetail | null;
  scope: CustomerConsultScope;
};
