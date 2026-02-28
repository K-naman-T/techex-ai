import { describe, expect, test, beforeAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

describe("Knowledge Base Retrieval (JSON)", () => {
  
  test("should retrieve Tata Steel TechEx 2026 details", () => {
    // Read the JSON DB
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    // Find the main event
    const event = db.events.find(e => e.name === 'Tata Steel TechEx 2026');

    expect(event).toBeDefined();
    expect(event.name).toBe("Tata Steel TechEx 2026");
    expect(event.date).toBe("March 3-5, 2026");
    expect(event.organizer).toContain("Tata Steel");
  });

  test("should have description about student innovation", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const event = db.events.find(e => e.name === 'Tata Steel TechEx 2026');
    
    expect(event.description).toContain("student");
    expect(event.description).toContain("IoT");
  });
  
  test("should have projects listed", () => {
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    
    expect(db.projects.length).toBeGreaterThan(0);
    expect(db.projects[0].category).toBeDefined();
  });
});