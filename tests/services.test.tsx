import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicesPage from "@/app/services/page";
import ServicePage, { generateMetadata, generateStaticParams } from "@/app/services/[slug]/page";
import YogaProgramsPage from "@/app/yoga-programs/page";
import { getService, serviceCatalog } from "@/content/services";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

describe("public service content and routing", () => {
  it("renders the catalog with working links for all initial services and monthly yoga", () => {
    render(<ServicesPage />);
    serviceCatalog.forEach((service) => {
      expect(screen.getByRole("link", { name: `Explore ${service.title}` })).toHaveAttribute("href", `/services/${service.slug}`);
    });
    expect(screen.getByRole("link", { name: "Explore Monthly Personal Yoga Programs" })).toHaveAttribute("href", "/yoga-programs");
  });

  it("prepares the known slugs and renders detail content without invented commercial terms", async () => {
    expect(generateStaticParams()).toHaveLength(3);
    const element = await ServicePage({ params: Promise.resolve({ slug: "personal-yoga" }) });
    render(element);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Personal Yoga Training");
    expect(screen.getByText("Final pricing will be shared before booking requests open.")).toBeInTheDocument();
    expect(screen.getByText("Session duration will be published with confirmed service details.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Monthly Personal Yoga Programs" })).toHaveAttribute("href", "/yoga-programs");
  });

  it("rejects unknown and prototype-like slugs in page and metadata resolution", async () => {
    for (const slug of ["unknown-service", "__proto__", "constructor"]) {
      expect(getService(slug)).toBeUndefined();
      await expect(ServicePage({ params: Promise.resolve({ slug }) })).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(generateMetadata({ params: Promise.resolve({ slug }) })).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("resolves related content and unique metadata from the service records", async () => {
    const titles = new Set();
    for (const service of serviceCatalog) {
      service.related.forEach((slug) => expect(getService(slug)).toBeDefined());
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: service.slug }) });
      expect(metadata.description).toContain(service.description);
      expect(metadata.openGraph?.title).toEqual(metadata.title);
      titles.add(metadata.title);
    }
    expect(titles.size).toBe(3);
  });

  it("presents monthly options as planning examples rather than active subscriptions", () => {
    render(<YogaProgramsPage />);
    expect(screen.getByText(/Not finalized packages/)).toBeInTheDocument();
    expect(screen.getByText(/does not imply recurring billing or automatic renewal/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe|purchase|buy/i })).not.toBeInTheDocument();
  });
});
