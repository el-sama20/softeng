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
- Printable payroll summary export
- Profile and work day amount settings

## How to Run

Open `index.html` in a browser.

The app stores demo data in the browser using `localStorage`, so records stay on the same browser/device until storage is cleared.

## Important Limitations

This is a frontend-only project. It is useful for demos, school presentations, and local testing, but it is not production-ready for real payroll use because:

- Admin passwords are stored in browser storage.
- Payroll records can be changed through browser developer tools.
- There is no server database, access control, audit trail, or backup system.

For production use, move authentication and payroll data to a backend with hashed passwords, role-based access, database backups, and audit logs.
