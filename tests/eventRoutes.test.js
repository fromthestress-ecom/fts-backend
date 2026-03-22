import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Event route validation logic (unit)", () => {
  function validateEventPayload(body) {
    const { name, slug, discountType, discountValue, startDate, endDate } = body || {};
    const errors = [];

    if (!name || !slug || !discountType || discountValue == null || !startDate || !endDate) {
      errors.push("Missing required fields");
    }

    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      errors.push("endDate must be after startDate");
    }

    if (discountType === "percent" && (discountValue < 0 || discountValue > 100)) {
      errors.push("Percent discount must be between 0 and 100");
    }

    if (discountType === "fixed" && discountValue < 0) {
      errors.push("Fixed discount must be >= 0");
    }

    return errors;
  }

  it("passes with valid percent event", () => {
    const errors = validateEventPayload({
      name: "Sale He",
      slug: "sale-he",
      discountType: "percent",
      discountValue: 20,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-30T23:59:59Z",
    });
    assert.equal(errors.length, 0);
  });

  it("passes with valid fixed event", () => {
    const errors = validateEventPayload({
      name: "Flash Sale",
      slug: "flash-sale",
      discountType: "fixed",
      discountValue: 50000,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-02T23:59:59Z",
    });
    assert.equal(errors.length, 0);
  });

  it("fails when name is missing", () => {
    const errors = validateEventPayload({
      slug: "test",
      discountType: "percent",
      discountValue: 10,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });
    assert.ok(errors.includes("Missing required fields"));
  });

  it("fails when endDate is before startDate", () => {
    const errors = validateEventPayload({
      name: "Bad Event",
      slug: "bad",
      discountType: "percent",
      discountValue: 10,
      startDate: "2025-06-30T00:00:00Z",
      endDate: "2025-06-01T00:00:00Z",
    });
    assert.ok(errors.includes("endDate must be after startDate"));
  });

  it("fails when percent discount exceeds 100", () => {
    const errors = validateEventPayload({
      name: "Over Sale",
      slug: "over",
      discountType: "percent",
      discountValue: 150,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-30T23:59:59Z",
    });
    assert.ok(errors.includes("Percent discount must be between 0 and 100"));
  });

  it("fails when percent discount is negative", () => {
    const errors = validateEventPayload({
      name: "Neg Sale",
      slug: "neg",
      discountType: "percent",
      discountValue: -5,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-30T23:59:59Z",
    });
    assert.ok(errors.includes("Percent discount must be between 0 and 100"));
  });

  it("passes with 0% discount", () => {
    const errors = validateEventPayload({
      name: "Zero",
      slug: "zero",
      discountType: "percent",
      discountValue: 0,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-30T23:59:59Z",
    });
    assert.equal(errors.length, 0);
  });

  it("passes with 100% discount", () => {
    const errors = validateEventPayload({
      name: "Free",
      slug: "free",
      discountType: "percent",
      discountValue: 100,
      startDate: "2025-06-01T00:00:00Z",
      endDate: "2025-06-30T23:59:59Z",
    });
    assert.equal(errors.length, 0);
  });
});

describe("Event active status logic", () => {
  function isEventCurrentlyActive(event) {
    if (!event.isActive) return false;
    const now = new Date();
    return new Date(event.startDate) <= now && new Date(event.endDate) >= now;
  }

  it("returns true for currently active event", () => {
    const now = new Date();
    assert.equal(
      isEventCurrentlyActive({
        isActive: true,
        startDate: new Date(now.getTime() - 86400000).toISOString(),
        endDate: new Date(now.getTime() + 86400000).toISOString(),
      }),
      true,
    );
  });

  it("returns false when isActive is false", () => {
    const now = new Date();
    assert.equal(
      isEventCurrentlyActive({
        isActive: false,
        startDate: new Date(now.getTime() - 86400000).toISOString(),
        endDate: new Date(now.getTime() + 86400000).toISOString(),
      }),
      false,
    );
  });

  it("returns false for expired event", () => {
    const now = new Date();
    assert.equal(
      isEventCurrentlyActive({
        isActive: true,
        startDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
        endDate: new Date(now.getTime() - 86400000).toISOString(),
      }),
      false,
    );
  });

  it("returns false for future event", () => {
    const now = new Date();
    assert.equal(
      isEventCurrentlyActive({
        isActive: true,
        startDate: new Date(now.getTime() + 86400000).toISOString(),
        endDate: new Date(now.getTime() + 2 * 86400000).toISOString(),
      }),
      false,
    );
  });
});

describe("Order event price re-validation logic", () => {
  function revalidateItemPrice(item, dbProduct, computeEventPrice) {
    if (!dbProduct) return item;
    const withEvent = computeEventPrice(dbProduct);
    return { ...item, price: withEvent.finalPrice };
  }

  const mockComputeEventPrice = (product) => {
    const event = product.eventId;
    if (!event || typeof event !== "object") {
      return { ...product, finalPrice: product.price };
    }
    const now = new Date();
    if (
      !event.isActive ||
      new Date(event.startDate) > now ||
      new Date(event.endDate) < now
    ) {
      return { ...product, finalPrice: product.price };
    }
    if (event.discountType === "percent") {
      return {
        ...product,
        finalPrice: Math.round(product.price * (1 - event.discountValue / 100)),
      };
    }
    return {
      ...product,
      finalPrice: Math.max(0, product.price - event.discountValue),
    };
  };

  it("uses event price when product has active event", () => {
    const now = new Date();
    const item = { productId: "p1", price: 500000, quantity: 1 };
    const dbProduct = {
      _id: "p1",
      price: 500000,
      eventId: {
        isActive: true,
        discountType: "percent",
        discountValue: 20,
        startDate: new Date(now.getTime() - 86400000),
        endDate: new Date(now.getTime() + 86400000),
      },
    };
    const result = revalidateItemPrice(item, dbProduct, mockComputeEventPrice);
    assert.equal(result.price, 400000);
  });

  it("uses original price when product has no event", () => {
    const item = { productId: "p1", price: 500000, quantity: 1 };
    const dbProduct = { _id: "p1", price: 500000 };
    const result = revalidateItemPrice(item, dbProduct, mockComputeEventPrice);
    assert.equal(result.price, 500000);
  });

  it("uses original price when event has expired during checkout", () => {
    const now = new Date();
    const item = { productId: "p1", price: 400000, quantity: 1 };
    const dbProduct = {
      _id: "p1",
      price: 500000,
      eventId: {
        isActive: true,
        discountType: "percent",
        discountValue: 20,
        startDate: new Date(now.getTime() - 2 * 86400000),
        endDate: new Date(now.getTime() - 86400000),
      },
    };
    const result = revalidateItemPrice(item, dbProduct, mockComputeEventPrice);
    assert.equal(result.price, 500000);
  });

  it("returns item as-is when product not found in DB", () => {
    const item = { productId: "p1", price: 500000, quantity: 1 };
    const result = revalidateItemPrice(item, null, mockComputeEventPrice);
    assert.equal(result.price, 500000);
  });
});
