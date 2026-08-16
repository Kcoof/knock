# KNOCK
## A Multiplayer Pixel World for Builders

### Core Tagline

**Walk into the world. See what people are building. Knock on a door.**

Alternative product line:

**Don't schedule a meeting. Just knock.**

---

# 1. PRODUCT VISION

Build a web application called **KNOCK**.

KNOCK is a multiplayer pixel-art world where developers, students, researchers, designers, creators, and friends can have their own virtual rooms, walk around shared spaces, visit friends, discover people working in other countries, knock on doors, enter rooms, communicate, and collaborate.

The application should feel like a lightweight retro multiplayer game rather than a traditional SaaS dashboard.

The fundamental interaction is:

**Walk → Discover → Knock → Enter → Talk → Collaborate → Leave**

KNOCK must NOT feel like:

- a project-management dashboard
- another Slack clone
- another Discord clone
- another Zoom clone
- another Notion clone
- a traditional social network
- a generic virtual office

The experience should feel like an explorable digital world for people who are actively building things.

---

# 2. CORE PRODUCT PRINCIPLE

The world itself is the interface.

Avoid traditional dashboard-heavy layouts.

Users should primarily interact by moving their character through a pixel-art environment.

Menus should support the world rather than replace it.

The central screen should always emphasize:

- the map
- rooms
- characters
- doors
- movement
- presence
- interaction

---

# 3. VISUAL DIRECTION

Use a polished retro pixel-art visual language inspired by classic top-down adventure and RPG games.

However, do NOT copy assets, maps, characters, layouts, names, sprites, or recognizable visual elements from existing games.

Create an original KNOCK visual identity.

The environment should include:

- pixel-art buildings
- personal rooms
- pathways
- gardens
- trees
- lamps
- benches
- community spaces
- portals
- doors
- signs
- libraries
- focus areas
- social areas

Use modern UI panels around the pixel world only when necessary.

The result should combine:

**Retro Game World + Modern Collaboration UX**

---

# 4. PLAYER SYSTEM

Each user controls a small pixel character.

Support:

- keyboard movement
- WASD
- arrow keys
- optional click/tap movement later

The character should have:

- username
- avatar/sprite
- presence status
- optional country flag
- current activity

Statuses:

- Available
- Working
- Focus
- Away
- Offline

Example:

Ahmed  
Working on Authentication API

Do not continuously persist every movement coordinate to PostgreSQL.

Movement is ephemeral multiplayer state.

---

# 5. PERSONAL ROOM

Every user automatically receives a personal room.

The room is their digital workspace.

A room can display:

- owner
- current status
- what they are working on
- short message
- selected GitHub repository
- recent activity
- notes
- visitors currently inside

Users should eventually be able to customize:

- floor
- wall
- desk
- chair
- plants
- decorations
- room theme

Keep customization constrained in V1.

---

# 6. DOOR SYSTEM

Every personal room has a door state.

Implement:

## Open

Anyone allowed by the room's visibility policy may enter.

## Knock First

Visitors must request permission.

## Focus

Entry is disabled.

## Private

Only explicitly permitted users may enter.

The state should be visually represented on the door.

Examples:

Green light → Open

Yellow light → Knock

Red light → Focus

Lock → Private

---

# 7. THE KNOCK MECHANIC

Knocking is the signature interaction.

When a character walks to a door and presses the interaction key:

Display:

**Knock on Ahmed's door?**

Optional reason:

- Quick question
- Need help
- Want to collaborate
- Just visiting

Optional short message.

The owner receives a real-time event:

**Knock Knock**

Reehana is outside your room.

"Can you help me with this bug?"

Actions:

**Let In**

**Not Now**

If accepted, the door becomes accessible to that visitor.

---

# 8. ENTERING ROOMS

After access is granted, the visitor physically walks through the door.

Do not simply redirect to a dashboard.

Transition the player into the interior map.

Inside the room, users can:

- move around
- chat
- view public room context
- inspect shared notes
- see the owner's current project
- communicate

Room permissions must determine which information is visible.

---

# 9. FRIEND SYSTEM

Users can:

- search users
- send friend requests
- accept requests
- reject requests
- remove friends

Friends should appear naturally in the world.

Provide a compact friends panel showing:

Ahmed — Working  
Sara — Available  
Ali — Focus  
Omar — Away

Actions:

Visit

Knock

Invite

Do not make the friends panel the primary interface.

---

# 10. COME HERE

Create a lightweight interaction called:

**Come Here**

A user can invite another user into their room.

Example notification:

**Reehana is calling you over.**

"Come look at this 👀"

Action:

**Go to Room**

If accepted, guide or transport the player appropriately.

---

# 11. DOOR NOTES

If a user is offline, visitors may leave a short note at their door.

Example:

**Reehana stopped by.**

"Check the login issue when you're back."

Door notes should be:

- short
- lightweight
- dismissible
- stored

Do not turn them into a full messaging system.

---

# 12. ROOM CHAT

Rooms may have lightweight text chat.

Chat is scoped to the room.

Support:

- messages
- timestamps
- usernames
- simple reactions later

Avoid building a Discord-level messaging platform.

The world remains the primary interaction model.

---

# 13. OPTIONAL LIVE VOICE — POST-MVP

Eventually allow users inside the same room to join live voice.

Use WebRTC.

Requirements:

- microphone toggle
- join voice
- leave voice
- speaking indicator

Do NOT record audio.

Do NOT store audio.

Do NOT store video.

Live communication should be ephemeral.

This feature is NOT required for the initial MVP.

---

# 14. GITHUB INTEGRATION

GitHub should provide context about what a builder is doing.

Prefer a GitHub App architecture with narrowly scoped repository permissions.

Do not request unnecessary access.

Allow a user to connect selected repositories.

Inside their room, optionally display:

Repository name

Current project

Recent commits

Open pull requests

Open issues

Example:

GitHub

knock-app

Latest commit:

`fix: realtime room presence`

5 minutes ago

The GitHub integration must NOT turn KNOCK into a GitHub client.

Its purpose is:

**Help visitors understand what this person is currently building.**

---

# 15. PRIVACY MODEL

Privacy is critical.

Every room should have a visibility policy.

Possible values:

### Public

Discoverable by anyone.

### Friends

Discoverable by friends.

### Knock

Visible but requires approval to enter.

### Private

Not publicly accessible.

Never expose:

- private repository source code
- private files
- secrets
- tokens
- precise physical location
- private notes

unless explicitly permitted by the owner.

---

# 16. REAL-TIME ARCHITECTURE

Use Supabase Realtime.

Use **Presence** for slow-changing user state such as:

- online/offline
- current room
- working status
- availability
- active world

Use **Broadcast** for frequent ephemeral events such as:

- character movement
- direction
- temporary interaction animations
- typing indicators
- knock animation/event
- emotes

Do NOT write every character movement to PostgreSQL.

Do NOT use Presence tracking for every movement frame.

The client should interpolate remote movement so characters appear smooth even if network updates arrive less frequently than rendering frames.

Implement movement throttling.

Design for unstable network conditions.

---

# 17. GAME LOOP

The browser should render player movement independently of network/database latency.

Conceptually:

Input
↓
Local movement
↓
Immediate rendering
↓
Throttled multiplayer update
↓
Remote clients
↓
Interpolation

Never require a database response before moving the local character.

---

# 18. DATABASE

Use Supabase PostgreSQL.

Initial tables may include:

profiles

rooms

friendships

room_permissions

knocks

door_notes

room_messages

room_notes

github_connections

notifications

worlds

country_hubs

public_room_directory

meaningful_activity

Use UUID primary keys.

Include created_at and updated_at where appropriate.

Implement foreign keys.

Use Row Level Security.

Do not use the database as the realtime game engine.

---

# 19. KNOCK WORLD

After the personal-room MVP works, expand KNOCK into a global world.

The hierarchy should be:

**World → Country Hub → Rooms → People**

Example:

KNOCK WORLD

Saudi Arabia  
India  
Japan  
United States  
Germany  
United Kingdom

Each country shows an approximate number of currently active builders.

Users can select a home country manually.

Do NOT automatically expose precise physical location.

Country information is a social/world identity setting, not a tracking mechanism.

---

# 20. COUNTRY HUBS

Each supported country has a themed hub.

Example:

**India Hub**

Possible areas:

- AI Builders
- Students
- Open Source
- Startups
- Community Area

Example:

**Saudi Arabia Hub**

Possible areas:

- Developers
- Researchers
- Startups
- Open Projects
- Community Area

Do not stereotype countries.

Country environments should share the KNOCK design system.

Only subtle visual identity differences should exist.

---

# 21. TRAVEL

Users can travel between country hubs.

Provide a visually interesting portal system.

Example:

WORLD PORTAL

Saudi Arabia

India

Japan

United States

Germany

United Kingdom

Selecting a destination triggers a short pixel animation.

Keep travel fast.

Never force users to watch long animations repeatedly.

---

# 22. PUBLIC ROOMS

Users can optionally mark a room as publicly discoverable.

Example:

**Arjun's Room**

OPEN

Building:

AI Resume Analyzer

Looking for:

Collaborator

Feedback

Bug Help

Visitors can approach and:

- inspect public context
- knock
- request collaboration

This is one of the key differentiators of KNOCK.

---

# 23. DISCOVERY

The goal is NOT to browse profiles.

The goal is to discover:

**People who are building something right now.**

Examples:

"12 people are building AI projects in India."

"5 open Computer Vision rooms."

"3 researchers looking for collaborators."

Discovery filters may eventually include:

- AI
- Web Development
- Computer Vision
- Robotics
- Research
- Open Source
- Design
- Startups
- Students

Avoid follower-count-driven discovery.

---

# 24. BUILDER PASSPORT — POST-MVP

Each user may eventually have a KNOCK Passport.

Example:

KNOCK PASSPORT

Reehana

Home:

Saudi Arabia

Interests:

AI  
Computer Vision  
Research

Visited:

India  
Japan  
Germany

People Met: 19

Projects Helped: 4

Collaborations: 3

Avoid traditional vanity metrics.

Do NOT prioritize:

Followers

Likes

Popularity scores

Instead emphasize:

People Met

Projects Helped

Collaborations

Countries Visited

---

# 25. COMMUNITY AREAS

Country hubs can contain shared public areas.

Examples:

Community Room

Library

Help Desk

Open Source Café

Focus Zone

Project Showcase

Users can naturally encounter other online builders there.

These areas should encourage lightweight spontaneous interaction.

---

# 26. EVENTS — FUTURE VERSION

Later support temporary world events.

Examples:

AI Builders Night

Open Source Hour

Research Meetup

Student Project Night

Hackathon Room

Events should occur inside existing world spaces.

Do NOT build a complex event-management platform.

---

# 27. DIFFERENTIATION

KNOCK must not rely solely on the concept of a pixel virtual office.

Its identity comes from the combination of:

1. Personal rooms
2. Door privacy
3. Knocking
4. Builder presence
5. Public builder rooms
6. GitHub project context
7. Country hubs
8. World travel
9. Spontaneous collaboration
10. Discovering what people are building right now

The product should answer:

**Who is building something interesting right now, and can I walk over and talk to them?**

---

# 28. TECH STACK

Use:

### Frontend

Next.js

TypeScript

React

Tailwind CSS

### Game Rendering

Evaluate a lightweight browser-compatible 2D rendering/game solution.

Prefer a technology that integrates cleanly with React/Next.js.

Potential options may include:

Phaser

PixiJS

or a carefully implemented Canvas renderer.

Do not prematurely build a custom game engine.

### Backend

Supabase

### Database

PostgreSQL through Supabase

### Realtime

Supabase Realtime Presence + Broadcast

### Authentication

Supabase Auth

### Repository Integration

GitHub App

### Deployment

Vercel

### Version Control

Git + GitHub

---

# 29. ASSET POLICY

Do not copy copyrighted game sprites.

Do not copy maps from existing games.

Do not copy Gather assets.

Use:

- original pixel art
- licensed asset packs
- generated original assets
- custom-designed sprites

Maintain a consistent tile size and visual language.

---

# 30. PERFORMANCE

The application should load quickly.

Optimize:

- sprite sheets
- textures
- network updates
- React rendering
- map rendering
- realtime subscriptions

Lazy-load areas where appropriate.

Avoid downloading the entire world at startup.

Only subscribe to realtime events relevant to the player's current area.

---

# 31. MOBILE

Desktop browser is the primary MVP target.

Architecture should remain responsive.

Do not spend significant MVP development time building complex mobile controls.

Mobile controls can be implemented later.

---

# 32. ACCESSIBILITY

The game world must not be the only way to perform critical actions.

Provide accessible alternatives for:

- navigation
- friends
- knocking
- notifications
- room access
- chat

Keyboard navigation should work wherever practical.

---

# 33. SECURITY

Enable Supabase Row Level Security.

Never expose service-role credentials to the browser.

Store secrets in environment variables.

Create:

`.env.example`

Never commit actual secrets.

Validate room permissions server-side or through secure database policies.

Validate GitHub access server-side.

Use least-privilege repository permissions.

Treat all client-provided room/player information as untrusted.

---

# 34. GIT DEVELOPMENT WORKFLOW

This project is Git-first.

Every meaningful development stage must end with a Git commit.

Recommended branches:

`main`

`develop`

`feature/game-world`

`feature/auth`

`feature/player`

`feature/rooms`

`feature/friends`

`feature/knock`

`feature/realtime`

`feature/github`

`feature/world-map`

`feature/country-hubs`

Never implement multiple major phases in one uncontrolled commit.

Commit examples:

`chore: initialize KNOCK project`

`feat: add player movement`

`feat: create personal rooms`

`feat: add realtime player presence`

`feat: implement knock mechanic`

`feat: add room permissions`

`feat: add friend system`

`feat: add GitHub integration`

`feat: introduce world map`

`feat: add country hubs`

---

# 35. GITHUB PUSH WORKFLOW

After a phase passes validation:

`git add .`

`git commit`

`git push`

Push the feature branch to GitHub.

Do NOT automatically merge unstable work into main.

Create a pull request when appropriate.

Only merge after:

- build succeeds
- lint succeeds
- type checking succeeds
- critical functionality is manually verified

---

# 36. VERCEL

Connect the GitHub repository to Vercel.

Use preview deployments for feature branches/pull requests where available.

Use production deployment from the stable production branch.

Do not use production as the primary testing environment.

---

# 37. MVP — STRICT SCOPE

The first MVP must contain ONLY the core experience.

Build:

1. Authentication
2. Pixel character
3. Small shared map
4. Character movement
5. Realtime player presence
6. Personal room
7. Door
8. Open / Knock / Focus states
9. Friends
10. Knock request
11. Accept/reject knock
12. Enter friend's room
13. Room chat
14. Leave door note
15. Basic working-status message

STOP.

Do not build the global world yet.

---

# 38. MVP SUCCESS TEST

The MVP succeeds if two users can:

1. Sign in.
2. Enter the same pixel world.
3. See each other's characters.
4. Walk independently.
5. See which room belongs to whom.
6. Walk to a friend's room.
7. Knock.
8. Receive the knock in realtime.
9. Accept the request.
10. Enter the room.
11. Chat.
12. Leave.
13. Continue working independently.

This interaction must feel smooth and enjoyable.

---

# 39. VERSION 1.5

After validating the MVP, add:

- better room customization
- improved character customization
- GitHub App
- current repository
- recent commits
- Come Here
- lightweight voice
- richer room notes

---

# 40. VERSION 2 — KNOCK WORLD

Only after the core room interaction is stable, implement:

World Map

Country selection

Country hubs

Public rooms

World portals

Builder discovery

Project categories

Country travel

KNOCK Passport

Do not implement all countries immediately.

Start with a small test set such as:

Saudi Arabia

India

Japan

United States

The architecture must allow additional hubs later.

---

# 41. FIRST DEVELOPMENT MILESTONE

Do NOT start by building authentication, database tables, GitHub integration, country hubs, or voice.

The first technical prototype must answer the highest-risk product question:

**Does walking around and entering rooms actually feel good?**

Therefore the first prototype should contain:

- one local map
- one player sprite
- WASD/arrow movement
- collisions
- several room buildings
- doors
- camera behavior
- simple interaction prompt
- no backend required

Use mock users.

Example map:

Reehana's Room

Ahmed's Room

Sara's Room

Community Room

Library

Focus Zone

Build this as a polished local prototype first.

---

# 42. DEVELOPMENT EXECUTION RULE

Do NOT attempt to build this entire specification at once.

Work phase by phase.

For every phase:

1. State the exact objective.
2. Inspect the existing repository.
3. Create a short implementation plan.
4. List files that will change.
5. Implement only the current phase.
6. Run linting.
7. Run TypeScript checks.
8. Run tests where applicable.
9. Run production build.
10. Fix all errors.
11. Summarize what changed.
12. Commit the completed work.
13. Push the feature branch to GitHub.
14. STOP.

Do not continue to the next phase without explicit approval.

---

# 43. FIRST INSTRUCTION TO THE CODING AGENT

Read this entire KNOCK specification before changing any code.

Do not attempt to implement the complete product.

Start ONLY with the first visual/gameplay prototype.

Create a polished original pixel-art prototype containing:

- one small world map
- Reehana's Room
- Ahmed's Room
- Sara's Room
- Community Room
- Library
- Focus Zone
- one controllable player
- WASD movement
- arrow-key movement
- collision detection
- doors
- basic interaction prompts
- smooth camera behavior

Use mock data only.

Do not implement:

- Supabase
- authentication
- GitHub
- AI
- voice
- countries
- database
- friends backend

The purpose of this phase is to validate the visual identity and movement experience.

When complete:

- run lint
- run type checking
- run the production build
- fix all errors
- commit the work
- push the feature branch to GitHub
- report the commit hash
- STOP and wait for approval.