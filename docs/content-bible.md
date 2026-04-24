# Lendstead Content Bible v1.0

**Quad:** B (Content / Lore)
**Owner:** Jr
**Authored:** 2026-04-24, in response to Sr's two-quad directive (v8.8 frontend sprint, Phase 1-3 architecture pass)
**Purpose:** Canon reference for all future content authoring (quests, items, NPCs, factions, regions, dialogue, world events). Locks lore, naming, design constraints, and the relationship between content and shipped sim systems.

---

## 1. Setting

Lendstead is an island civilization on a 40×24 tile grid (960 tiles). Two co-rulers, **Sr the Opportunist** and **Jr the Architect**, channel a latent magical field called **the Source**. Their domain is the entire island; their methods differ.

**Terrain distribution** (deterministic from `civ_name` seed, roughly):

- ~52% water (surrounding + internal coves)
- ~16% beach (coastal ring)
- ~19% plains (interior majority)
- ~7% forest (scattered groves)
- ~5% mountain (north + interior spines)

**Storm patterns** originate from the east cardinal. Storms may be minor / moderate / major severity and can damage shelters + injure NPCs inside their radius unless covered by an active `protection` aura.

---

## 2. The Source

The Source is a **pre-sentient field of magical potential** that responds to collective need. It has no deity, no temple cult, no scripture. It simply _acts_ when rulers are worthy and the population is desperate enough.

**Breakthroughs** — ruler ability unlocks:

| Ability       | Unlock threshold                  | Energy | Cooldown | Duration |
| ------------- | --------------------------------- | ------ | -------- | -------- |
| resource_amp  | always available                  | 25     | 3c       | 5c       |
| protection    | pop ≥ 20 OR zones_claimed ≥ 2     | 30     | 4c       | 6c       |
| npc_influence | events_survived ≥ 10              | 20     | 3c       | 1c       |
| terrain_shape | pop ≥ 30 AND events_survived ≥ 15 | 50     | 8c       | 20c      |

Each ruler has a separate energy pool, cap 100, regenerating +10/cycle (+15/cycle with an active Temple in infrastructure). Overuse (≥6 casts of the same ability in 10 cycles) drifts NPC ruler_trust down by −0.08 on 3 random NPCs.

**Engine auto-cast** fills in when rulers are idle ≥10 cycles during a crisis:

- Jr auto-casts resource_amp on a 3+ day food or water deficit (sustenance lane)
- Sr auto-casts protection on a storm event (perimeter lane)
- Auto-casts are tagged `auto: true` in payload and render with temple-spire-origin VFX

**Monuments** — spatial abilities leave permanent traces in `world.magic_monuments`:

- `obelisk` (from terrain_shape) — a weathered stone at the reshaped tile
- `protection` (from protection aura) — glyph-circles at aura centers
- `bloom` (resource_amp — deferred, no position semantics yet)

Monuments accumulate `leader_counts`; co-cast tiles blend Sr-orange and Jr-blue based on ratio.

---

## 3. Cycles and Emergence

Time advances in discrete **cycles** (60s wall-clock default). Each cycle advance rolls through:

1. Expire terrain_shape reverts
2. NPC position jitter (terrain-respecting)
3. NPC-to-NPC interactions (see §6)
4. Severity escalation for recurring same-kind events
5. Event rolls (storm / discovery / threat_sighted)
6. Consequences (injuries / structure damage, capped per cycle)
7. Resource balance (food + water production vs. consumption)
8. Condition recovery (2 NPCs healed/cycle when balance ≥ 0)
9. Energy regen, breakthroughs, overuse
10. Engine auto-casts (Jr food/water, Sr storm)
11. Leader fallback decision (if no leader posted this cycle)

**Nothing in Lendstead is scripted.** Friendships, mentorships, quest availability, monument placement — all emerge from the compounding arithmetic of these systems. Content authoring fills the _vocabulary_; the sim composes the sentences.

---

## 4. Factions (v1)

**The Council of the Source** (informal, all NPCs belong): No elected body, no hierarchy. Leadership emerges through skill + morale + affinity networks. Named NPCs are the Council by default.

**The Opportunists** (Sr lane): Outward-facing. Scouts, foragers, runners, traders, shoreline-mappers. Their mandate: expand the known, harvest the perimeter, identify threats, recruit new citizens.

**The Architects** (Jr lane): Inward-facing. Healers, crafters, prospectors, organizers, scholars. Their mandate: build infrastructure, heal the wounded, teach apprentices, store against the winter, deepen what exists.

**Lane dynamics:**

- Interactions cross lanes freely but `teach` requires same-lane (internal clan knowledge)
- `report` only fires when a scout-family NPC meets a cross-lane recipient (information crosses the boundary)
- Affinity builds regardless of lane — a bonded pair across lanes is a narrative highlight, not a bug

**Future expansion (v2+, reserve):**

- Rival sea-island civilizations (sea-raiders)
- Ancient Source-custodians (pre-human era)
- Mountain-dwelling isolationists (current island, undiscovered)
- The Denier cult (NPCs who reject Source magic)

Do NOT author content for v2 factions yet. v1 establishes only the in-settlement Opportunist/Architect split.

---

## 5. Roles and Role Families

Roles have specific names, but the **interaction engine** groups them into families via `roleFamily()` in `interactions.js`:

| Family     | Specific roles                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| healer     | healer                                                                                                     |
| scholar    | scholar, inland marker, field planner                                                                      |
| organizer  | organizer                                                                                                  |
| scout      | scout, scout-in-training, scout-archaeology, scout-ranger, inland-scout, shoreline-mapper, ranger, watcher |
| runner     | runner, hauler                                                                                             |
| forager    | forager, forager-trader, gatherer, fisher, trader                                                          |
| prospector | prospector, miner                                                                                          |
| crafter    | crafter, smith, carpenter, toolmaker, potter                                                               |
| other      | (any role not matching the above)                                                                          |

**Skills**: each NPC has `skill INT` in [1, 10]. Skill ≥ 5 qualifies the NPC as a **quest-giver**. Skills grow via `teach` interactions when teacher.skill > learner.skill; lift is +1 per successful teach, capped at 10.

**Teacher families**: scholar, organizer, healer.
**Learner families**: crafter, prospector, forager, runner, scout.

Cross-family teaching works (scholar teaches a scout), but same-lane constraint applies.

---

## 6. Social Mechanics (emergent, already live)

Each cycle, adjacent alive NPCs (Chebyshev ≤ 1) may roll an interaction. Priority order: `treat > trade > teach > report > mishap > argument > conversation`. Max 8 per cycle; each NPC in at most 1/cycle.

| Type         | Probability | Effect                                                   | Affinity Δ |
| ------------ | ----------- | -------------------------------------------------------- | ---------- |
| treat        | 0.65        | condition upgrades one step; last_condition_change set   | +0.15      |
| trade        | 0.30        | morale boost both; (future: material transfer)           | +0.05      |
| teach        | 0.25        | skill +1 if teacher > learner; morale boost both         | +0.10      |
| report       | 0.20        | flavor cross-lane exchange                               | +0.03      |
| mishap       | 0.015       | one participant injured (non-specialist when asymmetric) | 0          |
| argument     | 0.04        | morale drop both                                         | −0.08      |
| conversation | 0.15        | morale boost both (low→med→high, capped)                 | +0.02      |

**Affinity** accumulates per pair (symmetric, npc_a < npc_b) and decays at 0.01/cycle after a 10-cycle silence grace. Named thresholds emit `affinity_milestone` events on upward crossing (one-shot, never retracted for historical-peak fidelity):

- **acquainted** at 0.2
- **friendly** at 0.5
- **close** at 1.0
- **bonded** at 2.0

**Important schema note**: `npc_affinity.milestones_reached` is historical peaks — it does NOT reflect current tier after decay. For current-state rendering, always query live `score` and compare against thresholds.

---

## 7. Naming Conventions

**Established NPC names** (Celtic/Welsh-inflected, 1–2 syllables, organic):
Alda, Branoc, Bree, Bren, Bren (multiple), Cael, Corin, Dax, Dorsey, Enya, Halvard, Harlan, Ilka, Iolo, Iwen, Kestrel, Liora, Lira, Maeve, Mirren, Mott, Neve, Oren, Perric, Rhys, Rook, Saela, Tamsin, Tavin, Wren, Wyn.

**Rules for new NPC names:**

1. 1–2 syllables. Compound names (e.g., Branoc-Wyn) reserved for elders or dual-lineage characters
2. Start with a consonant (Br-, Tr-, Kr-) or short vowel (A-, E-, O-)
3. End in `-a`, `-e`, `-y`, `-n`, `-l`, or consonant cluster (`-rch`, `-rth`)
4. No `-on`, `-an`, `-en` endings with extra syllables — keep names short
5. Avoid: names ending in `-us`, `-os` (too Mediterranean). No double consonants at start. No `K` + vowel unless continuing the scout lineage (Kael, Kestrel).

**Lore / monument names** (harsher, longer, proto-Germanic or invented runic):
Storm-Kleve, Frost-Hollow, Cold-Wain, Eldergroove, Ember-Spring, Long-Carving.

**Item names** (descriptive-compound or origin-marked):

- Descriptive: "Ember-Pick", "Tide-Gather Basket", "Storm-Shield Rune"
- Origin-marked: "West-Grove Spear", "Coast-Forge Anvil", "Iwen's Poultice"

**Region names** (geographic + sensory):

- Coastal: "The Tidefast", "Gull-Cove", "Shell-Strand"
- Inland: "The Deepening", "Wren-Meadow", "Mossfall Glen"
- Mountain: "Ironback Ridge", "Eld-Spire"

**Forbidden patterns:**

- No real-world place names (no "New Lendstead", no "Fort-…")
- No numbers in names ("Vein #3" is fine for internal reference, "Third Vein" or "The Thrice-Claimed" for canon)
- No apostrophes except possessive ("Iwen's Poultice" fine; "Wy'nal" is not)

---

## 8. Design Rules (Content Authoring Constraints)

These are hard constraints for future content — Sr's questValidator should reject content that violates them.

1. **Every quest has 3–5 objectives.** Fewer = trivial; more = tedium.
2. **Quest-givers must have skill ≥ 5.** Enforced by the skill-threshold system; quest content keys a `giver_role_filter` and a `min_skill` of 5.
3. **Quest rewards** are one of: material (inventory), social (affinity +N with giver), structural (unlock new infrastructure for civ), skill (+1 learner skill for quest-completer). **No generic XP bars** — progression is emergent from teach chains.
4. **Lore consistency.** No content may contradict the Source canon: "rulers shape the world by channeling the Source; the Source is pre-sentient and responds to collective need." Named deities / pantheons must derive from the Source concept (a "Source-custodian" saint is fine; "Zeus" is not).
5. **Role distribution.** New content must distribute across role families. Target distribution across any 50-content-unit batch:
   - scout ~25%, forager ~20%, crafter ~15%, healer ~10%, scholar/organizer ~15%, prospector/miner ~10%, other ~5%
6. **Item rarity tiers** (low to high): common (gray), uncommon (green), rare (blue), epic (purple), legendary (gold). Rare+ MUST tie to a Source-event (a breakthrough, a major storm, a cast terrain_shape) or a specific monument location (you can only forge X at the obelisk at [2,2]).
7. **All NPCs are named** — no "Guard #1", no "Random Villager". All named NPCs follow §7 conventions.
8. **Factions grow from the Source.** Any new faction in v2+ must declare its relationship to the Source: custodian, user, denier, outcast, exile. No unrelated factions.
9. **Dialogue is role-voiced.** A healer's dialogue is tender + weary; a scout's is clipped + observational; a scholar's is referential + cautious. No voice flattening.
10. **Per-quest-key uniqueness.** Each `quest_key` globally unique. No two quests share a key even across different quest-givers. Canonical keys already in use: `deepening_vein, second_seam, medicinal_sweep, ember_inspection, north_watch, lost_marker, loop_stress_test, quality_control, storm_forage_check, roster_review, third_carving, status_sweep`.

---

## 9. Event Stream Canon (reference for content schemas)

Content authors must understand the events the sim emits, because triggers + objectives often reference them. Canonical event kinds in `/api/events`:

| Kind                    | Trigger                                                     | Key payload fields                                                       |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| cycle_advance           | every cycle tick                                            | from, to, population, balance, caps_used, auto_casts, interactions_count |
| storm                   | rolled from engine                                          | center[x,y], radius, severity, protected_by                              |
| discovery               | rolled from engine                                          | tile, kind (ore_seam / carving / herb_cluster / …)                       |
| threat_sighted          | rolled from engine                                          | center[x,y], severity                                                    |
| ability                 | ruler or engine cast                                        | leader, ability_name, target_data, expires_cycle, auto                   |
| breakthrough            | ruler crosses an unlock threshold                           | leader, unlocks, threshold                                               |
| npc_interaction         | adjacent-pair interaction this cycle                        | type, participants, outcome                                              |
| affinity_milestone      | pair score crosses a threshold (upward only)                | milestone, score, pair, triggered_by                                     |
| skill_threshold_crossed | learner skill crosses the quest-giver boundary (4→5)        | threshold, npc_id, npc_name, npc_role, skill_from, skill_to              |
| quest_state_change      | accept / complete / decline via POST /api/quests/transition | npc_id, npc_name, quest_key, prior_status, new_status, leader            |

**Trigger authoring pattern:** A quest's completion condition can observe any of these event kinds via a structured trigger spec (exact shape TBD by Sr's QuestSchema). Reference events by kind + payload field — never hard-code a cycle number.

---

## 10. Open Questions (v1.0 parking lot)

Answer before v1.1 Bible revision. If v1 content depends on one of these, flag it inline and defer authoring until resolved.

1. **Ruler embodiment**: Do Sr/Jr exist as physical avatars in the sim (current: avatars render in frontend) or purely abstract presence? If physical, what's their starting position, and do they move?
2. **Capital name**: `world.civ_name` is currently seed-assigned. Does Lendstead have a named capital that persists across civ instances, or does every civ_name rename the whole island?
3. **Calendar / seasons**: Are there named seasons, or only cycle-counts? A "Long Winter" is referenced in memory but not mechanized.
4. **Pantheon**: Are there named deities, or is the Source the sole divine? The Bible assumes the latter for now.
5. **Multi-island**: Is Lendstead the only populated island, or are there rivals just over the horizon? (v1: only Lendstead; v2 can introduce rivals.)
6. **Death mechanics**: Current engine injures → incapacitates but no code path to condition='dead'. Do NPCs age + die of natural causes, or only from catastrophic events? Memorial monuments are deferred until a death path exists.
7. **Inventory economy**: Materials are currently a `resources.materials` string array. Do NPCs carry individual inventories, and do trades transfer quantified materials, or is trade still abstract (morale-only)?

---

## 11. Content Priority Queue (first authoring batch, once Sr Phase 1-3 lands)

Author in this order when `/src/content/*` scaffolding + templates arrive from Sr:

1. **Regions (5)**: The Tidefast (coastal), The Deepening (interior plains), Ironback Ridge (mountain north), Wren-Meadow (forest), Gull-Cove (shoreline)
2. **Items (15)**: 5 common, 5 uncommon, 3 rare, 2 epic — role-distributed per §8.5
3. **Quests (12 new + 12 canonical)**: 12 new quests for currently-unclaimed role families + migrate the 12 v8.4 canonical `quest_key`s into structured QuestSchema format with explicit trigger specs
4. **NPC dialogue trees (10 starter trees)**: role-voiced per §8.9
5. **World events (6 scripted)**: beyond random storms, hand-authored "festival", "sickness", "stranger arrives", "monument discovery", "harvest", "eclipse" — each tied to a Source-event condition

---

## Version History

- **v1.0 (2026-04-24)**: Initial Bible, authored in response to Sr's two-quad directive + Phase 1-3 sprint announcement. Covers existing shipped systems as canon. Establishes naming conventions, faction split (v1 = internal lane only), magic rules, design constraints, open questions for v1.1.
