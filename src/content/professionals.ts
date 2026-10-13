import type { ServiceSlug } from "./services";

// Presentation contract for genuine records in Phase 3. No sample people.
export type ProfessionalProfile = {
  id: string;
  name: string;
  photograph?: { src: string; alt: string };
  specialties: ServiceSlug[];
  qualifications: string[];
  yearsOfExperience?: number;
  verificationStatus: "pending" | "verified";
  serviceAreas: string[];
  introduction: string;
};

export const professionalApproach = [
  { title: "Understand the service", description: "The intended review will consider qualifications and experience relevant to the service a professional plans to deliver." },
  { title: "Review the information", description: "We intend to review supporting credentials and professional information before presenting genuine profiles. This process has not yet been implemented." },
  { title: "Consider the fit", description: "Service suitability, your preferences, location coverage, and scheduling will inform managed assignment." },
  { title: "Support continuity", description: "For regular yoga, the team will aim to consider instructor continuity. It remains subject to availability and scheduling." },
];
