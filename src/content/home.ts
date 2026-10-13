import { offerings } from "./services";

export const services = offerings.map((offering, i) => ({ ...offering, number: String(i + 1).padStart(2, "0") }));

export const steps = [
  { title: "Find your kind of wellness", description: "Explore the services and choose what fits your goals and everyday life." },
  { title: "Share the details", description: "When booking opens, share your preferred schedule and home location in a booking request." },
  { title: "Let us coordinate", description: "The team will review availability and assign a suitable professional. Your appointment is confirmed only after assignment and confirmation." },
] as const;

export const approach = [
  { title: "People first", description: "Our approach will centre on qualified professionals suited to each service and your individual needs." },
  { title: "Clarity at every step", description: "Clear service information and visit requirements, so you can make a considered choice." },
  { title: "Thoughtful coordination", description: "A managed process for professional assignment and appointment confirmation." },
  { title: "Space for you", description: "Personal experiences that take your preferences, goals, and home setting into account." },
] as const;

export const faqs = [
  { question: "Can I book a home visit now?", answer: "We are preparing to launch in Delhi NCR. You can explore the planned services and appointment process on this website; booking requests are not open yet." },
  { question: "Does a booking request confirm my appointment?", answer: "No. Once requests open, the team will review your preferred schedule and location, check professional availability, and assign a suitable professional. Only an explicit confirmation will confirm your appointment." },
  { question: "How will monthly yoga programs work?", answer: "We are planning regular personal yoga programs, including potential 8-session and 12-session monthly options. Final schedules, package details, and prices will be shared when the service becomes available." },
  { question: "What will I need for an at-home session?", answer: "A comfortable space appropriate to the service is a helpful starting point. Any specific space, equipment, or preparation requirements will be explained before an appointment is confirmed." },
  { question: "How will my professional be assigned?", answer: "The team will consider the requested service, location, preferred schedule, and professional suitability. Exact availability will depend on professional coverage; individual profiles and credentials will be introduced later." },
] as const;
