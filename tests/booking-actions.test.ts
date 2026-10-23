import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireAccount: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAccount: mocks.requireAccount }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { submitBooking, cancelBooking } from "@/app/book/actions";
import { saveAddress, deleteAddress } from "@/app/account/addresses/actions";

const id = "00000000-0000-4000-8000-000000000001";
function form(values: Record<string, string>) { const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAccount.mockResolvedValue({ supabase: { rpc: mocks.rpc, from: mocks.from }, user: { id: "owner" }, role: "customer" });
});
describe("customer booking server actions (mocked database)", () => {
  it("submits only intended RPC arguments and keeps the same key across retries", async () => {
    mocks.rpc.mockResolvedValue({ data: id, error: null });
    const values = { service_id: id, address_id: id, idempotency_key: id, preferred_date: "2026-10-24", time_window: "morning", customer_notes: "A note", confirmed: "yes", customer_id: "victim", status: "confirmed" };
    for (let attempt = 0; attempt < 2; attempt++) await expect(submitBooking({}, form(values))).rejects.toThrow(`REDIRECT:/account/bookings/${id}`);
    expect(mocks.requireAccount).toHaveBeenCalledWith("customer");
    expect(mocks.rpc).toHaveBeenCalledWith("submit_booking_request", { p_service_id: id, p_address_id: id, p_preferred_date: "2026-10-24", p_time_window: "morning", p_idempotency_key: id, p_customer_notes: "A note" });
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });
  it("never redirects to success when persistence is uncertain", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "NETWORK" } });
    expect((await submitBooking({}, form({ service_id: id, address_id: id, idempotency_key: id, preferred_date: "2026-10-24", time_window: "morning", customer_notes: "", confirmed: "yes" }))).error).toMatch(/could not be confirmed as saved/);
  });
  it("requires cancellation confirmation and uses the guarded cancellation RPC", async () => {
    expect((await cancelBooking({}, form({ booking_id: id }))).error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: id, error: null });
    expect((await cancelBooking({}, form({ booking_id: id, confirmed: "yes", status: "completed" }))).success).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_pending_booking_request", { p_booking_id: id });
  });
  it("does not mutate when customer authorization fails", async () => {
    mocks.requireAccount.mockRejectedValue(new Error("Restricted"));
    await expect(submitBooking({}, form({}))).rejects.toThrow("Restricted");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("scopes address edits and deletion to the verified customer", async () => {
    const eq = vi.fn();
    const query = { eq, select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
    eq.mockReturnValue(query);
    const update = vi.fn(() => query), remove = vi.fn(() => query);
    mocks.from.mockReturnValue({ update, delete: remove });
    const address = { address_id: id, label: "Home", recipient_name: "Customer", phone: "9876543210", address_line_1: "Example address", address_line_2: "", locality: "Area", city: "Delhi", state: "Delhi", postal_code: "110001", landmark: "", customer_id: "victim" };
    expect((await saveAddress({}, form(address))).success).toBeTruthy();
    expect(eq).toHaveBeenCalledWith("customer_id", "owner");
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ customer_id: "victim" }));
    expect((await deleteAddress({}, form({ address_id: id, confirmed: "yes" }))).success).toBeTruthy();
    expect(remove).toHaveBeenCalled();
  });
});
