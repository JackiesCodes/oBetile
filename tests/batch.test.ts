import { describe, it, expect } from "vitest";
import { inBatches, orNull } from "@/lib/batch";

/** A task that takes real time and records how many were running alongside it. */
function makeTracker() {
  let inFlight = 0;
  let peak = 0;
  const order: number[] = [];
  const task = (id: number, ms = 10) => async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, ms));
    inFlight--;
    order.push(id);
    return id;
  };
  return { task, peak: () => peak, order };
}

describe("inBatches", () => {
  it("returns results in the order given, not the order they finish", async () => {
    // Deliberately inverted durations: the last task finishes first.
    const tasks = [80, 40, 5].map((ms, i) => async () => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(await inBatches(tasks, 3)).toEqual([0, 1, 2]);
  });

  it("never runs more than the batch size at once", async () => {
    const t = makeTracker();
    const tasks = Array.from({ length: 30 }, (_, i) => t.task(i));
    await inBatches(tasks, 6);
    expect(t.peak()).toBeLessThanOrEqual(6);
  });

  it("actually runs them concurrently rather than one after another", async () => {
    // Seventy-two pages at ~120ms each is over eight seconds sequentially,
    // which is what pushed a full sweep past the function's time limit.
    const tasks = Array.from({ length: 24 }, () => async () => {
      await new Promise((r) => setTimeout(r, 30));
      return 1;
    });
    const started = Date.now();
    await inBatches(tasks, 6);
    const elapsed = Date.now() - started;
    const sequential = 24 * 30;
    expect(elapsed).toBeLessThan(sequential / 2);
  });

  it("handles a task list that does not divide evenly", async () => {
    const t = makeTracker();
    const tasks = Array.from({ length: 7 }, (_, i) => t.task(i, 1));
    expect(await inBatches(tasks, 3)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(t.peak()).toBeLessThanOrEqual(3);
  });

  it("does nothing for an empty list", async () => {
    expect(await inBatches([], 5)).toEqual([]);
  });

  it("refuses a batch size that would never make progress", async () => {
    await expect(inBatches([async () => 1], 0)).rejects.toThrow(/at least 1/);
  });

  it("rejects if a task rejects and nothing wrapped it", async () => {
    // The unguarded behaviour, stated explicitly so orNull's purpose is clear.
    const tasks = [async () => 1, async () => { throw new Error("page 40"); }];
    await expect(inBatches(tasks, 2)).rejects.toThrow("page 40");
  });
});

describe("orNull", () => {
  it("keeps the good results when one task fails", async () => {
    const tasks = [
      async () => "page1",
      async () => { throw new Error("upstream 500"); },
      async () => "page3",
    ].map(orNull);
    expect(await inBatches(tasks, 2)).toEqual(["page1", null, "page3"]);
  });

  it("passes a successful value through untouched", async () => {
    expect(await orNull(async () => ({ a: 1 }))()).toEqual({ a: 1 });
  });

  it("turns a rejection into null rather than swallowing it into undefined", async () => {
    // null is checked for explicitly at the call site; undefined would slip
    // past a truthiness test that happens to be written the other way round.
    expect(await orNull(async () => { throw new Error("x"); })()).toBeNull();
  });
});
