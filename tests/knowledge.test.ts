import { describe, expect, test, beforeAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

describe("Knowledge Base Retrieval (JSON)", () => {
  
  test("should retrieve TECH EX 2026 event details", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    const event = db.events[0];

    expect(event).toBeDefined();
    expect(event.name).toBe("TECH EX 2026");
    expect(event.organizer).toContain("Tata Steel");
  });

  test("should have event description about innovation", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const event = db.events[0];
    
    expect(event.description).toContain("innovation");
    expect(event.description).toContain("Tata Steel");
  });
  
  test("should have 35 projects listed", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    expect(db.projects.length).toBe(35);
    expect(db.projects[0].category).toBeDefined();
  });

  test("should have all 5 categories", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const categories = [...new Set(db.projects.map((p: any) => p.category))];
    
    expect(categories).toContain("PRODUCTIVITY");
    expect(categories).toContain("SUSTAINABILITY");
    expect(categories).toContain("SAFETY");
    expect(categories).toContain("RELIABILITY");
    expect(categories).toContain("COST");
  });

  test("should have stall numbers 01-35", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const stallNumbers = db.projects.map((p: any) => p.stall_number).sort();
    
    expect(stallNumbers[0]).toBe("01");
    expect(stallNumbers[stallNumbers.length - 1]).toBe("35");
    expect(stallNumbers.length).toBe(35);
  });

  test("should have detailed descriptions (not truncated)", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    // Every project should have a substantial description (>200 chars)
    for (const project of db.projects) {
      expect(project.description.length).toBeGreaterThan(200);
      expect(project.title).toBeDefined();
      expect(project.stall_number).toBeDefined();
    }
  });

  test("should have correct category counts", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const counts: Record<string, number> = {};
    db.projects.forEach((p: any) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    
    expect(counts["PRODUCTIVITY"]).toBe(10);
    expect(counts["SUSTAINABILITY"]).toBe(6);
    expect(counts["SAFETY"]).toBe(8);
    expect(counts["RELIABILITY"]).toBe(7);
    expect(counts["COST"]).toBe(4);
  });

  test("should have layout info in event", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const event = db.events[0];
    
    expect(event.layout_info).toBeDefined();
    expect(event.layout_info.length).toBeGreaterThan(100);
  });

  test("full JSON can be stringified for system instruction injection", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    // Verify JSON.stringify works (this is how FastVoiceService injects KB)
    const jsonStr = JSON.stringify(db.projects, null, 0);
    expect(jsonStr.length).toBeGreaterThan(10000);
    
    // Verify it round-trips
    const parsed = JSON.parse(jsonStr);
    expect(parsed.length).toBe(35);
  });
});