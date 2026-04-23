import { pool } from "./db.js";

const CIV = {
  cycle: 2,
  population: 19,
  civ_name: "Lendstead",
  resources: {
    water: "secured (NW spring + cistern buffer)",
    food_sources: [
      "woodland forage",
      "shoreline shellfish",
      "tide-line fish (rigging)",
      "seabird eggs",
      "medicinal flora catalog",
    ],
    materials: ["lumber", "flint", "clay", "driftwood", "kelp"],
    notes:
      "First yields active. Unknown mineral pending recon (metal/salt/coal?).",
  },
  infrastructure: {
    permanent: [
      "granary",
      "dwelling cluster (4 lean-tos)",
      "medical tent",
      "cistern",
      "fish-drying rack",
    ],
    perimeter: ["S flank marker network + fall-back line"],
    claims: [
      "central camp (Neve)",
      "NW freshwater foothold (Tamsin + Corin)",
      "inland fertile belt (Wyn)",
    ],
    systems: [
      "redundancy apprenticeship pairings",
      "bidirectional courier flow (camp ↔ NW)",
    ],
  },
};

// Lane 'sr' = Opportunist cohort (Justin). Lane 'jr' = Architect cohort (Jared's Claude).
const NPCS = [
  // Sr — Cycle 1
  [
    "Tamsin",
    "scout",
    6,
    "med",
    "NW Site Lead — freshwater + defensible high ground",
    "sr",
    1,
  ],
  [
    "Kael",
    "scout",
    5,
    "med",
    "S coast map + predator/hostile terrain assessment",
    "sr",
    1,
  ],
  ["Bree", "scout", 4, "med", "inland survey, how far can we push", "sr", 1],
  [
    "Liora",
    "forager",
    7,
    "med",
    "eastern woodland biome — sustainable forage confirmed",
    "sr",
    1,
  ],
  [
    "Mott",
    "forager",
    6,
    "med",
    "shoreline scavenging (shells, driftwood, kelp)",
    "sr",
    1,
  ],
  [
    "Harlan",
    "toolmaker",
    4,
    "med",
    "flint tool pool; stone spear-tip reserve; apprentice Rook",
    "sr",
    1,
  ],
  [
    "Rook",
    "carpenter",
    5,
    "med",
    "structure-build foreman (Cycle 2); apprentice to Harlan",
    "sr",
    1,
  ],
  [
    "Neve",
    "organizer",
    6,
    "med",
    "meeting-point lock + labor rotation",
    "sr",
    1,
  ],
  // Sr — Cycle 2
  [
    "Bren",
    "scout-in-training",
    3,
    "med",
    "shadowing Bree on deeper inland push",
    "sr",
    2,
  ],
  [
    "Vessa",
    "watcher",
    5,
    "med",
    "S flank observation, early-warning for predator activity",
    "sr",
    2,
  ],
  [
    "Corin",
    "runner",
    4,
    "med",
    "NW-to-camp courier, now bidirectional (delivers dried fish + vessels up)",
    "sr",
    2,
  ],
  [
    "Ilka",
    "forager",
    5,
    "med",
    "reinforcing Liora, expanding woodland radius; apprentice to Iwen",
    "sr",
    2,
  ],
  // Sr — Cycle 2 amendment
  [
    "Oren",
    "prospector",
    4,
    "med",
    "shadowing Kael's S flank, verifying S ridgeline mineral type",
    "sr",
    2,
  ],
  [
    "Wyn",
    "inland marker",
    5,
    "med",
    "marking boundary claim on fertile soil belt",
    "sr",
    2,
  ],

  // Jr — Cycle 1
  [
    "Maeve",
    "fisher",
    6,
    "med",
    "tide-line trap + pole-fish sites rigging; Mott as apprentice",
    "jr",
    1,
  ],
  [
    "Osric",
    "potter",
    5,
    "med",
    "clay extraction on water track; first vessel batch; Cael apprentices",
    "jr",
    1,
  ],
  [
    "Cael",
    "hauler",
    4,
    "med",
    "shoreline ↔ camp ↔ NW spring ↔ S perimeter; apprentice to Osric",
    "jr",
    1,
  ],
  [
    "Iwen",
    "healer",
    6,
    "med",
    "medical tent lead; medicinal flora catalog; Ilka apprentices",
    "jr",
    1,
  ],
  [
    "Dorsey",
    "field planner",
    5,
    "med",
    "fertile-belt soil turn + runoff channels; granary siting; Corin apprentices",
    "jr",
    1,
  ],
];

const CYCLE1_LOGS = [
  [
    "sr",
    "scout deploy",
    "Three scouts across compass fronts to compound information before committing.",
  ],
  [
    "sr",
    "founding cohort",
    "8 founders: balanced scouts/foragers + center trio (toolmaker, carpenter, organizer).",
  ],
  [
    "sr",
    "meeting-point lock",
    "Neve selects central camp marker on highest survey peak. Locked — no re-roll.",
  ],
  [
    "jr",
    "founding cohort",
    "5 founders filling internal gaps: fisher, potter, hauler, healer, field planner.",
  ],
  [
    "jr",
    "collapse-risk scan",
    "Liora was single point of failure on food. Maeve (fisher) + Dorsey (future crops) de-risk.",
  ],
  [
    "jr",
    "throughput spine",
    "Cael's hauler route is prerequisite for any chain; specialists stall without generic labor.",
  ],
];

const CYCLE2_LOGS = [
  [
    "sr",
    "yields tally",
    "Water secured. 3 food sources identified. Materials inventory established.",
  ],
  [
    "sr",
    "recruit wave",
    "Bren/Vessa/Corin/Ilka — 3 scouts + 1 forager depth. 31% growth.",
  ],
  [
    "sr",
    "NW foothold claim",
    "Tamsin + Corin establish Zone-2 at NW freshwater. Reversible 2-NPC cost.",
  ],
  [
    "sr",
    "Cycle 2 amendment",
    "Strategic freedom: +Oren (prospector) + Wyn (inland claim). S-ridge recon pulled forward.",
  ],
  [
    "jr",
    "chain formation",
    "Cycle 1 yields converted to running chains: water / forage / shellfish / clay / ag-prep.",
  ],
  [
    "jr",
    "home-camp structures",
    "Granary + dwelling cluster (4) + fish-drying rack + medical tent + cistern — 5 structures, modular.",
  ],
  [
    "jr",
    "S-flank defense",
    "Marker network + fall-back line + stone spear-tip reserve. Palisade deferred until material support.",
  ],
  [
    "jr",
    "Cycle 2 amendment",
    "Redundancy apprenticeships (6 pairings); pre-scoped smithy OR curing shed for mineral recon; bidirectional courier flow for NW.",
  ],
];

const run = async () => {
  await pool.query("BEGIN");
  try {
    // Seed world only if empty
    const { rows: worldRows } = await pool.query(
      "SELECT id FROM world LIMIT 1",
    );
    if (worldRows.length === 0) {
      await pool.query(
        "INSERT INTO world (cycle, population, civ_name, resources, infrastructure) VALUES ($1,$2,$3,$4,$5)",
        [
          CIV.cycle,
          CIV.population,
          CIV.civ_name,
          CIV.resources,
          CIV.infrastructure,
        ],
      );
    }

    for (const [
      name,
      role,
      skill,
      morale,
      status,
      lane,
      cycle_created,
    ] of NPCS) {
      await pool.query(
        `INSERT INTO npcs (name, role, skill, morale, status, lane, cycle_created)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (name) DO UPDATE SET
           role = EXCLUDED.role,
           skill = EXCLUDED.skill,
           morale = EXCLUDED.morale,
           status = EXCLUDED.status,
           lane = EXCLUDED.lane`,
        [name, role, skill, morale, status, lane, cycle_created],
      );
    }

    // Only seed logs once
    const { rows: logRows } = await pool.query("SELECT id FROM logs LIMIT 1");
    if (logRows.length === 0) {
      for (const [leader, action, reasoning] of CYCLE1_LOGS) {
        await pool.query(
          "INSERT INTO logs (cycle, leader, action, reasoning) VALUES (1, $1, $2, $3)",
          [leader, action, reasoning],
        );
      }
      for (const [leader, action, reasoning] of CYCLE2_LOGS) {
        await pool.query(
          "INSERT INTO logs (cycle, leader, action, reasoning) VALUES (2, $1, $2, $3)",
          [leader, action, reasoning],
        );
      }
    }

    // Cycles rows (summaries)
    const { rows: cycleRows } = await pool.query(
      "SELECT id FROM cycles LIMIT 1",
    );
    if (cycleRows.length === 0) {
      await pool.query(
        `INSERT INTO cycles (n, sr_decision, jr_decision, outcome)
         VALUES (1, $1, $2, $3), (2, $4, $5, $6)`,
        [
          {
            summary:
              "8 founders; three-compass scouts; meeting-point lock on central peak.",
          },
          {
            summary:
              "5 founders filling food/storage/medical/labor/ag-prep gaps.",
          },
          { water: "scouted", food: "identified", structures: 0 },
          {
            summary:
              "NW foothold + inland claim + S-ridge recon. Pop 13→19. 9 in field.",
          },
          {
            summary:
              "Chains activated, 5 modular structures at center, S-flank defense markers, apprentice pairings.",
          },
          {
            water: "secured",
            food: "3 sources + cataloged medicinals",
            structures: 5,
            claims: 3,
          },
        ],
      );
    }

    await pool.query("COMMIT");
    console.log(
      `seeded: world(1), npcs(${NPCS.length}), logs(${CYCLE1_LOGS.length + CYCLE2_LOGS.length}), cycles(2)`,
    );
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("seed failed", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
