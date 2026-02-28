import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Data Structure
const database = {
  events: [
    {
      name: "Tata Steel TechEx 2026",
      date: "March 3-5, 2026",
      description: "The 18th Technical Exhibition (TechEx 2026) showcasing student innovations in IoT, Green Tech, and Industrial Safety. Featuring 50+ projects from premier institutes and Tata Steel trainees.",
      organizer: "Tata Steel Limited (Capability Development)",
      location: "SNTI (Shavak Nanavati Technical Institute), Jamshedpur",
      layout_info: "The exhibition is divided into 4 Zones: Zone A (Digitization & IoT), Zone B (Safety & Mankind), Zone C (Green Tech & Materials), and Zone D (Industrial Automation). The central hall features the 'Hall of Fame' showcasing past winners."
    }
  ],
  projects: [
    // Zone A: Digitization & IoT
    {
      title: "IoT-Enabled Gas Leakage Detection Drone",
      category: "Digitization & IoT",
      stall_number: "A-01",
      team_name: "Team SkyGuard (NIT Jamshedpur)",
      description: "Autonomous drone equipped with gas sensors to detect hazardous leaks in pipelines and transmit real-time data to a central dashboard."
    },
    {
      title: "Smart City Traffic Management System",
      category: "Digitization & IoT",
      stall_number: "A-04",
      team_name: "UrbanFlow",
      description: "AI-powered traffic light control system that adapts to real-time vehicle density to reduce congestion."
    },
    {
      title: "DIGIYAAN 2.0: Bus Tracking",
      category: "Digitization & IoT",
      stall_number: "A-07",
      team_name: "TransitTech",
      description: "Enhanced real-time bus tracking system for Tata Steel employees with seat occupancy detection."
    },

    // Zone B: Safety & Mankind
    {
      title: "Smart Blind Stick with Object Recognition",
      category: "Safety & Mankind",
      stall_number: "B-12",
      team_name: "Visionary",
      description: "Assistive walking stick using ultrasonic sensors and AI to narrate obstacles and navigation cues to the visually impaired."
    },
    {
      title: "Sweat-Free PPE Jacket",
      category: "Safety & Mankind",
      stall_number: "B-15",
      team_name: "Team Miner (IIT Madras)",
      description: "A cooling PPE jacket designed for high-heat industrial environments, using phase-change materials."
    },
    {
      title: "Automated Accident SOS System",
      category: "Safety & Mankind",
      stall_number: "B-18",
      team_name: "SafeDrive",
      description: "Vehicle module that automatically alerts emergency services with GPS coordinates upon impact detection."
    },

    // Zone C: Green Tech & Materials
    {
      title: "Eco-friendly Flexible Strain Sensor",
      category: "Green Tech",
      stall_number: "C-22",
      team_name: "Karotimam Innovations",
      description: "Biodegradable sensor made from agricultural waste for monitoring structural health of buildings."
    },
    {
      title: "Wireless EV Charging via Solar Road",
      category: "Green Tech",
      stall_number: "C-25",
      team_name: "SolarWay",
      description: "Prototype road surface embedded with induction coils and solar panels to charge EVs while driving."
    },

    // Zone D: Industrial Automation
    {
      title: "AI Billet Dimension Measurement",
      category: "Industrial Innovation",
      stall_number: "D-30",
      team_name: "SteelVision",
      description: "Computer vision system that measures hot steel billets with 99.9% accuracy in real-time, replacing manual checks."
    },
    {
      title: "Pipe Painting Robot",
      category: "Industrial Innovation",
      stall_number: "D-33",
      team_name: "RoboCoat",
      description: "Crawler robot designed to navigate inside narrow pipes and apply anti-corrosion coating uniformly."
    }
  ]
};

// Write to JSON file
try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
    console.log(`Database seeded to ${DB_PATH} with ${database.events.length} Event and ${database.projects.length} Projects!`);
} catch (err) {
    console.error("Error seeding database:", err);
}