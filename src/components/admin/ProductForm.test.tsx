import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProductForm } from "./ProductForm";
import type { Product } from "@/generated/prisma/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function pickCategory() {
  fireEvent.click(screen.getByLabelText(/^Category/i));
  fireEvent.click(screen.getByRole("option", { name: "Agarbatti" }));
}

const category = {
  id: "cat-1",
  name: "Agarbatti",
  slug: "agarbatti",
  description: null,
  image: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { products: 1 },
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderForm(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

const baseProduct: Product = {
  id: "p1",
  name: "Sandalwood Agarbatti",
  slug: "agarbatti-cycle-sandalwood-agarbatti",
  description: null,
  brand: "Cycle",
  weight: "100g",
  productType: "Masala Sticks",
  sku: "CYC-INC-001",
  price: 12000,
  discountedPrice: null,
  images: "[]",
  inStock: true,
  featured: false,
  isHidden: false,
  categoryId: "cat-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// The "Type" label uniquely identifies the productType field — no other
// field label contains that word.
function getTypeInput() {
  return screen.getByLabelText(/^Type/i) as HTMLInputElement;
}

describe("ProductForm — productType field", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [category], total: 1 }), { status: 200 })
      )
    );
  });

  it("defaults the Type field to empty when creating a new product", () => {
    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(getTypeInput().value).toBe("");
  });

  it("prefills the Type field from an existing product in edit mode", async () => {
    renderForm(<ProductForm product={baseProduct} onSubmit={vi.fn()} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));
  });

  it("prefills the Type field as empty (not the string 'null') when the existing product has no productType", async () => {
    renderForm(
      <ProductForm
        product={{ ...baseProduct, productType: null }}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    await waitFor(() => expect(getTypeInput().value).toBe(""));
  });

  it("does not silently wipe the existing productType when an unrelated field is edited and saved", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.change(screen.getByLabelText(/^Name/i), {
      target: { value: "Sandalwood Agarbatti (Renamed)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0]).toMatchObject({
      name: "Sandalwood Agarbatti (Renamed)",
      productType: "Masala Sticks",
    });
  });

  it("submits an updated Type value typed by the admin", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.change(getTypeInput(), { target: { value: "Black Sticks" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0]).toMatchObject({ productType: "Black Sticks" });
  });
});

describe("ProductForm — Hidden from website field", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [category], total: 1 }), { status: 200 })
      )
    );
  });

  it("defaults to unchecked when creating a new product", () => {
    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(screen.getByLabelText("Hidden from website")).not.toBeChecked();
  });

  it("prefills from an existing hidden product in edit mode", async () => {
    renderForm(
      <ProductForm
        product={{ ...baseProduct, isHidden: true }}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Hidden from website")).toBeChecked());
  });

  it("submits isHidden: true when the admin checks the box", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.click(screen.getByLabelText("Hidden from website"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0]).toMatchObject({ isHidden: true });
  });
});

describe("ProductForm — Discounted Price field", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [category], total: 1 }), { status: 200 })
      )
    );
  });

  function getDiscountedPriceInput() {
    return screen.getByLabelText(/^Discounted Price/i) as HTMLInputElement;
  }

  it("defaults to empty when creating a new product", () => {
    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);

    expect(getDiscountedPriceInput().value).toBe("");
  });

  it("prefills from an existing product's discountedPrice in edit mode", async () => {
    renderForm(
      <ProductForm
        product={{ ...baseProduct, discountedPrice: 9000 }}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    await waitFor(() => expect(getDiscountedPriceInput().value).toBe("9000"));
  });

  it("submits a discountedPrice typed by the admin that is less than price", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.change(getDiscountedPriceInput(), { target: { value: "9000" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0]).toMatchObject({ discountedPrice: 9000 });
  });

  it("shows a validation error and does not submit when discountedPrice is not less than price", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.change(getDiscountedPriceInput(), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText(/discounted price must be less than the regular price/i)).toBeInTheDocument()
    );
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe("ProductForm — variant discounted price field", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [category], total: 1 }), { status: 200 })
      )
    );
  });

  it("prefills variant discountedPrice from an existing product in edit mode", async () => {
    const productWithVariant = {
      ...baseProduct,
      variants: [
        {
          id: "v1",
          label: "100g",
          price: 12000,
          discountedPrice: 10000,
          inStock: true,
          productId: "p1",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
    };
    renderForm(<ProductForm product={productWithVariant} onSubmit={vi.fn()} isSubmitting={false} />);

    await waitFor(() => {
      const inputs = screen.getAllByLabelText(/Discounted price \(in paise\)/i) as HTMLInputElement[];
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs[0].value).toBe("10000");
    });
  });

  it("submits variant discountedPrice when filled in", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    // Add a variant
    fireEvent.click(screen.getByRole("button", { name: /add variant/i }));

    const labelInput = screen.getByLabelText(/^Weight \/ Quantity$/i) as HTMLInputElement;
    const priceInput = screen.getByLabelText(/^Price \(in paise\)$/i) as HTMLInputElement;
    const discInputs = screen.getAllByLabelText(/Discounted price \(in paise\)/i) as HTMLInputElement[];

    fireEvent.change(labelInput, { target: { value: "100g" } });
    fireEvent.change(priceInput, { target: { value: "12000" } });
    fireEvent.change(discInputs[0], { target: { value: "10000" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0].variants[0]).toMatchObject({
      label: "100g",
      price: 12000,
      discountedPrice: 10000,
    });
  });

  it("sets variant discountedPrice to null when the field is left blank", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    // Add a variant without filling discounted price
    fireEvent.click(screen.getByRole("button", { name: /add variant/i }));

    const labelInput = screen.getByLabelText(/^Weight \/ Quantity$/i) as HTMLInputElement;
    const priceInput = screen.getByLabelText(/^Price \(in paise\)$/i) as HTMLInputElement;

    fireEvent.change(labelInput, { target: { value: "50g" } });
    fireEvent.change(priceInput, { target: { value: "6000" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    expect(handleSubmit.mock.calls[0][0].variants[0].discountedPrice).toBeNull();
  });

  it("shows an error and does not submit when variant discountedPrice is not less than price", async () => {
    const handleSubmit = vi.fn();
    renderForm(<ProductForm product={baseProduct} onSubmit={handleSubmit} isSubmitting={false} />);

    await waitFor(() => expect(getTypeInput().value).toBe("Masala Sticks"));

    fireEvent.click(screen.getByRole("button", { name: /add variant/i }));

    const labelInput = screen.getByLabelText(/^Weight \/ Quantity$/i) as HTMLInputElement;
    const priceInput = screen.getByLabelText(/^Price \(in paise\)$/i) as HTMLInputElement;
    const discInputs = screen.getAllByLabelText(/Discounted price \(in paise\)/i) as HTMLInputElement[];

    fireEvent.change(labelInput, { target: { value: "100g" } });
    fireEvent.change(priceInput, { target: { value: "12000" } });
    fireEvent.change(discInputs[0], { target: { value: "15000" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText(/discounted price must be less than the regular price/i)).toBeInTheDocument()
    );
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe("ProductForm — SKU auto-generation", () => {
  const SKU_DEBOUNCE_MS = 400;

  function getSkuInput() {
    return screen.getByLabelText(/^SKU/i) as HTMLInputElement;
  }

  // Routes the categories request to a static payload and every
  // generate-sku request to `skuResponder`, which each test uses to control
  // per-request resolution timing.
  function stubFetch(skuResponder: (brand: string) => Promise<{ sku: string }>) {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        const url = String(input);
        if (url.includes("/api/products/generate-sku")) {
          const brand = new URL(url, "http://localhost").searchParams.get("brand") ?? "";
          return skuResponder(brand).then(
            (body) => new Response(JSON.stringify(body), { status: 200 })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ items: [category], total: 1 }), { status: 200 })
        );
      })
    );
  }

  async function typeBrandAndAdvance(brand: string) {
    fireEvent.change(screen.getByLabelText(/^Brand/i), { target: { value: brand } });
    await act(async () => {
      vi.advanceTimersByTime(SKU_DEBOUNCE_MS);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Regression: a second Anil incense product was generated as A-INC-0001
  // instead of ANI-INC-0002, because the in-flight request for the
  // half-typed brand "A" resolved AFTER the request for "Anil" and clobbered
  // the field. The debounce cannot prevent this once a request has left.
  it("keeps the finished brand's SKU when a half-typed brand's request resolves last", async () => {
    const pending: Record<string, (body: { sku: string }) => void> = {};
    stubFetch(
      (brand) =>
        new Promise<{ sku: string }>((resolve) => {
          pending[brand] = resolve;
        })
    );

    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);
    await waitFor(() => expect(screen.getByLabelText(/^Category/i)).toBeInTheDocument());

    pickCategory();

    // "A" is typed, the debounce elapses, and its request leaves.
    await typeBrandAndAdvance("A");
    await waitFor(() => expect(pending["A"]).toBeDefined());

    // The admin finishes typing; the second request leaves and comes back first.
    await typeBrandAndAdvance("Anil");
    await waitFor(() => expect(pending["Anil"]).toBeDefined());

    await act(async () => {
      pending["Anil"]({ sku: "ANI-INC-0002" });
    });
    await waitFor(() => expect(getSkuInput().value).toBe("ANI-INC-0002"));

    // The stale "A" response now arrives late — it must be discarded.
    await act(async () => {
      pending["A"]({ sku: "A-INC-0001" });
    });

    expect(getSkuInput().value).toBe("ANI-INC-0002");
  });

  it("still fills the SKU from the settled brand in the ordinary case", async () => {
    stubFetch(async (brand) => ({ sku: `${brand.slice(0, 3).toUpperCase()}-INC-0001` }));

    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);
    await waitFor(() => expect(screen.getByLabelText(/^Category/i)).toBeInTheDocument());

    pickCategory();
    await typeBrandAndAdvance("Anil");

    await waitFor(() => expect(getSkuInput().value).toBe("ANI-INC-0001"));
  });

  it("does not overwrite a SKU the admin typed by hand", async () => {
    stubFetch(async () => ({ sku: "ANI-INC-0002" }));

    renderForm(<ProductForm onSubmit={vi.fn()} isSubmitting={false} />);
    await waitFor(() => expect(screen.getByLabelText(/^Category/i)).toBeInTheDocument());

    fireEvent.change(getSkuInput(), { target: { value: "CUSTOM-SKU-1" } });
    pickCategory();
    await typeBrandAndAdvance("Anil");

    expect(getSkuInput().value).toBe("CUSTOM-SKU-1");
  });
});
