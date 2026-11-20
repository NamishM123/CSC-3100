import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"
import "@testing-library/jest-dom/vitest";

vi.mock("./state/useAuthSession.js", () => ({
    useAuthSession: () => ({
        user: {
            id: "test-user",
            name: "Test User",
            email: "test@example.com"
        },
        authLoading: false,
        mfaRequired: false,
        signOut: vi.fn(),
        signOutEverywhere: vi.fn()
    })
}));

vi.mock("./hooks/useMapLocation.js", () => ({
    useMapLocation: () => ({
        place: {
            lat: 35.2828,
            lng: -120.6596
        }
    })
}));

vi.mock("./hooks/useSavedLists.js", () => ({
    useSavedLists: () => ({
        ready: true,
        status: "saved",
        pending: false,
        conflict: false,
        message: "",
        reload: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined)
    })
}));

test("user can search for and select banana", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Search for bananas
    const searchInput = screen.getByPlaceholderText(/search/i);

    await user.type(searchInput, "Bananas");
    await user.keyboard("{Enter}");

    expect(
        await screen.findByText("Bananas", {
            selector: "strong"
        })
    ).toBeInTheDocument();
});

test("user can compare banana prices between stores", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Search results should contain bananas.
    expect(
        await screen.findByText("Bananas", {
            selector: "strong"
        })
    ).toBeInTheDocument();

    // Verify demo stores.
    expect(
        screen.getByText("Trader Joe's", { selector: "strong" })
    ).toBeInTheDocument();

    expect(
        screen.getByText("Grocery Outlet", { selector: "strong" })
    ).toBeInTheDocument();

    // Verify mock prices.
    expect(
        screen.getByText("$0.19")
    ).toBeInTheDocument();

    expect(
        screen.getByText("$0.22")
    ).toBeInTheDocument();
});