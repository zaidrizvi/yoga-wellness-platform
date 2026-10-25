import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/layout/header", () => ({ Header: () => <header>Site navigation</header> }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => <footer>Site footer</footer> }));

import { AppChrome } from "@/components/layout/app-chrome";

beforeEach(() => { route.pathname = "/"; });

it("keeps the public chrome for the professionals directory and profile routes", () => {
  for (const pathname of ["/professionals", "/professionals/00000000-0000-4000-8000-000000000001"]) {
    route.pathname = pathname;
    const view = render(<AppChrome><p>Public profile</p></AppChrome>);
    expect(screen.getByText("Site navigation")).toBeVisible();
    expect(screen.getByText("Site footer")).toBeVisible();
    view.unmount();
  }
});

it("uses the workspace chrome only for the singular professional workspace", () => {
  route.pathname = "/professional/services";
  render(<AppChrome><p>Professional workspace</p></AppChrome>);
  expect(screen.queryByText("Site navigation")).toBeNull();
  expect(screen.getByRole("main")).toHaveClass("workspace-main");
});
