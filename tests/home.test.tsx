import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { navigation } from "@/config/site";
import { serviceCatalog } from "@/content/services";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

vi.mock("@/components/layout/auth-navigation", () => ({ AuthNavigation: () => null }));

vi.mock("@/lib/data/public", () => ({
  publishedServices: vi.fn(async () => serviceCatalog),
  servicePresentation: (row: unknown) => row,
}));
async function publicHome() {
  return <><Header /><main id="main">{await Home()}</main><Footer /></>;
}

describe("public homepage", () => {
  it("provides real destinations for every link without offering a booking flow", async () => {
    const { container } = render(await publicHome());
    const validRoutes = new Set([...navigation.map((link) => link.href), ...serviceCatalog.map((service) => `/services/${service.slug}`)]);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(10);
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href?.startsWith("#")) expect(container.querySelector(href)).toBeInTheDocument();
      else expect(validRoutes.has(href!.split("#")[0])).toBe(true);
    });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Booking requests are available/)).toBeInTheDocument();
    expect(screen.getByText(/An appointment is confirmed only after/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /book|pay|sign in/i })).not.toBeInTheDocument();
  });

  it("opens the mobile menu, closes on selection, and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(await publicHome());
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("navigation", { name: "Mobile navigation" }).querySelector('a[href="/services"]')!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
