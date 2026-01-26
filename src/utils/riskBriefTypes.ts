export type RiskBrief = {
  summary: string;

  disclaimer: string;

  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";

  primary_risk_drivers: string[];

  planning_confidence: "LOW" | "MEDIUM" | "HIGH";

  confidence_rationale: string;

  vulnerabilities: Array<{
    title: string;
    note: string;
  }>;

  recommended_mitigations: Array<{
    title: string;
    steps: string;
  }>;

  go_no_go: {
    go_if: string[];
    no_go_if: string[];
  };

  day_of_operator_focus: string[];

  missing_info_questions: string[];
};
