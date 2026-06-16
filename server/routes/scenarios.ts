import { Router } from "express";

const router = Router();

/**
 * Pre-authored crisis scenarios for demo / stress-testing the UI.
 */
const SCENARIOS = [
  {
    id: "sc-aviation",
    title: "Aviation Engine Fire (Cockpit)",
    description: "Multi-system notification on commercial jet climbing past 12,000 feet.",
    audioLength: "45 seconds",
    lines: [
      { sender: "speaker", text: "Pan-pan, pan-pan, Houston Departure, Starflight 482. We have a master caution and a left engine fire indication.", delay: 1000, stressLevel: 75 },
      { sender: "responder", text: "Starflight 482, Roger. Houston Departure, state current altitude and intentions.", delay: 4000, stressLevel: 25 },
      { sender: "speaker", text: "Starflight 482 climbing 14,000. Engine failure is confirmed, we have initiated engine shutdown and fire bottles are discharged.", delay: 8000, stressLevel: 80 },
      { sender: "speaker", text: "We are... we are failing to maintain cabin differential pressure. Master alarm is sounding. Requesting immediate return vectors.", delay: 13000, stressLevel: 95 },
      { sender: "responder", text: "Starflight 482, turn left heading 240, descend and maintain 6,000 feet. Emergency is declared.", delay: 19000, stressLevel: 30 },
      { sender: "speaker", text: "Heading 240, down to 6,000. Checklists are incomplete. Copilot is hand-flying. Airspeed is... airspeed is sliding!", delay: 24000, stressLevel: 98 },
      { sender: "speaker", text: "Okay, visual runway in sight. Landing gear coming down. Houston, we are landing with partial hydraulics. Acknowledge please!", delay: 32000, stressLevel: 90 },
      { sender: "responder", text: "Starflight 482, wind 190 at 12 knots, Runway 26 Left, cleared to land. Fire apparatus is standing by.", delay: 38000, stressLevel: 20 },
    ],
    baseAcoustics: { pitch: 280, spectralCentroid: 78, jitter: 14.5, shimmer: 16.2 },
  },
  {
    id: "sc-dispatched",
    title: "911 Emergency Medical Dispatch",
    description: "Rapid heartbeat, breathing difficulty diagnostic in isolated residential zone.",
    audioLength: "36 seconds",
    lines: [
      { sender: "speaker", text: "My father is... he collapsed. He isn't responding! Please, send someone right now!", delay: 1000, stressLevel: 92 },
      { sender: "responder", text: "Okay, I have emergency services en route to 1424 Pine Street. Is he breathing? Can you check his chest?", delay: 5000, stressLevel: 20 },
      { sender: "speaker", text: "I can't... I don't know, he is making a weird gasping noise. His face is pale... I am completely alone here!", delay: 10000, stressLevel: 96 },
      { sender: "responder", text: "I need you to stay calm. Place your hand on his chest. Let's start chest compressions together. I'll count for you.", delay: 16000, stressLevel: 25 },
      { sender: "speaker", text: "Okay, okay, I'm next to him. One, two, three, four... Is he going to wake up? Please tell me he will be okay!", delay: 21000, stressLevel: 88 },
      { sender: "speaker", text: "There are sirens outside! Thank God, they are pulled into the driveway. They are coming in!", delay: 29000, stressLevel: 65 },
    ],
    baseAcoustics: { pitch: 310, spectralCentroid: 85, jitter: 18.2, shimmer: 19.5 },
  },
  {
    id: "sc-server",
    title: "DevOps Production Outage",
    description: "Simulated high-priority technical incident response with datastore corruption.",
    audioLength: "40 seconds",
    lines: [
      { sender: "speaker", text: "The relational database clusters are completely unreachable. API latency is up 12,000 percent. The main shop portal is completely dead.", delay: 1000, stressLevel: 60 },
      { sender: "responder", text: "Do we have backups? Check the AWS status board immediately.", delay: 5000, stressLevel: 30 },
      { sender: "speaker", text: "I checked, the replica failed too! Wait... oh no. Oh no. The primary volume backup file has zero bytes! It's corrupted!", delay: 9000, stressLevel: 89 },
      { sender: "speaker", text: "This is critical, our checkout service is throwing endless 500 errors. We're losing thousands per minute. Directors are hopping on the bridge right now!", delay: 15000, stressLevel: 94 },
      { sender: "responder", text: "Acknowledge. Routing all web traffic to the holding page. Let's redeploy the container cluster from last night's warm snapshot.", delay: 22000, stressLevel: 25 },
      { sender: "speaker", text: "Deploying snap. Rebuilding tables. Key verification passes! Syncing transaction logs. We're coming back up online... slowly.", delay: 29000, stressLevel: 55 },
    ],
    baseAcoustics: { pitch: 210, spectralCentroid: 62, jitter: 8.5, shimmer: 11.2 },
  },
];

router.get("/scenarios", (_req, res) => {
  res.json(SCENARIOS);
});

export default router;
