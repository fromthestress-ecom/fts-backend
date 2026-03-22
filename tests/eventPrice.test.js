import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeEventPrice, applyEventPricing } from "../utils/eventPrice.js";

describe("computeEventPrice", () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 86400000);
  const futureDate = new Date(now.getTime() + 86400000);
  const farFuture = new Date(now.getTime() + 2 * 86400000);

  it("returns original price when no eventId", () => {
    const product = { _id: "p1", price: 500000 };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 500000);
    assert.equal(result.eventDiscount, null);
  });

  it("returns original price when eventId is a string (not populated)", () => {
    const product = { _id: "p1", price: 500000, eventId: "some-id" };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 500000);
    assert.equal(result.eventDiscount, null);
  });

  it("applies percent discount for active event", () => {
    const product = {
      _id: "p1",
      price: 500000,
      eventId: {
        _id: "e1",
        name: "Sale He",
        isActive: true,
        discountType: "percent",
        discountValue: 20,
        startDate: pastDate,
        endDate: futureDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 400000);
    assert.deepEqual(result.eventDiscount, {
      eventId: "e1",
      eventName: "Sale He",
      discountType: "percent",
      discountValue: 20,
      originalPrice: 500000,
    });
  });

  it("applies fixed discount for active event", () => {
    const product = {
      _id: "p1",
      price: 500000,
      eventId: {
        _id: "e1",
        name: "Flash Sale",
        isActive: true,
        discountType: "fixed",
        discountValue: 100000,
        startDate: pastDate,
        endDate: futureDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 400000);
    assert.equal(result.eventDiscount.discountType, "fixed");
  });

  it("does not go below zero for fixed discount", () => {
    const product = {
      _id: "p1",
      price: 50000,
      eventId: {
        _id: "e1",
        name: "Big Sale",
        isActive: true,
        discountType: "fixed",
        discountValue: 100000,
        startDate: pastDate,
        endDate: futureDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 0);
  });

  it("returns original price when event is inactive", () => {
    const product = {
      _id: "p1",
      price: 500000,
      eventId: {
        _id: "e1",
        name: "Old Sale",
        isActive: false,
        discountType: "percent",
        discountValue: 20,
        startDate: pastDate,
        endDate: futureDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 500000);
    assert.equal(result.eventDiscount, null);
  });

  it("returns original price when event has not started yet", () => {
    const product = {
      _id: "p1",
      price: 500000,
      eventId: {
        _id: "e1",
        name: "Future Sale",
        isActive: true,
        discountType: "percent",
        discountValue: 30,
        startDate: futureDate,
        endDate: farFuture,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 500000);
    assert.equal(result.eventDiscount, null);
  });

  it("returns original price when event has expired", () => {
    const expired = new Date(now.getTime() - 2 * 86400000);
    const product = {
      _id: "p1",
      price: 500000,
      eventId: {
        _id: "e1",
        name: "Expired Sale",
        isActive: true,
        discountType: "percent",
        discountValue: 30,
        startDate: expired,
        endDate: pastDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, 500000);
    assert.equal(result.eventDiscount, null);
  });

  it("rounds percent discount to integer", () => {
    const product = {
      _id: "p1",
      price: 333333,
      eventId: {
        _id: "e1",
        name: "Odd Sale",
        isActive: true,
        discountType: "percent",
        discountValue: 15,
        startDate: pastDate,
        endDate: futureDate,
      },
    };
    const result = computeEventPrice(product);
    assert.equal(result.finalPrice, Math.round(333333 * 0.85));
    assert.equal(typeof result.finalPrice, "number");
  });
});

describe("applyEventPricing", () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 86400000);
  const futureDate = new Date(now.getTime() + 86400000);

  it("applies pricing to an array of products", () => {
    const products = [
      { _id: "p1", price: 500000 },
      {
        _id: "p2",
        price: 300000,
        eventId: {
          _id: "e1",
          name: "Sale",
          isActive: true,
          discountType: "percent",
          discountValue: 10,
          startDate: pastDate,
          endDate: futureDate,
        },
      },
    ];
    const results = applyEventPricing(products);
    assert.equal(Array.isArray(results), true);
    assert.equal(results.length, 2);
    assert.equal(results[0].finalPrice, 500000);
    assert.equal(results[1].finalPrice, 270000);
  });

  it("applies pricing to a single product", () => {
    const product = { _id: "p1", price: 200000 };
    const result = applyEventPricing(product);
    assert.equal(result.finalPrice, 200000);
    assert.equal(Array.isArray(result), false);
  });
});
