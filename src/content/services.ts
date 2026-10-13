export type ServiceSlug = "personal-yoga" | "naturopathy" | "massage-therapy";
export type FaqItem = { question: string; answer: string };
export type EditorialAsset = { src: string; alt: string; caption: string };

export type Service = {
  slug: ServiceSlug;
  title: string;
  subtitle: string;
  description: string;
  detail: string;
  introduction: string;
  category: string;
  hero: EditorialAsset;
  overview: string;
  expectations: { title: string; description: string }[];
  suitability: string;
  preparation: string;
  faqs: FaqItem[];
  related: ServiceSlug[];
  price?: { amountInRupees: number; currency: "INR" };
  durationMinutes?: number;
};

export const assets = {
  room: { src: "/images/quiet-room.svg", alt: "Original illustration of a quiet sunlit room with a yoga mat and a leafy plant.", caption: "Your space. Your pace." },
  botanical: { src: "/images/botanical-study.svg", alt: "Original still-life illustration of a terracotta vase, botanical stems, and folded linens.", caption: "Simple rituals. A considered life." },
  practice: { src: "/images/practice-study.svg", alt: "Original illustration of a yoga mat and folded towel beside a tall window.", caption: "A practice to come home to." },
} satisfies Record<string, EditorialAsset>;

export const serviceCatalog: readonly Service[] = [
  {
    slug: "personal-yoga", title: "Personal Yoga Training", subtitle: "Move with intention", category: "Movement & practice",
    description: "One-to-one yoga practice at home, shaped around your experience, preferences, and personal goals.",
    detail: "Individual guidance · At your pace",
    introduction: "Make a little room for movement. A personal yoga session brings individual guidance to your own surroundings, with space to ask questions and find a pace that feels considered.",
    hero: assets.practice,
    overview: "Personal yoga is an individual practice rather than a group class. The intended experience begins with a conversation about your familiarity with yoga, preferences, and goals, followed by guided practice suited to that context. The scope of each session will be explained before confirmation.",
    expectations: [
      { title: "A conversation first", description: "Share your experience, preferences, and any relevant limitations with the assigned instructor." },
      { title: "Guided practice", description: "Explore movement, breathing, and time for rest at a pace discussed with your instructor." },
      { title: "Room for questions", description: "Use the individual setting to ask about the practice and discuss what you would like to focus on next." },
    ],
    suitability: "For people interested in an individual yoga practice, including those beginning or returning to yoga. Suitability depends on your circumstances and the instructor's scope; a session is not a substitute for medical care.",
    preparation: "Plan for a clear, comfortable space where you can move. Mat, equipment, and any other preparation requirements will be clarified before the visit.",
    faqs: [
      { question: "Do I need previous yoga experience?", answer: "You can explore personal yoga as a beginner or with an established practice. Your experience and goals will help the team consider a suitable instructor and session approach." },
      { question: "Will I need a yoga mat?", answer: "A mat and a clear space may be appropriate. Equipment requirements and what the professional will bring will be explained before confirmation; equipment provision is not currently finalized." },
      { question: "Can I continue with regular sessions?", answer: "Monthly personal yoga programs are planned, with potential 8-session and 12-session options. Final packages and instructor availability will be shared at launch." },
    ], related: ["naturopathy", "massage-therapy"],
  },
  {
    slug: "naturopathy", title: "Naturopathy Consultations", subtitle: "A considered conversation", category: "Lifestyle & wellbeing",
    description: "Personal consultations to discuss your lifestyle, everyday habits, and wellness goals with a suitable professional.",
    detail: "Lifestyle discussion · Individual context",
    introduction: "An opportunity to pause and look at your everyday habits. Our planned at-home naturopathy consultations create space for a personal conversation about lifestyle and wellbeing.",
    hero: assets.botanical,
    overview: "The intended consultation centres on discussing your routine, priorities, and wellness goals. A suitable professional will explain the scope of the consultation and any general lifestyle guidance they can provide. No particular treatment, diagnosis, or medical result is promised.",
    expectations: [
      { title: "Your everyday context", description: "Discuss routines and preferences that are relevant to the consultation, at a level you are comfortable sharing." },
      { title: "A clear scope", description: "Understand the professional's role and the limits of the service before considering their guidance." },
      { title: "A considered discussion", description: "Ask questions about general lifestyle suggestions and what they could mean for your routine." },
    ],
    suitability: "For people interested in discussing lifestyle and wellness habits with a professional. This service is not emergency care and should not replace advice, diagnosis, or treatment from your medical clinician.",
    preparation: "Choose a quiet place for conversation. The team will explain what information, if any, is useful to have ready before the appointment is confirmed.",
    faqs: [
      { question: "Is this a medical treatment appointment?", answer: "The planned offering is a wellness and lifestyle consultation. The professional's scope and qualifications will be explained when genuine records are available. It does not replace medical care or promise treatment outcomes." },
      { question: "Do I need to prepare anything?", answer: "A comfortable setting for discussion is a useful starting point. Specific preparation will be explained before confirmation; please do not submit personal health records through this public website." },
      { question: "Will supplements or products be included?", answer: "No products, supplements, tests, or additional treatments are currently specified as included. Final service details will clearly explain the scope before requests open." },
    ], related: ["personal-yoga", "massage-therapy"],
  },
  {
    slug: "massage-therapy", title: "Massage & Wellness Therapy", subtitle: "Time to slow down", category: "Rest & relaxation",
    description: "At-home sessions focused on relaxation and personal comfort, with the service and visit requirements explained beforehand.",
    detail: "Rest · A familiar setting",
    introduction: "Set aside a little time for rest. Our planned massage and wellness sessions bring a considered relaxation experience to the familiarity of home, with clear information about the visit.",
    hero: assets.room,
    overview: "The intended offering focuses on relaxation and comfort. Specific therapy formats, professional suitability, equipment, and session scope will be published once confirmed. Your preferences and comfort should guide the experience, with boundaries discussed before the session.",
    expectations: [
      { title: "Clarity before the visit", description: "Review the session format, equipment arrangements, and home-space requirements before confirming." },
      { title: "Comfort and consent", description: "Discuss preferences and boundaries with the professional; you should be able to ask questions or pause a session." },
      { title: "Time for rest", description: "A planned relaxation session in a suitable space at home, within the agreed service scope." },
    ],
    suitability: "For people considering a relaxation-focused home visit. Individual circumstances may affect suitability. For medical concerns, consult your clinician before considering a session; this offering does not promise therapeutic or medical outcomes.",
    preparation: "A private, comfortable space may be needed. Equipment, linens, and setup arrangements will be confirmed in the service information before a visit is agreed.",
    faqs: [
      { question: "Which massage formats will be available?", answer: "The business has not yet finalized or supplied a list of formats. Specific options, scope, and professional details will be published before booking requests open." },
      { question: "Will the professional bring equipment?", answer: "Equipment and linen arrangements are not yet finalized. These details and home-space requirements will be explained before appointment confirmation." },
      { question: "Can I discuss my preferences beforehand?", answer: "The intended process includes clear communication about the service, your comfort, and any relevant requirements. Preferences will be considered alongside professional suitability and availability." },
    ], related: ["personal-yoga", "naturopathy"],
  },
];

export const yogaProgram = {
  title: "Monthly Personal Yoga Programs", subtitle: "Make space for a practice",
  description: "A regular rhythm of personal yoga sessions, with monthly options planned around your routine.",
  detail: "Consistency · Personal attention", href: "/yoga-programs",
  options: [
    { sessions: 8, title: "A steady foundation", description: "A planning example for making regular guided practice part of your month." },
    { sessions: 12, title: "A closer rhythm", description: "A planning example for those who would like more frequent personal guidance." },
  ],
  faqs: [
    { question: "Are the 8-session and 12-session options finalized?", answer: "No. They are planning examples. Final session counts, prices, durations, validity, and scheduling terms will be published before programs can be requested or purchased." },
    { question: "Will I have the same instructor each time?", answer: "Instructor continuity is an intended priority because it supports a familiar practice. The team will consider it during assignment, but it will depend on availability and cannot yet be guaranteed." },
    { question: "Does a monthly program renew automatically?", answer: "No automatic renewal or recurring billing is implemented or promised. A monthly program describes a planned grouping of sessions, not an active subscription." },
    { question: "Can I reschedule or change a program?", answer: "Scheduling flexibility, cancellation rules, validity, and package changes have not been finalized. The terms will be clearly explained before a program is offered." },
  ] satisfies FaqItem[],
};

export function getService(slug: string): Service | undefined {
  return serviceCatalog.find((service) => service.slug === slug);
}

export const offerings = [
  { ...serviceCatalog[0], href: `/services/${serviceCatalog[0].slug}` },
  yogaProgram,
  ...serviceCatalog.slice(1).map((service) => ({ ...service, href: `/services/${service.slug}` })),
];
