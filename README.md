# Silverfox Property Management API

Node.js (Express 5 + TypeScript) REST API for the Silverfox website and staff workspace.
Data is stored in MySQL/MariaDB through Drizzle ORM. Images are stored on disk and served from `/uploads`.

## Local development

Requires Node.js 20.19+ (22 recommended).

```sh
npm install
npm run dev:local   # API on http://localhost:4000 with a temporary MySQL seeded with the website content
```

`dev:local` downloads MySQL once (about 1 GB, kept in `.mysql-cache/`) and starts a throwaway
database; data is lost when it stops. Staff sign-in: `admin@silverfox.local` / `silverfox-admin`.
To keep data, create a `.env` from `.env.example` with a real `DATABASE_URL` and run `npm run dev`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run from source with auto-reload (uses `.env` / environment variables) |
| `npm run dev:local` | Run with a temporary seeded database |
| `npm test` | Integration tests against a temporary MySQL |
| `npm run typecheck` | TypeScript checks |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run create-admin -- --email you@example.com --name "Your Name"` | Add another staff account |

On start the server applies pending migrations, creates the first staff account from
`ADMIN_EMAIL`/`ADMIN_PASSWORD` if no accounts exist, and loads the current website content
(5 properties, 2 service categories with 8 services, 3 articles) into an empty database.

## API conventions

- Base path `/api`. JSON in and out. Field names are camelCase.
- Errors: `{ "message": "..." }`; validation errors are `422` with `{ "message", "errors": { "field": ["..."] } }`.
  `401` not signed in, `403` disallowed origin, `404` not found, `429` rate limited.
- Lists return `{ "data": [...], "meta": { "total", "page", "perPage", "lastPage" } }` and accept `?page=&perPage=` (max 100).
- Content `status` is `draft` or `published` (testimonials also `pending`). **Public endpoints only return published records.**
- Authentication is a session cookie (`sf_session`, httpOnly, SameSite=Lax). Browsers must send requests with
  `credentials: "include"`. State-changing requests must come from an origin listed in `CORS_ORIGINS`.
- Images: upload first with `POST /api/admin/media` (multipart field `file`; JPG/PNG/WebP, max 600 KB, content-checked),
  then reference the returned `id` as `mediaId` in properties, services, blogs and the profile.
- Rich text (service descriptions, blog bodies) is sanitized server-side to the editor's allowlist: p, div, br, b, strong,
  i, em, u, ol, ul, li, h2, h3, blockquote, span (font size 14/16/18/24px, font family serif/sans-serif); blogs also allow
  `<img>` from `https://` or this API's `/uploads/` with alt text (max 5).

## Endpoints

### Authentication
| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password, remember? }` → `{ user }`. 5 attempts/min per email+IP. |
| POST | `/api/auth/logout` | Ends the session. `204` |
| GET | `/api/auth/me` | `{ user }` or `401` (use to guard `/admin/*`) |
| POST | `/api/auth/forgot-password` | `{ email }`. Always `200`; emails `FRONTEND_URL/staff/reset-password?token=&email=` (valid 60 min, single use) |
| POST | `/api/auth/reset-password` | `{ token, email, password, passwordConfirmation }` (min 10 chars). Signs out all sessions. |
| PUT | `/api/auth/password` | `{ currentPassword, password, passwordConfirmation }`. Signs out other sessions. |

`user` = `{ id, email, displayName, contactEmail, phone, photo: { id, src } | null }`

### Public website
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/properties?q=&category=&type=&location=` | `category`: sale, rent, managed, unconfirmed. Default 50 per page. |
| GET | `/api/properties/:slug` | Same shape as the frontend `Property` type (`images: [{ src, alt, position? }]`) |
| GET | `/api/services` | `[{ number, title, description, services: [{ id, title, description, icon, image }] }]` |
| GET | `/api/blogs` | Cards: `{ slug, title, category, excerpt, cover, publishedAt }` |
| GET | `/api/blogs/:slug` | Card fields + `body` (HTML) and `author` |
| GET | `/api/testimonials` | `{ id, name, feedback, rating, publishedAt }` |
| POST | `/api/testimonials` | `{ name, feedback, rating (1-5), website? }` → saved as `pending`. `website` is a hidden honeypot field. 5/hour per IP. |

### Staff workspace (sign-in required, prefix `/api/admin`)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard` | Counts for properties (total, published, draft, apartments, houses, byCategory), services, blogs, testimonials, plus recent items |
| GET / PATCH | `/profile` | `{ displayName, contactEmail, phone, photoMediaId }` (contact email is separate from the sign-in email) |
| POST | `/media` | Image upload → `{ id, src, mime, size }` |
| GET / POST | `/properties` | List (`?q=&type=&category=&status=`) / create |
| GET / PATCH / DELETE | `/properties/:id` | `images` in PATCH replaces the ordered photo list |
| POST | `/properties/:id/publish`, `/properties/:id/unpublish` | Publishing needs at least one photo |
| GET / POST | `/services` | List (`?category=01|02&status=`) / create |
| PATCH | `/services/reorder` | `{ ids: [...] }` in display order |
| GET / PATCH | `/services/categories`, `/services/categories/:number` | Edit category `title`, `description` |
| GET / PATCH / DELETE | `/services/:id` | |
| POST | `/services/:id/publish`, `/services/:id/unpublish` | |
| GET / POST | `/blogs` | List (`?status=&q=`) / create |
| GET / PATCH / DELETE | `/blogs/:id` | |
| POST | `/blogs/:id/publish`, `/blogs/:id/unpublish` | |
| GET / POST | `/testimonials` | List (`?status=pending|draft|published`) / create (`status`: draft or published) |
| GET / PATCH / DELETE | `/testimonials/:id` | Delete = reject |
| POST | `/testimonials/:id/publish`, `/testimonials/:id/unpublish` | Unpublish returns it to draft |

Property fields: `name`, `reference` (unique), `slug` (optional, generated from the name), `category` (sale | rent | managed),
`type` (Apartment | House), `location`, `neighbourhood`, `description`, `price` (`{ amount, currency = "KES", period }` or null;
managed → null, sale → period "", rent → period "month" or "year"), `bedrooms`, `bathrooms`, `areaSqm`, `amenities` (string[]),
`images` (`[{ mediaId, alt, position? }]`, up to 5, first is the cover), `status` (create only).

Service fields: `category` ("01" purchase | "02" management), `title`, `description` (HTML), `icon` (lucide icon name), `image` (`{ mediaId, alt }` or null), `status` (create only).

Blog fields: `title`, `slug` (optional), `category`, `excerpt` (generated from the body if blank), `cover` (`{ mediaId, alt }` or null), `body` (HTML), `status` (create only).

## Deploying to Hostinger (Node.js Web App, Unlimited plan)

1. **Create the database.** hPanel → **Websites** → **Manage** (silverfoxpropertymanagement.com) → **Databases** → **Management**.
   Create a database and user, and note the database name, username, password and host.
2. **Create a mailbox for reset emails** (optional but needed for "Forgot password"). hPanel → **Emails** → create
   `no-reply@silverfoxpropertymanagement.com` and note its password.
3. **Put this folder in its own GitHub repository** (for example `silverfox-properties-api`) and push it.
4. **Create the app.** hPanel → **Websites** → **Add website** → **Node.js Web App** → **Import Git repository**, choose the repository and branch.
   - Domain: `api.silverfoxpropertymanagement.com`
   - Node version: 22
   - Build command: `npm run build` · Start command: `npm start` · Entry file (if asked): `dist/server.js`
5. **Environment variables.** Enter every variable from `.env.example` with real values. Use the database host shown in hPanel
   in `DATABASE_URL`. Set `UPLOAD_DIR` to a folder **outside** the app directory (for example `/home/<your-user>/silverfox-uploads`)
   so uploaded images survive redeploys.
6. **Deploy**, then open `https://api.silverfoxpropertymanagement.com/api/health`. It should show `{"status":"ok"}`.
7. Sign in on the website with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then **remove `ADMIN_PASSWORD`** from the environment variables
   and change the password from the staff workspace.

The website build must point at the API: set `VITE_API_BASE_URL=https://api.silverfoxpropertymanagement.com/api` when running
`npm run build` in the frontend.
