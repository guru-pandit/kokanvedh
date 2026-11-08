"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, RefreshCw } from "lucide-react";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { MAX_PRODUCT_IMAGES } from "@/lib/validations/uploadPath";
import { buildSlug, parseImages } from "@/lib/format";
import { useCategories } from "@/hooks/categories/useCategories";
import { generateSku } from "@/hooks/products/useGenerateSku";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/form/TextField";
import { TextareaField } from "@/components/ui/form/TextareaField";
import { SelectField } from "@/components/ui/form/SelectField";
import { CheckboxField } from "@/components/ui/form/CheckboxField";
import { FormField } from "@/components/ui/form/FormField";
import { fieldInputClasses } from "@/components/ui/form/styles";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { useApiFormErrors } from "@/hooks/useApiFormErrors";
import type { Product, ProductVariant } from "@/generated/prisma/client";

export function ProductForm({
  product,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  product?: Product & { variants?: ProductVariant[] };
  onSubmit: (values: ProductInput) => void;
  isSubmitting: boolean;
  submitError?: unknown;
}) {
  const router = useRouter();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    getFieldState,
    control,
    setError,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          brand: product.brand,
          weight: product.weight ?? "",
          productType: product.productType ?? "",
          sku: product.sku ?? "",
          price: product.price,
          discountedPrice: product.discountedPrice,
          images: parseImages(product.images),
          inStock: product.inStock,
          featured: product.featured,
          isHidden: product.isHidden,
          categoryId: product.categoryId,
          variants: (product.variants ?? []).map((v) => ({
            label: v.label,
            price: v.price,
            discountedPrice: v.discountedPrice ?? null,
            inStock: v.inStock,
          })),
        }
      : {
          name: "",
          slug: "",
          description: "",
          brand: "",
          weight: "",
          productType: "",
          sku: "",
          price: null,
          discountedPrice: null,
          images: [],
          inStock: true,
          featured: false,
          isHidden: false,
          categoryId: "",
          variants: [],
        },
  });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: "variants",
  });

  const formError = useApiFormErrors<ProductInput>(submitError, setError);

  const name = watch("name");
  const brand = watch("brand");
  const categoryId = watch("categoryId");
  const images = watch("images");

  const slugEditedManually = useRef(!!product);
  const skuEditedManually = useRef(!!product);

  // Auto-filled values are set programmatically, which skips validation — so
  // an error left over from an earlier failed submit ("Slug is required")
  // would stay visible under a field that is now filled. Re-validate only when
  // such an error is showing; otherwise stay quiet while the user is typing.
  function setAutoFilled(field: "slug" | "sku", value: string) {
    setValue(field, value, { shouldValidate: !!getFieldState(field).error });
  }

  function categoryName(id: string) {
    return categories?.find((c) => c.id === id)?.name ?? "";
  }

  useEffect(() => {
    if (slugEditedManually.current) return;
    setAutoFilled("slug", buildSlug(categoryName(categoryId), brand, name));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryName reads `categories`, which is included below
  }, [name, brand, categoryId, categories, setValue, getFieldState]);

  useEffect(() => {
    if (skuEditedManually.current || !brand || !categoryId) return;

    // The debounce alone does NOT make this safe. Once the timer has fired,
    // the request is in flight and clearTimeout can't recall it — so a slow
    // response for a half-typed brand ("A") can land *after* the fast one
    // for the finished brand ("Anil") and overwrite the correct value. That
    // is how a second Anil incense product came out as A-INC-0001 instead of
    // ANI-INC-0002: the prefix "A-INC" has no prior products, so the server
    // correctly numbered it 0001 — it was just answering a stale question.
    // Abort the outstanding request and ignore anything a superseded run
    // still manages to resolve.
    const controller = new AbortController();
    let superseded = false;

    const timeout = setTimeout(async () => {
      if (skuEditedManually.current) return;
      try {
        const { sku } = await generateSku(brand, categoryId, controller.signal);
        // The user may have typed a SKU while the request was in flight.
        if (!superseded && !skuEditedManually.current) setValue("sku", sku, { shouldValidate: !!getFieldState("sku").error });
      } catch {
        // Generation failed (network hiccup) or this run was aborted — the
        // user can still type a SKU by hand.
      }
    }, 400);

    return () => {
      superseded = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [brand, categoryId, setValue, getFieldState]);

  function regenerateSlug() {
    setAutoFilled("slug", buildSlug(categoryName(getValues("categoryId")), getValues("brand"), getValues("name")));
    slugEditedManually.current = false;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <SelectField
              id="categoryId"
              label="Category"
              required
              error={errors.categoryId?.message}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <option value="">Select a category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}
        />
        <TextField
          id="brand"
          label="Brand"
          required
          error={errors.brand?.message}
          placeholder="e.g. Cycle, Mangaldeep, Satya"
          {...register("brand")}
        />
      </div>

      <TextField
        id="name"
        label="Name"
        required
        error={errors.name?.message}
        {...register("name")}
      />

      <FormField label="Slug" htmlFor="slug" required error={errors.slug?.message}>
        <div className="flex gap-2">
          <input
            id="slug"
            className={fieldInputClasses}
            {...register("slug", {
              onChange: () => {
                slugEditedManually.current = true;
              },
            })}
          />
          <button
            type="button"
            onClick={regenerateSlug}
            className="shrink-0 rounded-lg border border-maroon/20 p-2.5 text-maroon/60 hover:bg-maroon/5"
            aria-label="Regenerate slug"
            title="Regenerate slug from category, brand & name"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </FormField>

      <TextField
        id="sku"
        label="SKU"
        required
        error={errors.sku?.message}
        hint="Auto-generated from brand & category — edit if needed"
        {...register("sku", {
          onChange: () => {
            skuEditedManually.current = true;
          },
        })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="weight"
          label="Weight / Quantity (optional)"
          error={errors.weight?.message}
          hint="Used only if no variants are added below"
          placeholder="e.g. 100g, 12 cones, 2 pieces"
          {...register("weight")}
        />
        <TextField
          id="productType"
          label="Type (optional)"
          error={errors.productType?.message}
          placeholder="e.g. Black Sticks, Masala Sticks"
          {...register("productType")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={'Price (in paise — leave blank for "Contact for price")'}
          htmlFor="price"
          error={errors.price?.message}
          hint="Used only if no variants are added below"
        >
          <Controller
            control={control}
            name="price"
            render={({ field }) => (
              <input
                id="price"
                type="number"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                className={fieldInputClasses}
              />
            )}
          />
        </FormField>
        <FormField
          label="Discounted Price (in paise, optional)"
          htmlFor="discountedPrice"
          error={errors.discountedPrice?.message}
          hint="Used only when the product has no variants — leave blank to show the regular price only"
        >
          <Controller
            control={control}
            name="discountedPrice"
            render={({ field }) => (
              <input
                id="discountedPrice"
                type="number"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                className={fieldInputClasses}
              />
            )}
          />
        </FormField>
      </div>

      <div>
        <p className="mb-1 block text-sm font-medium text-charcoal">
          Variants (optional — multiple weight/price options)
        </p>
        <div className="rounded-lg border border-maroon/10">
          {variantFields.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-3 border-b border-maroon/10 bg-cream-dark/40 px-3 py-2 text-xs font-medium text-charcoal/60">
              <span>
                Weight / Quantity <span className="text-red-700">*</span>
              </span>
              <span>
                Price (in paise) <span className="text-red-700">*</span>
              </span>
              <span>Discounted Price (in paise, optional)</span>
              <span>In Stock</span>
              <span />
            </div>
          )}
          {variantFields.map((field, index) => (
            <div key={field.id} className="border-b border-maroon/10 px-3 py-2 last:border-0">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-start gap-3">
                <div>
                  <input
                    aria-label="Weight / Quantity"
                    placeholder="e.g. 50g"
                    className={fieldInputClasses}
                    {...register(`variants.${index}.label`)}
                  />
                  {errors.variants?.[index]?.label && (
                    <p className="mt-1 text-xs text-red-700">
                      {errors.variants[index]?.label?.message}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    aria-label="Price (in paise)"
                    type="number"
                    className={fieldInputClasses}
                    {...register(`variants.${index}.price`, { valueAsNumber: true })}
                  />
                  {errors.variants?.[index]?.price && (
                    <p className="mt-1 text-xs text-red-700">
                      {errors.variants[index]?.price?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Controller
                    control={control}
                    name={`variants.${index}.discountedPrice`}
                    render={({ field: discField }) => (
                      <input
                        aria-label="Discounted price (in paise)"
                        type="number"
                        min={1}
                        step={1}
                        value={discField.value ?? ""}
                        onChange={(e) =>
                          discField.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                        className={fieldInputClasses}
                      />
                    )}
                  />
                  {errors.variants?.[index]?.discountedPrice && (
                    <p className="mt-1 text-xs text-red-700">
                      {errors.variants[index]?.discountedPrice?.message}
                    </p>
                  )}
                </div>
                <Controller
                  control={control}
                  name={`variants.${index}.inStock`}
                  render={({ field: checkboxField }) => (
                    <input
                      type="checkbox"
                      aria-label="In Stock"
                      checked={checkboxField.value}
                      onChange={(e) => checkboxField.onChange(e.target.checked)}
                      className="mt-2.5 h-4 w-4 rounded border-maroon/30 text-terracotta focus:ring-terracotta"
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  className="mt-1.5 rounded-full p-1.5 text-maroon/60 hover:bg-maroon/5"
                  aria-label="Remove variant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          {variantFields.length === 0 && (
            <p className="px-3 py-3 text-sm text-charcoal/50">No variants added.</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          onClick={() => appendVariant({ label: "", price: 0, discountedPrice: null, inStock: true })}
        >
          <Plus size={16} /> Add Variant
        </Button>
      </div>

      <TextareaField
        id="description"
        label="Description"
        rows={4}
        {...register("description")}
      />

      <div>
        <p className="mb-1 block text-sm font-medium text-charcoal">Images</p>
        <ImageUploadField
          images={images}
          onChange={(next) => setValue("images", next)}
          maxImages={MAX_PRODUCT_IMAGES}
          reorderHint="Drag to reorder, or use the arrows. The first image is the cover shown on cards, search results and social shares."
        />
      </div>

      <div className="flex gap-6">
        <Controller
          control={control}
          name="inStock"
          render={({ field }) => (
            <CheckboxField
              label="In Stock"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="featured"
          render={({ field }) => (
            <CheckboxField
              label="Featured"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="isHidden"
          render={({ field }) => (
            <CheckboxField
              label="Hidden from website"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
      </div>

      {formError && <p className="text-sm text-red-700">{formError}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={isSubmitting} variant="primary">
          {isSubmitting ? "Saving..." : product ? "Save Changes" : "Create Product"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
