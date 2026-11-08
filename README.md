# Silverfox Property Management API

Node.js (Express 5, plain JavaScript) REST API for the Silverfox website and staff workspace.
Data lives in **MongoDB Atlas** (Mongoose), images in **Cloudinary**. Same stack and conventions as the Ndeda Autos backend.
No build step: Hostinger runs `npm start` → `node server.js`.

## Local development

Requires Node.js 20.19+ (22 recommended).

```sh
npm install
cp .env.example .env   # fill in MONGO_URI, ACCESS_TOKEN_SECRET, Cloudinary keys, SEED_ADMIN_*
npm run dev            # http://localhost:5000/api/v1
```

On start the server creates the first staff account from `SEED_ADMIN_*` (only if there are no users) and, when the
database is empty, loads the current website content (5 properties, 2 service categories with 8 services, 3 articles),
uploading the photos in `seed-assets/` to Cloudinary.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run with auto-reload (reads `.env`) |
| `npm start` | Run as in production |
| `npm test` | Integration tests against a temporary in-memory MongoDB (no Atlas or Cloudinary needed) |
| `npm run seed` | Create the `SEED_ADMIN_*` account. Another account: `npm run seed -- --email you@example.com --name "Your Name"` |

## API conventions

- Base URL: `https://api.silverfoxpropertymanagement.com/api/v1` (local: `http://localhost:5000/api/v1`). JSON in and out.
- **Success:** `{ "statusCode": 200, "data": { ... }, "message": "...", "success": true }`
- **Error:** `{ "success": false, "message": "name: Name is required", "errors": ["name: Name is required", ...] }`
  - `400` invalid input · `401` not signed in / session expired · `403` origin not allowed or account disabled
  - `404` not found · `409` duplicate (reference, slug, email) · `413` body too large · `429` rate limited
- **Lists** return `{ <items>: [...], pagination: { page, limit, total, totalPages } }` and accept `?page=&limit=` (max 100).
- **Ids** are MongoDB `_id` strings. Dates are ISO strings. `createdAt` / `updatedAt` are on every record.
- **Status:** content is `draft` or `published`; testimonials can also be `pending`. Public endpoints only return published records.
  `PATCH /:id/publish` toggles published ↔ draft. `publishedAt` is set on the first publish and kept afterwards.
- **Authentication:** `POST /auth/login` sets an httpOnly `accessToken` cookie (1 day, or 30 days with `remember: true`).
  Browsers must send requests with `credentials: "include"` (fetch) / `withCredentials: true` (axios).
  API clients such as Postman can instead send `Authorization: Bearer <token>`.
  State-changing requests from a browser origin not listed in `FRONTEND_URL` / `CORS_ORIGIN` are refused with `403`.
- **Images:** upload first with `POST /media`, then put the returned `{ url, publicId }` plus `alt` text on the record.
  Replaced or deleted images are removed from Cloudinary automatically.
- **Rich text** (service descriptions, article bodies) is sanitized to the editor allowlist: p, div, br, b, strong, i, em, u,
  ol, ul, li, h2, h3, blockquote, span (font-size 14/16/18/24px, font-family serif/sans-serif). Articles also allow up to 5
  `<img>` with an `https://` src and alt text.
- **Rate limits** (per IP): all API 300 / 15 min · failed logins 5 / 15 min · password reset 5 / 15 min · testimonial submissions 3 / hour.

## Endpoints

`🔒` = staff sign-in required.

### Health
| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | `{ success: true, message: "API is running", timestamp }` |

### Authentication & profile
| Method | Path | Body → `data` |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password, remember? }` → `{ user }` |
| POST | `/auth/logout` | → `{}` (clears the cookie) |
| GET 🔒 | `/auth/me` | → `{ user }` (use to guard `/staff/*` pages; `401` = signed out) |
| PATCH 🔒 | `/auth/profile` | any of `{ name, contactEmail, phone, photo }` → `{ user }`. `photo` = `{ url, publicId, alt? }` or `null` |
| POST | `/auth/forgot-password` | `{ email }` → `{}`. Always `200`. Emails `FRONTEND_URL/staff/reset-password?token=…` (valid 60 min, single use) |
| POST | `/auth/reset-password` | `{ token, newPassword, confirmPassword }` (min 10 chars) → `{}`. Signs out every session |
| PATCH 🔒 | `/auth/change-password` | `{ currentPassword, newPassword, confirmPassword }` → `{}`. Keeps this session, signs out the others |

`user` = `{ _id, name, email, contactEmail, phone, photo: { url, publicId, alt } | null, isActive, lastLoginAt, createdAt, updatedAt }`
(`email` is the sign-in address; `contactEmail` / `phone` are the public contact details.)

### Staff accounts (user management)
| Method | Path | Body → `data` |
| --- | --- | --- |
| GET 🔒 | `/users` | `?page=&limit=` (default 50, oldest first) → `{ users, pagination }` |
| POST 🔒 | `/users` | `{ name, email, password, confirmPassword }` (min 10 chars) → `201 { user }`. The new admin can sign in straight away and change the password from their profile |

Every staff account is an admin. A duplicate sign-in email returns `409` with `errors: ["email: An account with this email already exists"]`.

### Media
| Method | Path | Notes |
| --- | --- | --- |
| POST 🔒 | `/media?folder=properties\|services\|blog\|profile` | `multipart/form-data`, field **`image`** (JPEG/PNG/WebP, max 5 MB, content-checked) → `{ image: { url, publicId } }` |

### Properties
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/properties` | `?search=&type=&category=&location=&page=&limit=` (default limit 50, newest first) → `{ properties, pagination }` |
| GET | `/properties/slug/:slug` | → `{ property }` |
| GET 🔒 | `/properties/admin/all` | Same filters plus `?status=draft\|published` (default limit 20, recently edited first) |
| GET 🔒 | `/properties/admin/:id` | → `{ property }` |
| POST 🔒 | `/properties` | Create → `201 { property }` |
| PATCH 🔒 | `/properties/:id` | Any fields; `images` replaces the ordered photo list → `{ property }` |
| PATCH 🔒 | `/properties/:id/publish` | Toggle. Publishing needs at least one photo |
| DELETE 🔒 | `/properties/:id` | → `{}` |

`property` = `{ _id, name, slug, reference, category, type, location, neighbourhood, description, price, bedrooms, bathrooms,
areaSqm, amenities, images, status, publishedAt, author, createdAt, updatedAt }` (`author` only on staff endpoints).

| Field | Rules |
| --- | --- |
| `name` | required, ≤150 |
| `reference` | required, unique, ≤40 (e.g. `SF-006`) |
| `slug` | optional; generated from the name (`riverside-villa`, `riverside-villa-2`…) |
| `category` | `sale` \| `rent` \| `managed` (required on create). Seeded properties have `null` (filter with `category=unconfirmed`) |
| `type` | `Apartment` \| `House` |
| `location` | required, ≤200 · `neighbourhood` optional, ≤2000 |
| `description` | required, ≤5000 (plain text) |
| `price` | `{ amount, currency = "KES", period }` or `null`. managed → always `null`; sale → `period: ""`; rent → `period: "month"` or `"year"` (required) |
| `bedrooms`, `bathrooms`, `areaSqm` | numbers or `null` |
| `amenities` | string[] (≤40 items, each ≤80) |
| `images` | up to 5 `{ url, publicId, alt, position? }`; first is the cover. `position` is a CSS object-position such as `"50% 65%"` |
| `status` | create only: `draft` (default) or `published` |

Search (`search`) matches name, location and reference.

### Services
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/services` | → `{ categories: [{ number, title, description, services: [service, ...] }] }` (published only, display order) |
| GET | `/services/categories` | → `{ categories: [{ _id, number, title, description, sortOrder }] }` |
| PATCH 🔒 | `/services/categories/:number` | `{ title?, description? }` → `{ category }` |
| GET 🔒 | `/services/admin/all` | `?category=01\|02&status=` (default limit 50) → `{ services, pagination }` |
| GET 🔒 | `/services/admin/:id` | → `{ service }` |
| POST 🔒 | `/services` | `{ category, title, description, icon?, image?, status? }` → `201 { service }` (added at the end) |
| PATCH 🔒 | `/services/reorder` | `{ ids: [...] }` in display order → `{}` |
| PATCH 🔒 | `/services/:id` | Any fields → `{ service }` |
| PATCH 🔒 | `/services/:id/publish` | Toggle |
| DELETE 🔒 | `/services/:id` | → `{}` |

`service` = `{ _id, category: "01"|"02", title, description (HTML), icon, image: { url, publicId, alt } | null, sortOrder, status, publishedAt }`.
`category`: `"01"` purchase services, `"02"` management services. `icon`: a lucide-react icon name (e.g. `KeyRound`).
`description`: HTML, 1–10,000 characters of text.

### Blog
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/blog` | `?category=&search=` (default limit 12, newest first) → `{ posts, pagination }`. Cards: no `content` |
| GET | `/blog/slug/:slug` | → `{ post }` with `content` |
| GET 🔒 | `/blog/admin/all` | `?status=&category=&search=` → `{ posts, pagination }` (no `content`) |
| GET 🔒 | `/blog/admin/:id` | → `{ post }` with `content` |
| POST 🔒 | `/blog` | `{ title, content, category?, excerpt?, coverImage?, slug?, status? }` → `201 { post }` |
| PATCH 🔒 | `/blog/:id` | Any fields → `{ post }` |
| PATCH 🔒 | `/blog/:id/publish` | Toggle |
| DELETE 🔒 | `/blog/:id` | → `{}` |

`post` = `{ _id, title, slug, category, excerpt, content (HTML), coverImage: { url, publicId, alt } | null, author: { _id, name }, status, publishedAt }`.
`title` ≤200 · `category` free text ≤80 · `excerpt` ≤400, generated from the body when blank · `content` 1–50,000 characters of text.

### Testimonials
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/testimonials` | (default limit 12) → `{ testimonials: [{ _id, name, comment, rating, publishedAt }], pagination }` |
| POST | `/testimonials/submit` | `{ name, comment, rating (1-5), website? }` → `201`. Saved as `pending`; staff get an email. `website` is a hidden honeypot field — leave it empty |
| GET 🔒 | `/testimonials/admin/all` | `?status=pending\|draft\|published` → `{ testimonials, pagination }` |
| GET 🔒 | `/testimonials/admin/:id` | → `{ testimonial }` |
| POST 🔒 | `/testimonials` | `{ name, comment, rating, status? }` (`draft` or `published`) → `201 { testimonial }` |
| PATCH 🔒 | `/testimonials/:id` | `{ name?, comment?, rating?, status? }` → `{ testimonial }` |
| PATCH 🔒 | `/testimonials/:id/publish` | pending/draft → published; published → draft |
| DELETE 🔒 | `/testimonials/:id` | Delete (also used to reject a pending submission) |

`name` 2–100 · `comment` 10–2000 · `rating` whole number 1–5 · staff records also include `status`, `source` (`public` | `admin`).

### Dashboard
| Method | Path | Response `data` |
| --- | --- | --- |
| GET 🔒 | `/admin/dashboard` | `{ properties: { total, published, draft, apartments, houses, byCategory: { sale, rent, managed, unconfirmed } }, services: { published, draft }, blog: { published, draft }, testimonials: { pending, draft, published }, recent: { properties, posts, pendingTestimonials } }` |

## Deploying (MongoDB Atlas + Cloudinary + Hostinger)

### 1. MongoDB Atlas
1. In an Atlas organization → **New Project** (e.g. `Silverfox`) → **Create cluster** (the free M0 tier is enough to start).
2. **Database Access** → add a database user (e.g. `silverfox_api`) with a generated password and the *Read and write to any database* role.
3. **Network Access** → **Add IP Address** → `0.0.0.0/0` (Hostinger's outgoing IP is not fixed).
4. **Connect** → **Drivers** → copy the connection string, put the password in, and add the database name before the `?`:
   `mongodb+srv://silverfox_api:<password>@cluster0.xxxxx.mongodb.net/silverfox?retryWrites=true&w=majority`

### 2. Cloudinary
Use the Cloudinary account (a new one or the existing one with `CLOUDINARY_FOLDER=silverfox` to keep images separate).
Copy the cloud name, API key and API secret from **Dashboard → API Keys**.

### 3. Hostinger
Needs a plan that includes **Node.js apps** (Business or Cloud).
1. *(For password-reset emails)* **Emails** → create `no-reply@silverfoxpropertymanagement.com`.
2. **Websites** → **Add website** → **Node.js Web App** → **Import Git repository** → this repository, branch `master`.
   - Framework: Express (or Other) · Node version: **22.x**
   - Build command: `npm install` · Start command: `npm start` · Entry file: `server.js`
3. **Environment variables** — add every variable from `.env.example` with real values. **Do not set `PORT`** (Hostinger sets it).
   Generate `ACCESS_TOKEN_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Set `FRONTEND_URL=https://silverfoxpropertymanagement.com` (the `www.` address is allowed automatically).
4. Attach the domain **`api.silverfoxpropertymanagement.com`** to the app and issue its free **SSL** certificate.
   SSL is required: the login cookie is `Secure; SameSite=None`.
5. **Deploy**, then open `https://api.silverfoxpropertymanagement.com/api/v1/health` — it should show `"success": true`.
   The app log should show `MongoDB connected`, `Created the first admin account…` and `Loaded the existing website content…`.
6. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, change the password from the staff workspace, then **remove
   `SEED_ADMIN_PASSWORD`** from the environment variables and redeploy.

The website build must point at the API, e.g. `VITE_API_BASE_URL=https://api.silverfoxpropertymanagement.com/api/v1`.
