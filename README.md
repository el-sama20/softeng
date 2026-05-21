# EFETEBE Payroll System

A browser-based payroll and work week DTR tracker for EFETEBE Aqua & Agricultural Corporation.

## Features

- Admin registration and login
- Employee records with search, role/status filters, sorting, edit, inactive/reactivate, and delete controls
- Daily work log tracking with Sunday-Friday payroll periods
- Saturday rest day validation
- Weekly DTR matrix
- Payroll totals by week, month, and employee
- Reimbursement locking for completed payroll periods
- Inactive employee handling that preserves payroll history while blocking new DTR entries
- JSON backup export/import for browser-stored data
- Audit trail for key payroll, employee, settings, and backup actions
- Printable payroll summary export
- Profile and work day amount settings

## How to Run

Open `index.html` in a browser.

By default, the app stores demo data in the browser using `localStorage`, so records stay on the same browser/device until storage is cleared.

## Supabase Database Setup

The app can sync its payroll data to Supabase.

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. In `script.js`, fill in `SUPABASE_CONFIG.url` and `SUPABASE_CONFIG.anonKey` with your project URL and anon public key.
4. Open `index.html` again. The app will load from Supabase first, then fall back to browser storage if Supabase is not configured or unavailable.

This static setup stores the app data in one `app_state` JSON row so it works without a build step or backend server.

## Important Limitations

This is a frontend-only project. It is useful for demos, school presentations, and local testing, but it is not production-ready for real payroll use because:

- Admin passwords are stored in browser storage.
- Payroll records can be changed through browser developer tools.
- The Supabase anon key is visible in the browser, so the included demo policies allow public reads/writes.
- There is no secure server-side access control, audit trail, or backup system.

For production use, move authentication and payroll data to a backend with hashed passwords, role-based access, database backups, and audit logs.
