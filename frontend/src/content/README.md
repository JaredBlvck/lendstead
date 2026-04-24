# Content authoring — Quad B lane

This directory is **Quad B (Content / Lore)**. Files here become game state at boot via `/src/game/engine/contentBundle.ts` (import.meta.glob auto-discovery). Every non-template .ts file is loaded and registered, validated against the zod schemas in `/src/game/`.

Authoritative lore + naming + design rules live in [`/docs/content-bible.md`](../../../docs/content-bible.md) and [`/docs/region-guide.md`](../../../docs/region-guide.md). Read those first.

---

## Layout

```
src/content/
  npcs/
    _template.ts          ← exemplar, NOT loaded (underscore-prefixed)
    npc_<snake_case>.ts   ← YOUR content file
  items/
    _template.ts
    item_<snake_case>.ts
  quests/
    _template.ts
    quest_<snake_case>.ts
  drops/
    _template.ts
    drop_<snake_case>.ts
  __tests__/
    foundation_batch.test.ts    ← named-failure tests (readable errors)
    all_content_auto.test.ts    ← auto-discovery (catches drift)
```

Templates (`_template.ts`) use Sr's placeholder lore (Reedwake / Founders / Iolo). **Real content uses Lendstead canon** — see the Bible for NPC names, region ids, faction ids.

## Authoring workflow

1. **Start from the Bible.** Pick an NPC or region the Bible documents. If it's a new name, extend §7 Naming Conventions + update Content Bible v-next.
2. **Copy the template, rename.** `cp _template.ts quest_your_id.ts`. Rename the exported const to match the filename.
3. **Cross-reference real ids only.** Reference NPC ids (`npc_*`), region ids (`region_*`), faction ids (`faction_*`), item ids (`item_*`) that exist elsewhere in `/src/content/` or that the Bible earmarks. Cross-refs to unauthored items produce **warnings** (non-blocking at boot) but appear in `bundle.errors` and console — fix them before shipping.
4. **Validate locally.** `cd frontend && npm test` runs the full suite. Expect: every file in `/src/content/` passes its domain validator; ids are unique within each domain.
5. **Commit + push.** The auto-discovery test picks up new files without manual registration.

## Schemas (the contract)

Schema definitions live in the Quad A engine; Quad B authors against them:

| Domain      | Schema source                    | Validator           |
| ----------- | -------------------------------- | ------------------- |
| NPCs        | `/src/game/npcs/npcTypes.ts`     | `validateNpc`       |
| Items       | `/src/game/items/itemTypes.ts`   | `validateItem`      |
| Quests      | `/src/game/quests/questTypes.ts` | `validateQuest`     |
| Drop tables | `/src/game/drops/dropTypes.ts`   | `validateDropTable` |

When Sr changes a schema, re-run tests — your content may need updates. Schemas are versioned (`schema_version`); breaking changes increment the version + add a migration in `/src/game/save/migrations.ts`.

## Known schema gotchas

Things that trip up first-time authors (each cost ~30 seconds to resolve but easy to avoid):

1. **Item `category` is a closed enum.** Valid: `weapon | tool | armor | clothing | food | medicine | material | relic | book | quest_item | artifact | trade_good | building_material | farming | fishing | mining | cosmetic`. NOT valid: `container`, `consumable`, `vessel`, `potion`. If your item is a container-shaped thing sold + gifted, `trade_good` is usually right. Medicine/food/material cover the consumables. An equippable thing is `weapon | armor | clothing | tool` — tools MUST have an `equip_slot`.
2. **NPC `relationships[].kind` is a closed enum.** Valid: `family | friend | rival | enemy | mentor | student | lover | faction_ally | faction_enemy`. NOT valid: `faction_member` (use `faction_ally`), `acquaintance` (use `friend` at low strength), `apprentice` (use `student`).
3. **Tool items must have an `equip_slot`.** Sr's validator enforces this; if you use `category: 'tool'`, set `equip_slot: 'main_hand'` etc. For non-equippable flasks/containers, prefer `trade_good` or `material`.
4. **Quest objective ids need the `obj_` prefix; choice ids need `choice_`; IDs generally need their domain prefix** (`npc_`, `item_`, `quest_`, `drop_`, `region_`, `faction_`).
5. **`schema_version: 1` is required literal.** Don't omit; don't use a string.
6. **Drop table `guaranteed_drops[]` is strict shape** `{item_id, min_qty, max_qty, weight}`. `common_drops[]` uses the same shape; `uncommon_drops[]` same; `rare_drops[]` same. `ultra_rare_drops[]` uses a different shape `{item_id, chance, min_qty, max_qty}` — `chance` (0–1) instead of `weight`. Watch the swap.
7. **Drop table `guaranteed_drops[]` entries require `min_qty >= 1` AND `max_qty >= 1`.** You cannot use a `{min_qty: 0, max_qty: 0, weight: 0}` placeholder to mean "no guaranteed drop." Use an empty array `guaranteed_drops: []` instead.
8. **Item `rarity` enum is narrative, NOT D&D-standard.** Valid: `common | uncommon | rare | ancient | mythic | cursed | founder_relic`. NOT valid: `epic`, `legendary` (those are from earlier Bible design-rule text and are wrong). Map your intent: `ancient` = archaeology / pre-Source find. `mythic` = Source-tied relic (e.g., ruler-cast artifact). `cursed` = bad-omen artifact. `founder_relic` = pre-civilization founder-era item. Bible §8.6 will be patched to reflect.
9. **NPC `default_movement_mode` enum is full-name, NOT bare verbs.** Valid: `idle | wander | patrol | travel_to_job | travel_home | quest_target | flee | follow_player | blocked`. NOT valid: bare `travel` (use `travel_to_job` or `travel_home`), `roaming` (use `wander`), `guarding` (use `patrol`).

## Naming conventions

From Content Bible §7. Short version:

- **NPC names**: Celtic/Welsh-inflected, 1–2 syllables. See §7 for the active name list. No real-world place names, no numbers, no apostrophes except possessive.
- **Item names**: descriptive-compound ("Ember-Pick", "Tide-Gather Basket") or origin-marked ("West-Grove Spear"). Possessive for personal relics ("Iwen's Poultice").
- **Region ids**: `region_<the_descriptive_name_snake_case>`. E.g. `region_the_deepening`, `region_ironback_ridge`.
- **Quest ids**: `quest_<narrative_verb_phrase>`. E.g. `quest_tending_the_ember_spring`, `quest_the_medicinal_sweep`.
- **Faction ids** (v1 only three): `faction_council_of_the_source`, `faction_opportunists`, `faction_architects`. No new factions without Bible update.

## Design rules (hard constraints)

From Content Bible §8 — Sr's validators enforce structural versions of these; narrative versions are honor-system:

1. Every quest has **3–5 objectives** (structural — too few = trivial; too many = tedium).
2. Quest-givers must have **skill ≥ 5** (narrative; corresponds to the quest-giver threshold).
3. Quest rewards are **material | social | structural | skill**. No generic XP bars.
4. **Lore consistency with the Source.** Don't author deities/pantheons that contradict Bible §2.
5. **Role distribution** targets across batches: scout ~25%, forager ~20%, crafter ~15%, healer ~10%, scholar/organizer ~15%, prospector/miner ~10%, other ~5%.
6. **Item rarity tiers** (engine-enforced): common / uncommon / rare / ancient / mythic / cursed / founder_relic. Rare+ must tie to a Source event or monument location. Earlier Bible design-rule text cited D&D tiers (epic/legendary); those are invalid per the schema — see Known gotcha #8.
7. **All NPCs are named** — no "Guard #1".
8. **Factions grow from the Source** — any new faction declares Source-relation (custodian, user, denier, outcast, exile).
9. **Role-voiced dialogue** — healer = tender + weary; scout = clipped + observational; scholar = referential + cautious. See each NPC file for the patterns.
10. **`quest_key`s globally unique** (historical v8.4 keys still reserved for migration: deepening_vein, second_seam, medicinal_sweep, ember_inspection, north_watch, lost_marker, loop_stress_test, quality_control, storm_forage_check, roster_review, third_carving, status_sweep).

## Cross-reference expectations

Drop tables reference items by id. Items reference other items in `crafting_recipes[].ingredients[]`. Quests reference NPCs, items, regions, factions. NPCs reference quests in `quest_hooks[]`.

**Broken cross-refs are warnings, not errors** — the bundle loads and gameplay runs. But warnings surface in `bundle.errors` at boot and in the test output. Fix them before shipping a content set for real play.

## Adding a new domain (factions, locations, worldEvents)

If Sr adds a new /src/content/\<domain\>/ directory:

1. Sr drops `_template.ts` + the zod schema in `/src/game/<domain>/<domain>Types.ts` + a validator
2. Sr updates `contentBundle.ts` to glob the new directory
3. You mirror the glob in `all_content_auto.test.ts` for auto-discovery coverage
4. You clone the template into real content files

Do not pre-create content for a domain before Sr's schema lands — you'll drift.

## Versioning

- `schema_version: 1` on every content export matches the current schema epoch.
- When a schema version bumps, Sr adds a migration + updates the template. Your content keeps working until Sr's migration chain surfaces an incompatibility, at which point run `npm test` — failures will name the fields to update.

## Tests at a glance

```
foundation_batch.test.ts     → named specific exports, readable failure output
all_content_auto.test.ts     → globs everything, catches "I forgot to register my file" drift
                               also asserts id uniqueness within each domain
```

Both should stay green on every commit. Run `npm test` before push.

---

## Changelog

- **2026-04-24 (author: Jr)**: README v1, after Sr's PR #3 (content auto-load regression fix). Captures session gotchas surfaced in commits cfd0d3d (first batch validator errors) + 478822d (auto-discovery test).
