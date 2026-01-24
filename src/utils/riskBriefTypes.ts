export type RiskBrief = {
  summary: string; // 2-4 sentences
  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  key_risks: Array<{ title: string; why_it_matters: string }>;
  vulnerabilities: Array<{ title: string; note: string }>;
  mitigations: Array<{ title: string; steps: string }>;
  go_no_go: {
    go_if: string[];
    no_go_if: string[];
  };
  missing_info_questions: string[];
};
