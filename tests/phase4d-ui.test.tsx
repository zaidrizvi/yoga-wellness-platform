import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/auth/validation";

const location = vi.hoisted(() => ({ pathname: "/admin/services/offerings", search: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => location.pathname, useSearchParams: () => new URLSearchParams(location.search) }));
vi.mock("@/app/professional/application-actions", () => ({ saveApplication: vi.fn(), uploadApplicationCredential: vi.fn() }));
import { PanelNavigation } from "@/components/layout/panel-navigation";
import { ActionForm } from "@/components/auth/action-form";
import { ApplicationFields } from "@/components/professional-applications/application-fields";
import { ApplicantCredentialUpload } from "@/components/professional-applications/credential-upload";

beforeEach(() => { location.pathname = "/admin/services/offerings"; location.search = ""; });

it("marks only the most specific admin destination, including on detail pages", () => {
  render(<PanelNavigation label="Administration" links={[
    { href: "/admin/services", label: "Catalog" },
    { href: "/admin/services/offerings", label: "Approvals" },
  ]} />);
  expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Catalog" })).not.toHaveAttribute("aria-current");
});

it.each(["", "kind=recurring_package"])("distinguishes services from package navigation for query %s", (search) => {
  location.pathname = "/professional/services"; location.search = search;
  render(<PanelNavigation label="Professional panel" links={[
    { href: "/professional", label: "Dashboard" },
    { href: "/professional/services", label: "Services" },
    { href: "/professional/services?kind=recurring_package", label: "Packages" },
    { href: "/professional/services#approval-status", label: "Approval status" },
  ]} />);
  const current = screen.getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page");
  expect(current).toHaveLength(1);
  expect(current[0]).toHaveTextContent(search ? "Packages" : "Services");
});

it("retains pending protection, confirmation payload and truthful success feedback", async () => {
  let finish!: (value: FormState) => void;
  const action = vi.fn(() => new Promise<FormState>(resolve => { finish = resolve; }));
  render(<ActionForm action={action} submit="Record sensitive decision"><input type="hidden" name="record_id" value="existing-record" /><label className="checkbox-label"><input name="confirmed" type="checkbox" value="yes" required />Confirm reviewed decision</label></ActionForm>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("button").closest("form")).toHaveAttribute("aria-busy", "true");
  const payload = action.mock.calls[0] as unknown as [FormState, FormData];
  expect(payload[1].get("record_id")).toBe("existing-record");
  expect(payload[1].get("confirmed")).toBe("yes");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  finish({ success: "Decision saved by the action." });
  expect(await screen.findByRole("status")).toHaveTextContent("Decision saved by the action.");
  expect(screen.getByRole("button")).toBeEnabled();
});

it("announces and focuses an action error without inventing success", async () => {
  render(<ActionForm action={async () => ({ error: "The decision was not saved. Try again." })} />);
  fireEvent.submit(screen.getByRole("button").closest("form")!);
  expect(await screen.findByRole("alert")).toHaveFocus();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("groups applicant details while preserving draft fields and private-upload guidance", () => {
  render(<><ApplicationFields application={null} categories={[]} /><ApplicantCredentialUpload applicationId="existing-application" /></>);
  for (const name of ["About you", "Your professional practice", "Where you can visit"]) expect(screen.getByRole("group", { name })).toBeVisible();
  expect(screen.getByLabelText("Full name")).toHaveAttribute("name", "full_name");
  expect(screen.getByLabelText("Full name")).not.toBeRequired();
  expect(screen.getByLabelText("Supporting credential")).toHaveAccessibleDescription(/PDF, JPEG or PNG, up to 10 MB/);
  expect(screen.getByRole("checkbox")).toBeRequired();
});
