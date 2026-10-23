import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ authenticate: mocks.authenticate }));
import { SignupForm } from "@/components/auth/signup-form";

beforeEach(() => vi.clearAllMocks());
async function submitSignup() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Full name"), "A customer");
  await user.type(screen.getByLabelText("Email address"), "person@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "a-valid-password");
  await user.type(screen.getByLabelText("Confirm password"), "a-valid-password");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  return user;
}
it("replaces accepted signup with a prominent, focused confirmation and allows correction", async () => {
  mocks.authenticate.mockResolvedValue({ confirmationEmail: "person@example.com" });
  render(<SignupForm />);
  const user = await submitSignup();
  const heading = await screen.findByRole("heading", { level: 1, name: "Check your inbox" });
  expect(heading).toHaveFocus();
  expect(screen.getByText("person@example.com")).toBeVisible();
  expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText(/cannot confirm email delivery/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Already confirmed? Login" })).toHaveAttribute("href", "/login");
  await user.click(screen.getByRole("button", { name: "Correct email address" }));
  expect(screen.getByLabelText("Email address")).toHaveValue("person@example.com");
  expect(mocks.authenticate).toHaveBeenCalledTimes(1);
});
it("does not show confirmation when signup fails", async () => {
  mocks.authenticate.mockResolvedValue({ error: "Too many registration attempts. Please wait." });
  render(<SignupForm />);
  await submitSignup();
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many registration attempts");
  expect(screen.queryByRole("heading", { name: "Check your inbox" })).not.toBeInTheDocument();
});
