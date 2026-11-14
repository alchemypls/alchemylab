## 2026-11-14 — bestiary, herbs & alchemy, linked pieces
Decided: the trees are the kingdom's old alchemy herbs, lore only (setting updated). The dragon's name stays open.
Pages: opposition gains a Bestiary (goblins, skeletons, mini bosses, the dragon, each with its piece); setting gains Herbs & alchemy with the tree bumper. On the overview the tree bumpers link to setting, the dragon toy and both lair tables to opposition; the tree on the opposition page links to setting. Linked text and pieces show a small arrow icon; topics without a page aren't clickable.
Open: the dragon's name.
Next: a deep dive on a topic still without a page (narrative, art, camera, onboarding…) or start the prototype per scope.

## 2026-11-14 — topic: mechanics
Decided: the ball carries the last flipper's item until the other flipper hits it. Items stay until replaced or a drain (the guardian ward breaks when it saves). Kinds: damage, elements, gold, control; doubles don't stack. The only passive is the amulet (controls updated: no "passive on the ball"). Prototype items: iron sword (+1 damage), fire staff (armor hits count double), coin purse (2 gold a break), guardian ward (saves one drain).
Page: pages/mechanics.json.
Open: the full item pool per tier and what makes a game changer; ice and lightning.
Next: every topic is decided; mechanics was the last big gap. Either deep-dive a topic page that's still missing (narrative, art, camera, onboarding…) or start the prototype per scope.

## 2026-11-14 — topic: pitch
Decided (pitch → decided): "Real pinball, roguelike runs: break mobs for gold, shoot a cave, ride the rail down into a dungeon table, and reach the dragon in 15 minutes." Set as bible.pitch too; bound text on the overview follows it.
State: structure moved to decided too, so no hypotheses are left: all 30 topics decided. Open questions live on each topic page (types per tier, table sizes, lair layouts B/C, the trick shot, unlocks, mobs per quest, color-blind item marks, web build with the C++ extension).
Next: `mechanics` one-pager (flipper items: what they do), the biggest decided topic without a page; or start the prototype per scope.

## 2026-11-14 — topic: platform
Decided (platform → decided): Godot, with the pinball physics as a C++ extension. Each table is its own 2D physics plane drawn in 3D; only playfields are simulated. Ramps (on tables too), rails and drops are scripted paths that hand the ball back at a set spot and speed. Builds for PC and the web (itch.io).
Page: pages/platform.json.
Open: the C++ extension in the web build (prove early); physics step rate and flipper feel.
Next: pitch, the last hypothesis: rewrite it from everything decided since genesis.

## 2026-11-14 — topic: ui
Decided (ui → decided): a dot-matrix display above the table, like a real backbox, is the whole interface. At rest: score, gold, lives, current quest; events take it over for a few seconds. Flipper items: a color on each bat, details on the display. No overlay: if something doesn't fit, simplify the game. Boss health is on the toy, not the display (closes challenge's open question; challenge updated).
Page: pages/ui.json.
Open: a symbol on the bats for color-blind players; how long an event holds the display.
Next: platform (engine, physics per table) and pitch, the last two hypotheses.

## 2026-11-14 — topics: session + replay
Decided (both → decided): a full run takes about 15 minutes, with a goal that ends it. Score: pinball points for every hit plus bonuses for each dungeon cleared, lives left and beating the dragon. High scores and unlocks (new items in the pool, new dungeon types) carry over; power never does. Terraforming is 2–3 hand-made main table layouts, one per run (structure updated; structure page's terraforming test removed).
Page: pages/session.json covers both topics.
Open: what each unlock is and what earns it; bonus sizes; pausing and resuming a run.
Next: remaining hypotheses: ui, platform, pitch. UI next: the dot-matrix display now carries gold, health lamps and high scores.

## 2026-11-14 — topic: setting
Decided (setting → decided): a fantasy world only shown as a machine (nobody in it knows). Classic heroic fantasy, like an 80s fantasy table's backglass. The main table is a ruined kingdom's countryside: ruins among the trees, a town of an inn + 3 shops, caves into the kingdom's buried halls, the dragon's peak at the back. The tome is the wizards' dangerous spellbook, stolen by the dragon (added to fantasy).
Page: pages/setting.json, with a backglass sketch.
Open: the kingdom's name and what ruined it; who the quest givers are.
Next: remaining hypotheses: session, replay, ui, platform, pitch. Session and replay pair well (run length, what changes between runs).

## 2026-11-14 — topic: opposition
Decided (opposition → decided): bosses fight in 2 phases (move and dodge; at half health a shield of targets goes up). They fight back only by changing the table (post, lane, blocker), never the physics. Random encounters: mostly mob waves, sometimes a wandering mini boss. Lair: after dungeon 2 a trick shot opens the boss cave only; layout random. Lair A fitted to the phases: the dragon dodges on its hoard, then 4 scales shield it. Narrative and structure updated to match; the structure page's lair question is closed.
Page: pages/opposition.json.
Open: the other 2 types per tier; lair layouts B and C (mini bosses, trash mobs); the trick shot; how long a boss's table change lasts and whether it can be undone.
Next: the remaining hypotheses: setting, session, replay, ui, platform, pitch. Setting is thinnest and feeds art and narrative.

## 2026-11-14 — topic: economy
Decided (economy → decided): every mob break pays 1 gold; trees and hits on armor pay nothing. Gold only buys shop items; a drain loses it all. 3 shops: cheap ≈ 3, mid ≈ 6, dear ≈ 10. Shops restock after each dungeon. Loot is 1 of 3 or none, from the same pool as the shops.
Page: pages/economy.json.
Open: mobs per quest (sets gold per visit); does the shared pool get better each tier (progression says higher-level loot can be game changers); unspent gold carrying between dungeons (assumed yes unless you drain).
Next: `opposition` (mobs, bosses, the 3 drafted dungeons, the lair-vs-caves question).

## 2026-11-14 — topic: challenge
Decided (challenge → decided): basic mobs break in 1 hit. Armor is extra hits taken first, no gold until it's gone; a metal plate shows it and pops off, lamps in front show what's left (steel = armor, red = health). Damage items count on armor too (+1 = 2 points off anything; replaces the old "normal on armored" note). Tier 1 boss about 5 hits. Shot order changes with loadout, weak spots and ordered puzzles. Tiers get tougher by a mix of armor, health and harder shots; each layout leans on one, a tier's layouts at a similar level.
Page: pages/challenge.json.
Open: tier 2 and lair numbers (prototype); do bosses use plate + lamps or the dot-matrix too.
Next: `economy` (gold per break, shop prices, loot), now that hits and armor are set; then `opposition`.

## 2026-11-14 — topic: structure
Decided: every dungeon exit pipes back up through the top of the boss cave; wire rails run down the left and right to the inlanes. Kept: caves pick the type, mobs open caves.
Page: pages/structure.json, a side-on cross-section (main table, 3 caves, chrome rails down, the 3 dungeon structures below, copper return rails up) plus decided / to test / open. The overview draws the return rails, both wires and a dragon-toy on the boss cave (new vault part).
To test: the dragon toy on the boss cave snapping at the ball as it comes back up.
Open: the other 2 types per tier; final table sizes; whether the lair's 3 layouts sit behind the 3 caves (the narrative says a trick shot opens the lair).
Next: topic `mechanics` (the hit model: damage, armor, flipper items, gold), as genesis recommended; or settle the lair question first since it touches structure and narrative.

## 2026-11-14 — overview redrawn tall + dungeons
Decided: mobs (red drop targets) give gold; trees are bumpers in the way, no gold. 3 caves on the main table, each opened by breaking the mobs in front of it; a rail drops the ball into a dungeon table below. The cave picks the type: each leads to one of the current tier's 3 types. A dungeon's exit uses a separate return rail. Dungeons so far: tier 1 goblin warren (3 goblins), tier 2 crypt (4 skeletons in order), lair layout A (4 scale targets guard the dragon). Updated: core-loop, economy, structure, opposition, replay, art.
Page: pages/index.json is now 2880 × 5760, read top to bottom: header, main table, then the dungeons below with the lair in detail. Dungeons are vault structures (dungeon-goblin-warren, dungeon-crypt, dungeon-dragon-lair), built from moss/crypt/lair floors and cave-wall.
Open: where the return rail lands on the main table (not drawn yet); the other 2 types per tier; table sizes are drafts (main 21 × 42, dungeons 11 × 15, lair 15 × 16 in).
Next: topic `structure` as a vector one-pager: caves, rails and return rails, how a tier's 3 types map to the caves. Most of the map depends on it.

## 2026-11-07 — preview page
Decided: nothing new. pages/index.json is now the overview drawn around the main table's shot map (3840 × 2160): header, pillars and the machine on the left, core loop, run rules and flipper loot on the right, every topic along the bottom. The table is welded as group-table on layers Table and Shots.
Open: tuning the table callouts. Removed the tester page, the trough and the mechanism parts (coils, crank, link, switch, spring, sling arm): in git history if needed.
Next: topic `mechanics` as a vector one-pager, as before.

## 2026-10-31 — overview drawn
Decided: nothing new. The overview is now a vector page (pages/index.json), and the old block index moved to pages/skeleton.json.
Open: same as genesis below.
Next: topic `mechanics`, drawn as a vector one-pager.

## 2026-10-31 — genesis
Decided: 20 of 30 topics, including pillars, core loop, permadeath rules, flipper loot, camera, audience, and prototype scope (one main table, one dungeon, a few flipper items).
Open: engine (Godot or C++) and whether physics is 2D per table or full 3D; setting; pitch wording; session length (~15 min guess); terraforming; challenge and economy numbers. Assumed, unconfirmed: after a dungeon drain the next ball starts on the main table and that dungeon resets.
Next: topic `mechanics` — define the hit model (damage, armor, flipper items, gold). Every pillar and the prototype depend on it.
