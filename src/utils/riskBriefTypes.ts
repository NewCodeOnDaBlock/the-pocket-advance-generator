export type RiskBrief = {
  summary: string;
  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";

  key_risks: Array<{ title: string; why_it_matters: string }>;
  vulnerabilities: Array<{ title: string; note: string }>;
  mitigations: Array<{ title: string; steps: string }>;

  movement_constraints: Array<{ title: string; why: string; action: string }>;

  comms_checks: Array<{ check: string; why: string }>;

  medical_plan: {
    primary: string;
    secondary: string;
    evac_route_notes: string;
  };

  go_no_go: { go_if: string[]; no_go_if: string[] };

  missing_info_questions: string[];

  sources: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};
