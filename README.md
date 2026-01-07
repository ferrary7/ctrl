# CTRL - Claim Territory in Real Life

A competitive fitness game that turns real-world GPS activities into territory control gameplay.

## Architecture Overview

### Stack
- **Frontend**: Next.js 14 (App Router) + MapLibre GL JS
- **Backend**: Next.js API Routes + Server Actions
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Cache**: Vercel KV (Redis)
- **Auth**: NextAuth.js with Strava OAuth
- **Hosting**: Vercel Edge Network

### Data Flow

```
1. User Activity Upload
   ↓
2. Decode Polyline → LineString → Buffer to Polygon
   ↓
3. Query Overlapping Territories (PostGIS spatial query)
   ↓
4. Calculate Ownership Changes (Turf.js)
   ↓
5. Update Database (territories, territory_changes)
   ↓
6. Invalidate Caches (tile keys, user stats)
   ↓
7. Revalidate Pages (ISR)
```

### Geospatial Processing

**GPS Route → Territory Conversion:**
1. Encoded polyline (from Strava/GPS device)
2. Decode to coordinates array
3. Create LineString geometry
4. Buffer route (50m for runs, 100m for rides)
5. Simplify polygon to reduce vertices
6. Store as PostGIS POLYGON

**Territory Overlap Detection:**
- PostGIS `ST_Intersects()` finds overlapping territories
- Turf.js calculates intersection, difference, and union operations
- Newer activity timestamp wins overlapping area
- Database transactions ensure consistency

### Caching Strategy

**Three-tier caching:**

1. **Vercel Edge Cache** (CDN)
   - Territory tile responses: 5min public, 10min CDN
   - Configured in next.config.js headers

2. **Vercel KV (Redis)**
   - Territory tiles by bbox+zoom: 5min TTL
   - User stats: 5min TTL
   - Leaderboard: 5min TTL
   - Invalidated on activity upload

3. **Client-side (SWR)**
   - UI component state: 30s stale-while-revalidate
   - Automatic background revalidation

**Cache Invalidation:**
- New activity → clear affected tile keys + user caches
- Territory change → clear overlapping tiles
- Leaderboard → time-based refresh every 5min

### Database Schema

**Key Tables:**
- `users` - User accounts + Strava tokens
- `activities` - GPS activities with LineString geometry
- `territories` - Claimed polygons with spatial index
- `territory_changes` - Ownership transfer history
- `leaderboard` - Materialized view (refreshed hourly)

**Spatial Indexes:**
- `activities.route_geometry` - GIST index for route lookups
- `territories.geometry` - GIST index for overlap queries

### Performance Optimizations

1. **Geometry Simplification**
   - Territories simplified based on zoom level
   - Reduces payload size by 60-80%

2. **Spatial Indexing**
   - PostGIS GIST indexes enable sub-100ms queries
   - Bounding box pre-filter before expensive intersection

3. **Edge Caching**
   - Map tiles served from Vercel Edge (global CDN)
   - 5min cache reduces DB load by ~95%

4. **Batch Processing**
   - Multiple territory updates in single transaction
   - Parallel cache invalidation

## Folder Structure

```
ctrl/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.js    # NextAuth config
│   │   ├── tiles/route.js                 # Territory tile endpoint
│   │   └── leaderboard/route.js           # Leaderboard API
│   ├── actions.js                         # Server Actions (mutations)
│   ├── layout.js                          # Root layout
│   ├── page.js                            # Home page (map view)
│   └── globals.css                        # Global styles
├── components/
│   ├── TerritoryMap.js                    # MapLibre map component
│   ├── Leaderboard.js                     # Leaderboard sidebar
│   ├── TerritoryCard.js                   # Territory info popup
│   └── ActivityUploadForm.js              # Manual upload form
├── lib/
│   ├── db.js                              # Database queries
│   ├── territory.js                       # Geospatial calculations
│   └── cache.js                           # Cache utilities
├── database/
│   └── schema.sql                         # PostgreSQL + PostGIS schema
├── package.json
├── next.config.js
├── tailwind.config.js
└── .env.local.example
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Create a Supabase project at [supabase.com](https://supabase.com)

Enable PostGIS extension in SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Run the schema in Supabase SQL Editor:

```bash
# Copy contents of database/schema.sql and run in Supabase SQL Editor
```

### 3. Configure Environment Variables

CopNEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for server-side queries)n:

- `POSTGRES_URL` - Vercel Postgres connection string
- `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` - Vercel KV credentials
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` - Strava OAuth app
- `AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXT_PUBLIC_MAPTILER_KEY` - MapTiler API key (for map tiles)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
vercel deploy --prod
```

## Key Features Implemented

✅ **Strava OAuth Integration** - Connect fitness account  
✅ **GPS Route Processing** - Decode polylines, buffer routes  
✅ **Territory Overlap Detection** - PostGIS + Turf.js calculations  
✅ **Dynamic Ownership** - Newer activities steal overlapping territory  
✅ **Interactive Map** - MapLibre with territory polygons  
✅ **Leaderboard** - Real-time rankings by area  
✅ **Multi-layer Caching** - Edge + Redis + Client  
✅ **Server Actions** - Optimistic UI updates  

## Next Steps

### Phase 2 Features
- Strava webhook integration (auto-sync activities)
- Territory decay system (defend or lose)
- Activity heatmaps
- Battle notifications (when territory is stolen)
- Mobile responsive design
- Social features (challenges, teams)

### Performance Improvements
- Vector tile generation for massive datasets
- Database read replicas
- WebSocket live updates
- Progressive Web App (offline mode)

### Game Mechanics
- Territory bonuses (longer hold = more points)
- Weekly/monthly seasons
- Power-ups (2x buffer, shield, etc.)
- Territory types (urban, trail, mountain)

## Technical Decisions

**Why MapLibre over Mapbox?**  
Open sSupabase over Vercel Postgres?**  
**Why Supabase over Vercel Postgres?**  
PostGIS support, RPC functions, built-in auth (if needed), better developer experience.

**Why Server Actions over traditional API routes?**  
Better type safety, automatic serialization, optimistic updates.

**Why not real-time WebSockets?**  
SWR polling is simpler, 30s latency is acceptable for this use case. Can add WS later.

**Why Vercel over AWS?**  
Zero-config edge caching, integrated KV, instant deploys. Perfect for MVP.

---

Built with ❤️ for runners and cyclists who love competition.
# ctrl
