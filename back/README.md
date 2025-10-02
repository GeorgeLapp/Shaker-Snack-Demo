# Shaker Snack Backend

Node.js backend server that exposes API endpoints for the Shaker Snack demo front-end.

## Available scripts

- `npm start` - launch the server in production mode.
- `npm run dev` - launch the server with the same configuration for local development.

## Configuration

Environment variables:

- `PORT` - port to bind the HTTP server. Defaults to `4000`.
- `ALLOWED_ORIGIN` - CORS header value for `Access-Control-Allow-Origin`. Defaults to `*`.
- `PRODUCTS_DB_PATH` - optional absolute or relative path to the SQLite database with product details. Defaults to `../DB/products_db.db` relative to the project root.
- `STATIC_MEDIA_ROOT` - optional absolute or relative path to the directory with media assets. Defaults to `../SnackMedia` relative to the project root.
- `STATIC_ROUTE_PREFIX` - public URL prefix used to expose static assets. Defaults to `/media`.

## Data source

Product information is loaded from a SQLite database (`products_db.db`). The schema contains a single table `product_details` with nutritional information and image paths for each cell of the vending machine. Every request to `/api/product-matrix` reads directly from this database, so updating the DB file immediately affects API responses.

## Static assets

Image files for the vending machine live in the `SnackMedia` directory. They are exposed by the backend under `${STATIC_ROUTE_PREFIX}` (defaults to `/media`), so a file stored at `SnackMedia/images/01.jpg` is available at `http://localhost:4000/media/images/01.jpg` when running locally.

## API

- `GET /api/product-matrix` - returns the full product matrix.
- `POST /api/start-sale` - accepts `{ "cellNumber": number }` and returns `{ "success": true }`.
- `POST /api/issue-product` - accepts `{ "cellNumber": number }` and returns `{ "success": true }`.

Each handler logs the call metadata alongside the incoming payload for observability.

## Running locally

```bash
npm install
npm run dev
```

Ensure that the SQLite database file is located at the default path (`../DB/products_db.db`) or provide a custom location through `PRODUCTS_DB_PATH` before starting the server. Media files are served from `../SnackMedia` by default; adjust `STATIC_MEDIA_ROOT` if you store them elsewhere. Then open `http://localhost:4000/api/product-matrix`, request an asset such as `http://localhost:4000/media/images/01.jpg`, or use the front-end pointed to the same origin.
