# Lendstead Region Guide v1.0

**Quad B content** · References Content Bible §7 (naming conventions) and §8.5 (role distribution).
**Purpose:** Seed regions for first content authoring batch. Each region has a sensory identity, terrain mix, resource nodes, hazards, NPC affinities, and story hooks. Named per Bible conventions (geographic + sensory compound).

---

## Region 1 — **The Tidefast**

**Terrain family:** coastal + beach, some shallow cove water
**Tile bounds (v1 sketch):** x∈[0, 12], y∈[16, 23] — southwest coastal arc
**Sensory identity:** salt spray, gull-cries, rhythmic surf, wet stone
**Terrain mix:** 60% beach, 30% shallow water, 10% plains
**Resource nodes:**

- shellfish beds (renewable, fast respawn)
- driftwood (slow respawn, storm-boosted)
- kelp mats (fishery adjacent)
- tide-pool glass shards (uncommon)

**Wildlife:** seabirds (harmless), crabs (harvestable), gull-raiders (take eggs from coops)
**Hazards:** storm surge during coastal storms (flood interior tiles), riptides (NPCs without canSwim capability get stuck)
**Unlock requirements:** none — starting zone for Sr lane foragers + shoreline-mappers
**NPC affinities (role-residence bias):** forager-trader (Alda), shoreline-mapper, scout-archaeology
**Story hooks:**

- Ancient shoreline carving discovered C26 [14,10] — The Tide-Wainscot (pre-Source pictography)
- Fishing fleet cove #2 at [25,9] — actually outside this region, but "sister cove" narratively
- Storm-breaker cairn: players can build a low stone ring that downgrades storm severity locally (structural reward for a v2 quest)

---

## Region 2 — **The Deepening**

**Terrain family:** interior plains, pierced by ore veins and forest pockets
**Tile bounds:** x∈[13, 25], y∈[8, 16] — central corridor
**Sensory identity:** dry grass, low-humming wind through plains, distant forge-thump from crafter row, ore-dust on boots
**Terrain mix:** 70% plains, 15% forest, 15% mountain (the Ironback spurs that penetrate south)
**Resource nodes:**

- ore veins #1-#4 at [19,15], [11,12], [18,10], [19,9] (confirmed canon from memory)
- berry groves at [19,11], [14,6], [15,8]
- herb cluster at [18,11] — Iwen's priority claim

**Wildlife:** inland birds (signal flocks change means seasonal turn), field mice (harmless), plains hare (sparse food)
**Hazards:** predator packs drift through on cycles where threat_sighted rolls — especially north of y=12
**Unlock requirements:** none — the default "home corridor"
**NPC affinities:** prospector (Oren), crafter chains (Rook → Dorsey → Harlan), healer (Iwen near herb cluster), organizer (Neve)
**Story hooks:**

- "The Inland Corridor Hypothesis" — Bible ref: prior inhabitants lived in [14-19, 8-15], displaced by predator pack. Quest chain possibility: evidence-gathering → predator confrontation → reclamation
- Second Seam Hypothesis — ore vein #4 might be a continuation of #3 (lore reference for the `second_seam` quest_key)
- Ember-Spring at [?,?] — custodian Wyn. Exact coords lore-locked; quest `ember_inspection` references this

---

## Region 3 — **Ironback Ridge**

**Terrain family:** mountain spine, northern
**Tile bounds:** x∈[8, 35], y∈[0, 6] — northern ridge arc
**Sensory identity:** cold stone, wind through saddle passes, echo of ore-hammer, eagle-cry at dawn
**Terrain mix:** 55% mountain, 30% high plains, 15% forest cloak at the treeline
**Resource nodes:**

- high-grade ore (caps out better than The Deepening seams)
- mountain herbs (different cluster from Iwen's — rarer, higher healing potency)
- eyrie feathers (uncommon crafting material, from abandoned nests)
- cold-spring water (purest on the island)

**Wildlife:** mountain eagles (scout ally in narrative, non-combat), ibex (occasionally hunted), ice-bats (mild threat at night)
**Hazards:** altitude fatigue (NPCs without canClimbCliffs capability move at 0.5x), cold exposure during storm events (amplifies injuries), rockslide risk during terrain_shape nearby
**Unlock requirements:** scout-ranger skill ≥ 6 OR a cleared path quest
**NPC affinities:** scout-ranger Halvard, inland marker Wyn (makes pilgrimage visits)
**Story hooks:**

- Ancient carvings #1 at [24,11] extend into Ironback — the mountain is half of the pre-Source civilization's grave
- "The Frost-Hollow" — a natural cave that narrative lore says leads down to a pre-Source ruin
- Terrain shaping here is politically sensitive — rulers who reshape mountain tiles draw overuse trust-drift faster (narrative rule: "the mountain remembers")

---

## Region 4 — **Wren-Meadow**

**Terrain family:** forest (named after Wren, the first carpenter)
**Tile bounds:** x∈[2, 12], y∈[7, 14] — western interior forest
**Sensory identity:** leaf-rustle, deep shade at noon, resin + fresh-cut wood, low-frequency birdsong
**Terrain mix:** 80% forest, 15% plains clearings, 5% stream
**Resource nodes:**

- hardwood (carpenter + smith haft supply)
- deadfall kindling (fast respawn, storm-boosted)
- medicinal bark (healer minor resource)
- moss — for thatch roofing

**Wildlife:** woodland deer (food), burrow-foxes (harmless), woodthrushes (omen bird — singing = good morale in folklore)
**Hazards:** wildfire during dry streak (if dry_streak ≥ 5 cycles + storm hasn't hit), getting lost for low-skill scouts
**Unlock requirements:** none — adjacent to The Deepening
**NPC affinities:** crafter-family (Wren, Harlan when crafting), scout-in-training (forest makes safe apprentice route)
**Story hooks:**

- Wren's first workshop was here — canonical site. v2 quest "Return to Wren-Meadow" for any crafter at skill ≥ 7
- A grove of silver-barked trees used only for ceremonial carving — tied to the ancient carving sites
- Woodthrush nest omens — a v2 mechanic: finding a full nest gives +1 morale for the finder's faction for 5 cycles

---

## Region 5 — **Gull-Cove**

**Terrain family:** narrow coastal cove (smaller than The Tidefast)
**Tile bounds:** x∈[24, 33], y∈[18, 22] — southeast shoreline pocket
**Sensory identity:** narrow-canyon acoustics (sound bounces), loud surf, tar from fishing boats, rope-and-net, grilled fish on the evening fire
**Terrain mix:** 50% beach, 40% water, 10% plains (narrow)
**Resource nodes:**

- fishing grounds (canonical cove #2 at [25,9] — wait that's different; Gull-Cove is a separate smaller cove at [28,20] approx)
- sea-salt (evaporation flats, slow respawn)
- driftwood (shared with The Tidefast but separate pool)
- shell-pearls (rare cosmetic + uncommon trade item)

**Wildlife:** gulls (obvious), cormorants, crab clusters, seal colony (seasonal — if we ship seasons)
**Hazards:** storm surge (worse than The Tidefast because cove geometry funnels it), fishing-boat launch failures during major storms
**Unlock requirements:** none for forager/fisher roles; quest "Gull-Cove Survey" for scouts to access the seal colony
**NPC affinities:** fisher (Fin), forager-trader (Alda visits for salt), runner for inland transport
**Story hooks:**

- The Seal Colony — an annual arrival v2 mechanic, could be a one-shot "Seal-Moot" event with faction-specific consequences (opportunist gets hunt rights, architect forbids it)
- Shell-pearl bracelet tradition — a craftable item tier (uncommon) that bonded pairs can gift each other (ties into affinity system — bonded tier gifts that render visually)
- "Brine-Whisper" — Gull-Cove has acoustic dead zones where sounds carry in unexpected ways. Folklore says the Source speaks here first when it's about to manifest (narrative foreshadowing hook for ruler casting)

---

## Cross-region integration

- **The Deepening** is the pivot region — all others border it. Narrative default journeys radiate from here
- **The Tidefast ↔ Gull-Cove**: shared shoreline identity, Alda carries goods between them
- **The Deepening ↔ Ironback Ridge**: ore chain continues into the mountain; a v2 quest evolves the `second_seam` story into a multi-region climb
- **The Deepening ↔ Wren-Meadow**: crafter supply chain (wood in, tool heads out)
- **Ironback Ridge ↔ Wren-Meadow**: not adjacent — crossing requires traversing The Deepening. Route attracts bandits in v2

---

## Author notes (when content files land)

- Keep region `id`s as `the_tidefast`, `the_deepening`, `ironback_ridge`, `wren_meadow`, `gull_cove` (snake_case)
- Reference terrain tiles with `[x, y]` arrays — match the backend grid
- `resource_nodes[]`: each entry has `{kind, coords, respawn_rate, rarity}`
- `wildlife[]`: `{kind, behavior, rarity}`
- `hazards[]`: `{kind, trigger_condition, effect}`
- `unlock_requirements[]`: `{capability | quest_completed | skill_min}`
- All NPC affinity-to-region is SOFT — NPCs drift, but story hooks anchor named NPCs to specific regions (Iwen → The Deepening, Halvard → Ironback Ridge, Alda → The Tidefast/Gull-Cove, Wren → Wren-Meadow)

## Version History

- **v1.0 (2026-04-24)**: Initial Region Guide, 5 seed regions covering coast / interior / mountain / forest / cove. Authored during Sr's Phase 2 sprint, locked against Content Bible v1 naming + Source canon.
