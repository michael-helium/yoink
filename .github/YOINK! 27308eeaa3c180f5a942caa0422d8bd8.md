# YOINK!

<aside>
📝

**GAME SUMMARY**

A bananagrams-like word game where you yoink letters from a letter pool.

</aside>

## `Thursday Priority Mechanics`

- Implement all designs
    - Lobby page
    - Tweeners / leaderboards
    - ~~Final Leaderboard / Restart~~
    - ~~Current leader (crown)~~
- CHOOSE YOUR YOINKER
- ~~Browser alert → in game alert ✅~~
- B~~ack buttons ✅~~
    - End of game / leave/exit
- I~~MPLEMENT AUDIO!!!~~ ~~✅~~
- ~~Click and drag tiles~~
    - ~~Rearrange letters in bank✅~~
    - ~~BURN letters~~
        - `Functionality`: ~~drag off bank (into BURN pile?)~~
        - `~~Score Penalty`:~~
            - ~~Round 1 = `-20`~~
            - ~~Round 2 = `-30`~~
            - ~~Round 3 = `-50`~~
- ~~Tips Match UI ✅~~
- Animation/effects
    - YOINK event?
- ITEM IMPLEMENTATION
    - BOMB
    - FREEZE
    - MIDAS TOUCH / SUPER YOINK (yoink speed up and/or bonus points?)
- ~~Shuffle button for your player bank - NOT PLANNED~~

## Bugs 🐛

- (solo play only?) Negative countdown at end of round / miss tweener
    
    The issue happens if you yoink a tile as time is expiring. If your yoinker is yoinking when time runs out, you miss the tweener and enter a negative countdown. (**Kyle K** 👀 - can’t replicate this one) 
    If round 1 or 2, then you jump into the next round w/o seeing the tweener.
    if round 3, you enter an infinite(?) negative countdown
    
- (Kyle K - fixed, going in soon) item bank is not reset after round end (item should not carry over to next round)
    
    
- top bar changes sizes during score increase animation
    
    
- loading bar does not show on tweeners on iphone SE

## 💭 Stretch mechanics and rules

## YOINKER Skins

- Wizard hand w/ wand (letter levitates to BANK)
- Skeleton arm
- ~~Zombie arm~~
- Santa arm holding candy cane (candy cane is the YOINKER)
- Link Hookshot/Grappling Gun ([https://www.youtube.com/shorts/gt9I24FCKRA](https://www.youtube.com/shorts/gt9I24FCKRA))
- Tongue that grabs a letter (chameleon/lickitung: [https://x.com/JRRDunlop/status/1339267530972598276](https://x.com/JRRDunlop/status/1339267530972598276))
- ~~Robot arm (3 fingers)~~

![bender arm.png](YOINK!/bender_arm.png)

## Pages

- [ ]  Account page (login, purchase skins, etc)
- [x]  Stats page
- [ ]  Share/invite page (different than share lobby? Incentivize inviting new players to game to create accounts?)

## Power-up ideas

| Name | What it does | Time | Approved |
| --- | --- | --- | --- |
| SHROINK | Shrink someones bank. So they cant store 7 letters, maybe they only get 5 letters in bank | 15s |  |
| Vowel movement | Delete all the vowels from everyones bank, and the board?

Shuffle a player’s vowels (random) | Instant |  |
| Bank swap | you swap bank with another player’s | Instant |  |
| Bank robber | View opponent bank and steal letter(s) |  |  |
| Trojan horse | Choose a letter for another persons bank | Instant |  |
| Flash bang / Ink Blot | The board is blank to everyone except you, giving you time to pull letters. Other players can still grab tiles, but they don’t know what they are getting until its in their bank | 5s |  |
| Bomb | Drop on a player to eliminate half of their bank | Instant |  |
| BOINK | slap someone’s hand to “stun” them | 5s cooldown for user? |  |
| Cooldown shorter | You can grab tiles faster, no cool down |  |  |
|  |  |  |  |

## Analytics IDEAs

| track idea | describe | Approved |
| --- | --- | --- |
| Global, All words played ever | count of each time played |  |
| Global, All time highest score  |  |  |
| personal, highest scoring words |  |  |
| personal, total games played |  |  |
| personal, total games won |  |  |
| personal, total words played |  |  |
| word owner | You have played this word more then anyone else.  |  |

## ❗MVP mechanics and rules v2

### 1) Lobby & Joining

- [x]  Players: 2–4 per room. (Dev ✅)
- [x]  Join: Enter room code + user nickname. (Dev ✅)
- [x]  Host: Server-hosted; host controls Start Game (Dev ✅) and basic settings (TBD).
- [ ]  **Start condition:** Host may start at **≥2 players**.

## 2) Rounds & Phases

- [x]  **Structure:** 3 rounds × 6**0s**, separated by **10s** intermissions. (Dev ✅)
- [x]  **Round multipliers:** R1 **100%**, R2 **120%**, R3 **150%**. (Dev ✅)
- [x]  **Between rounds:** Show **leaderboard with all scores** + 10s countdown. (Dev ✅)
- [x]  **End:** **Final scoreboard** after Round 3; **Play Again** option. (Dev ✅)

## 3) Word Pool (Shared 4×4 Grid)

- [x]  **Grid:** 4×4, max **16** tiles visible. (Dev ✅)
- [x]  **Round start:** Pool **prefilled to 16**. (Dev ✅)
- [x]  **Respawn pacing (rubberband):** (Dev ✅)
    - Define **fullness** = number of tiles present (0–16).
    - **0/16 → 0.5s** spawn interval; **15/16 → 10s**; **no spawns at 16/16**. (Dev: Min spawn interval is 1, max spawn interval is 5)
    - **Linear interpolation:** For **f ∈ [0,15]**, interval = **0.5s + (10s − 0.5s) × (f/15)**. Spawn only when **not full**.
- [x]  **Respawn letter ratios (weights):** (Dev ✅)
    
    `letters = [A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z]`
    
    `weights = [9,2,2,4,12,2,3,2,9,1,1,4,2,6,8,2,1,6,4,6,4,2,2,1,2,1]`
    
- [x]  **Collision resolution:** First server-received yoink wins (server authoritative). (Dev ✅)
- [x]  **Visuals:** High-value letters visually emphasized (30-pt tier most prominent).

## 4) Player Bank & Assembly 
50 points (+80 BONUS!)

- [x]  **Bank limit:** **7** letters. (Dev ✅)
- [x]  **Yoink:** Tap a pool tile to add to bank (**500ms** per-player cooldown). (Dev ✅ Cooldown is 1s)
- [x]  **Assemble:** Tap letters in bank to build a word; **Clear/Reset** to deselect. (Dev ✅)
- [x]  **Word length:** 3**–7** letters. (Dev ✅)
- [x]  **Consumption:** Valid submit **consumes** used bank letters; invalid leaves bank unchanged. (Dev ✅)
- [x]  **No discarding:** Letters cannot be dropped or returned once yoinked. (Dev ✅)

## 5) Input & Platform

- [x]  **Mobile-first, tap-only** (no keyboard). (Dev ✅)
- [x]  **Case-insensitive** throughout; letters displayed uppercase. (Dev ✅)
- [x]  **Character set:** A–Z only (no diacritics, hyphens, or apostrophes). (Dev ✅)

## 6) Submissions & Dictionary

- [x]  **Submit:** Tap **Submit** for validation and scoring. (Dev ✅)
- [x]  **Dictionary policy:** Case-insensitive; **plurals allowed**; **proper nouns disallowed**. (Dev: Scrabble Dictionary implemented ✅
- [ ]  **Feedback:**
    - **Invalid:** Error/shake + brief reason.
    - **Valid:** Show **points earned for that word** to the submitting player.

## 7) Scoring

- [x]  **Letter values (per tile):** (Dev ✅)
    - **10 pts:** A, D, E, G, I, L, N, O, R, S, T, U
    - **20 pts:** B, C, F, H, K, M, P, V, W, Y
    - **30 pts:** J, Q, X, Z
- [x]  **Word total:** **Sum(letters)** × **(1 + 0.20 × word_length)** (length bonus) × **round multiplier** (1.0 / 1.2 / 1.5). Round to whole points. (Dev ✅)
- [x]  **Duplicates:** **Allowed**—same player may resubmit the same word multiple times (if rebuilt); multiple players can submit the same word in the same round. (Dev ✅)

## 8) Visibility During Rounds

- [x]  **Privacy:** No scores shown during rounds; players **do not** see others’ banks—only opponents’ **yoinker/hand activity** on the pool. (Dev ✅)
- [x]  **Leader indicator:** Show current **leader** (cumulative score). **Ties show a crown for each tied leader.**
- [x]  **Timer:** Visible round countdown. (Dev ✅)
- [x]  **Personal scoring:** On valid submit, player sees **their own word points**. (Dev ✅)

## 9) Intermissions & Leaderboard

- [x]  **Recap (10s):** Show **all player scores and ranking** after each round. (Dev ✅)
- [x]  **Final recap:** Full results after Round 3. (Dev ✅)

## 10) Fairness

- [x]  **Authority:** Server decides tile claims, timing, and validation (server time is source-of-truth). (Dev ✅)

## 11) Resets & Edge Rules

- [x]  **Bank carryover:** **None**—banks reset at each round start. (Dev ✅)
- [ ]  **Min players to start:** **2**.
- [ ]  **Submission integrity:** Selected letters must **exactly** compose the submitted word; mismatches are invalid.

### ❗MVP mechanics and rules

### **Lobby & Joining**

- 2-4 players - enter a room code and name to join the lobby
- Three 90 second rounds
- Server-hosted lobby
- Host settings
- Start game

### Word pool

- **Word pool:** 4x4 grid of letters
    - Letter ratios
        
        ```python
        # Letters and their weights (from Scrabble ratios)
        letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                   'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
        weights = [9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2,
                   6, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1]
        ```
        
    - Replenish: instant replenish for 10 seconds to kickstart the game
    - Core letter refresh rate is based on pool size (less letters in the pool = faster refresh)
        
        ```python
        # Function to generate a single random letter
        def generate_letter():
            return random.choices(letters, weights=weights, k=1)[0]
        
        # Function to calculate current interval based on pool size
        def get_refresh_interval():
            with pool_lock:
                fullness = len(pool) / MAX_POOL_SIZE
                # Linear interpolation: longer interval when fuller
                return MIN_INTERVAL + (MAX_INTERVAL - MIN_INTERVAL) * fullness
        
        # Function to refresh (add a letter if not full)
        def refresh_pool():
            with pool_lock:
                if len(pool) < MAX_POOL_SIZE:
                    new_letter = generate_letter()
                    pool.append(new_letter)
                    print(f"Added {new_letter}. Pool size: {len(pool)}")  # For demo
        ```
        
    - Visual differentiation for highest value letters
- **Player visibility:** Player “yoinkers” (hands).
- **Timer:** Timer in top let corner

### Player bank

- Max 7 yoinked letters
- Display yoinked letters
- Display typed word dynamically as the player clicks letters

### Gameplay

- Tap to YOINK letters into bank
- Tap letters from bank to form words
    - Need a CLEAR/RESET button
    - Tap to SUBMIT word
    - Max of 7 characters
- Validate words from DICTIONARY on SUBMIT
    - Invalid words (error shake)
    - Valid words (show points scored)

### Scoring (WIP)

- **Scores**: Player with the highest score has a crown icon (or animation?) on their yoinker
- **Rewards based on word toughness or word length**
    - Incentivize difficult letters = more rewards (*DEFINE REWARD*)
    - Submitting longer words = more rewards (*10% bonus per letter*)
- Possibly show “success” toast, ie “ARDENT (12 points earned)

### Rounds

- 3 rounds
- ROUND ONE
    - Base letter score = 100%
    - Score recap and leaderboard (all players)
    - 10 seconds til next round
- ROUND TWO
    - **Base letter score = 120%**
        - Display: 20% bonus this round!
    - Score recap and leaderboard (all players)
    - 10 seconds til next round
- ROUND THREE
    - Base letter score = 150%
        - Display: 50% bonus this round!
        - NO DUPLICATE WORDS (per user) ???
    - FINAL SCOREBOARD
    - PLAY AGAIN

## 🎨 UX/UI To-do items

### Screens

- Home Screen
    - Buttons: Host - Join - Login/Signup (someday)
- Lobby
    - Host
    - Settings
- Tweeners
    - Slide between rounds showing current rankings
- Winner/Game Over
    - Show the final rankings, maybe some fun facts (biggest word used, more points awarded for a single word)
- Gameplay
    - Yoinkers
    - Pool
    - Timer
    - Score

### Components

- Letter tiles and states
    - Base tile
    - High point value tiles
    - Special item tiles
    - Empty state
    - Pending state
- Player bank
    - Word preview
    - Letter bank
        - Empty state
        - Available spaces/occupied spaces
    - Clear button
    - Enter/submit button
    - “Running out of time” letter tile state
- Scoring
    - Timer
    - “success” toasts
    - Crown for highest score
- Yoinkers
    - Default yoinker icons
    - State for yoinking tiles

---

# Michael’s version

- **Lobby & Joining**
    - Players enter a room code and name to join a lobby (up to 16 players).
    - A server-hosted lobby persists settings and round state.
    - If the server isn’t reachable, there’s an **offline demo mode** (single-player, local simulation).
- **Settings (host configurable)**
    - Round length: 30–600 seconds (default 120).
    - Minimum word length: 2–6 (default 3).
    - Duplicate word handling:
        - *Allow with decay* (value decreases based on how many players submitted it)
        - *Disallow* (reject repeats outright).
        - *Allow (no penalty)*.
    - Tiles per round: 40–200 (default 100) - should scale based on # of players
    - Drip/surge reveal:
        - Tiles drip into the pool at 2 per second.
        - A one-time surge of 10 tiles at 60 seconds.
        - A surge of 10 tiles if letters in pool ≤5
    - “Start new round” button resets everything with current settings.
- **Tiles**
    - Bag is based on Scrabble-like letter frequencies and point values.
    - Tiles are revealed visually in a randomized grid.
    - Each tile is its own square (no “×3” style counts).
    - Points are shown as a small subscript in the bottom-right corner (like Scrabble).
- **Word Submission**
    - Words must use available tiles in the shared pool (with blanks as wildcards).
    - Must meet minimum length requirement.
    - Must exist in the dictionary (Wordnik wordlist, loaded at server boot).
    - On submit:
        - Server validates against pool and dictionary.
        - Shadow-queue fairness: submissions in a short window (150ms) are judged against a snapshot of the pool, reducing latency advantage.
        - Success-only feed shows accepted plays in the format:
            
            *“Michael played 5 letters for 14 points.”*
            
        - Letters are consumed from the pool when accepted.
    - Rate limited to ~5 submissions per second per player.
- **Scoring**
    - Letter points follow Scrabble-style values.
    - Each word gets a 5% bonus per letter (longer words pay more).
    - Duplicate words (if allowed) reduce in value at end of round depending on decay model.
    - Scores update live during the round (pre-decay).
    - At round end:
        - Final scores are recalculated with duplicate decay.
        - A leaderboard is displayed.
- **End of Round**
    - Time expiration ends the round automatically.
    - Final leaderboard shows rankings and scores.
    - Players can start a new round via lobby controls.

# Potential next steps

**Next Steps list** broken down into categories so you can see what’s left to make the game feel polished and “production-ready.”

### Core Mechanics

- [ ]  **Host role**: only the player who created the lobby can change settings / start rounds.
- [ ]  **Multiple rounds flow**: after a round ends, keep scores across rounds (best of 3, total score, etc.).
- [ ]  **Pause / restart**: ability to stop a round early or restart without rejoining.

### Scoring & Validation

- [ ]  **Dictionary filters**: remove proper nouns, offensive words, 1-2 letter words, etc.
- [ ]  **Blank tile substitution UI**: let players explicitly pick which letter a blank represents [show letter as red instead of black].
- [ ]  **Detailed results**: show each player’s word list at round end (with decay values).

### UI / UX

- [ ]  **Better tile presentation**: lighter backgrounds, more Scrabble-like styling, maybe hover/press animations.
- [ ]  **Responsive scaling**: tighter tile grid on mobile so more letters are visible without scrolling.
- [ ]  **Live player indicators**: highlight who just submitted a word (e.g., flash their score row).
- [ ]  **Lobby list**: show who’s in the room before the game starts.
- [ ]  **Error feedback**: small toast when a word is rejected (too short, invalid, not in pool).

---

### Multiplayer

- [ ]  **Spectator mode**: allow joining without playing, just watching.
- [ ]  **Reconnect handling**: if a player refreshes the page, they should rejoin the same round with their score.
- [ ]  **Private vs. public lobbies**: option for “friends only” vs. “open” games.

---

### Performance & Stability

- [ ]  **Optimized wordlist loading**: preload or trim the Wordnik dictionary for faster cold boots.
- [ ]  **Server scaling**: deploy with room sharding or namespaces if you expect lots of concurrent rooms.
- [ ]  **Anti-spam**: stricter client validation and maybe chat moderation if you add messaging later.

---

### 🎮 Fun Extras

- [ ]  **Power-ups**: e.g., one-time “swap pool” or “freeze opponents for 3s.”
- [ ]  **Alternate modes**:
    - *Solo Sprint*: score as much as you can in 2 minutes.
    - *Team Mode*: 2–4 teams pool words collaboratively.
    - *Survival*: players eliminated if they don’t score in X seconds.
- [ ]  **Achievements / stats**: longest word, highest single play, win streaks.

# Brandon’s version

**MVP = White
Extra sauce = purple**

- 2-4 players
- Three 90 second rounds
- 7 letter word bank
- Reward bigger/tougher words
    - 10% bonus for each letter played (base 10 per letter)
    - **Play all 7 letters for a YOINK! - player’s letters are eliminated**
    - BANK:
- Pool:
    - GRID: 4x4 = 16
    - REPLENISH: Instant replenish for 10 seconds to kickstart the game
        - Core Letter refresh rate is based on pool size (less letters in pool = faster refresh
- YOINKERS:
    - Current high scoring player is indicated by a crown

[Sound Interaction](https://www.notion.so/Sound-Interaction-27808eeaa3c180338b77ca804a14e426?pvs=21)

[Song list](https://www.notion.so/Song-list-27808eeaa3c180bba88ec5efd7f52fa9?pvs=21)