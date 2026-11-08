import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductFilters } from "./ProductFilters";
import type { Category } from "@/generated/prisma/client";
import * as analytics from "@/lib/analytics";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParamsString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/catalog",
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

const categories: Category[] = [
  // Only the fields ProductFilters actually reads.
  { id: "c1", name: "Agarbatti", slug: "agarbatti" } as Category,
];
const brands = ["Cycle", "Satya"];

function renderFilters(props: Partial<React.ComponentProps<typeof ProductFilters>> = {}) {
  return render(
    <ProductFilters
      categories={categories}
      brands={brands}
      activeCategory=""
      activeBrand=""
      activeQuery=""
      {...props}
    />
  );
}

function pickOption(selectLabel: string, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: selectLabel }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearchParamsString = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ProductFilters — search debounce", () => {
  it("does not navigate immediately on keystroke", () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "sandalwood" },
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates with replace (not push) after the debounce delay, so keystrokes don't pollute history", () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "sandalwood" },
    });
    vi.advanceTimersByTime(400);

    expect(mockReplace).toHaveBeenCalledWith("/catalog?q=sandalwood");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("collapses rapid keystrokes into a single navigation with the final value", () => {
    renderFilters();

    const input = screen.getByLabelText("Search the catalog");
    fireEvent.change(input, { target: { value: "s" } });
    vi.advanceTimersByTime(200);
    fireEvent.change(input, { target: { value: "sa" } });
    vi.advanceTimersByTime(200);
    fireEvent.change(input, { target: { value: "san" } });
    vi.advanceTimersByTime(400);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/catalog?q=san");
  });

  it("does not navigate when the debounced value settles back to the active query", () => {
    renderFilters({ activeQuery: "sandalwood" });

    const input = screen.getByLabelText("Search the catalog");
    fireEvent.change(input, { target: { value: "sandal" } });
    fireEvent.change(input, { target: { value: "sandalwood" } });
    vi.advanceTimersByTime(400);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("clears the pending navigation on unmount so it never fires after the field is gone", () => {
    const { unmount } = renderFilters();

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "sandalwood" },
    });
    unmount();
    vi.advanceTimersByTime(400);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("preserves existing category/brand params when the debounced search fires", () => {
    mockSearchParamsString = "category=agarbatti&brand=Cycle";
    renderFilters({ activeCategory: "agarbatti", activeBrand: "Cycle" });

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "dhoop" },
    });
    vi.advanceTimersByTime(400);

    const url = mockReplace.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("category")).toBe("agarbatti");
    expect(params.get("brand")).toBe("Cycle");
    expect(params.get("q")).toBe("dhoop");
  });

  it("submits immediately via push (bypassing the debounce) on form submit", () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "sandalwood" },
    });
    fireEvent.submit(screen.getByLabelText("Search the catalog").closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/catalog?q=sandalwood");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("removes the q param entirely when the search is cleared", () => {
    renderFilters({ activeQuery: "sandalwood" });

    fireEvent.change(screen.getByLabelText("Search the catalog"), { target: { value: "" } });
    vi.advanceTimersByTime(400);

    expect(mockReplace).toHaveBeenCalledWith("/catalog?");
  });
});

describe("ProductFilters — category and brand selects", () => {
  it("navigates immediately (no debounce) on category change", () => {
    renderFilters();

    pickOption("Filter by category", "Agarbatti");

    expect(mockPush).toHaveBeenCalledWith("/catalog?category=agarbatti");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("navigates immediately (no debounce) on brand change", () => {
    renderFilters();

    pickOption("Filter by brand", "Satya");

    expect(mockPush).toHaveBeenCalledWith("/catalog?brand=Satya");
  });

  it("lists every category and brand as an option once opened", () => {
    renderFilters();

    fireEvent.click(screen.getByRole("combobox", { name: "Filter by category" }));
    expect(screen.getByRole("option", { name: "Agarbatti" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by brand" }));
    expect(screen.getByRole("option", { name: "Cycle" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Satya" })).toBeInTheDocument();
  });
});

describe("ProductFilters — analytics", () => {
  it("fires filter_category with the category's name (not its slug) on category change", () => {
    const spy = vi.spyOn(analytics, "trackFilterCategory");
    renderFilters();

    pickOption("Filter by category", "Agarbatti");

    expect(spy).toHaveBeenCalledWith("Agarbatti");
  });

  it("fires search with the final debounced query term", () => {
    const spy = vi.spyOn(analytics, "trackSearch");
    renderFilters();

    fireEvent.change(screen.getByLabelText("Search the catalog"), {
      target: { value: "sandalwood" },
    });
    vi.advanceTimersByTime(400);

    expect(spy).toHaveBeenCalledWith("sandalwood");
  });

  it("does not fire search when the query is cleared", () => {
    const spy = vi.spyOn(analytics, "trackSearch");
    renderFilters({ activeQuery: "sandalwood" });

    fireEvent.change(screen.getByLabelText("Search the catalog"), { target: { value: "" } });
    vi.advanceTimersByTime(400);

    expect(spy).not.toHaveBeenCalled();
  });
});
