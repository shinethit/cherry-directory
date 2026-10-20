# Changelog
All notable changes to this project will be documented in this file.

## [0.9.0] - 2026-10-20 (Current)
### Added
- OSM Bulk Import support (Category auto-mapping for Banks, Accommodation, Government).
- Strict duplicate detection on Listing Submit (blocks identical Name + Phone/Location).
- `ConfirmModal` and `Toast` components (replaced native browser alerts).
- iOS PWA safe-area fixes for Modals and Sticky Headers.

### Fixed
- Fixed History RLS 401 error.
- Fixed Supabase Batch Insert 503 timeout error.
- Removed Sentry `Replay` import warning.
- Reduced bundle size from 1.35MB to 230KB.

## [0.8.0] - 2026-10-19 (Sprint 2)
### Added
- Unified Saved Hub (`/saved` - Businesses, News, Places tabs).
- Business Hours display & editor.
- Similar Businesses widget.
- My Submissions & My RSVPs pages.
- Report Spam/Fake system with Admin dashboard.
- Nearby (GPS) sorting for Directory.
- Event Enhancements (Share, Countdown, Weekly view).
- News Edit page & Post Edit Workflow fixes.

## [0.7.0] - 2026-10-18 (Sprint 1)
### Added
- React.lazy & Suspense for all pages (Performance).
- Vite manualChunks configuration.
- Super Admin role logic in Header.

### Fixed
- Audit Log RLS (Restricted to auth.uid).
- Auth Loading timeout.

## [0.6.0] - 2026-10-15 (Phase 3)
### Added
- Phase 3a-3g: Points/Tiers, Leaderboard, History, Donations, Tours.
- Calendar Enhancements, Business Hours.
- Notices & Announcements merged.

## [0.5.0] - 2026-10-13 (Phase 2)
### Added
- Community Features (Jobs, Rentals, Tutoring).
- Emergency & Health Services.
- Market Prices & Fuel Station status.

## [0.4.0] - 2026-10-10 (Phase 1)
### Added
- Initial Directory setup (Categories, Listings, Reviews).
- Auth (Login, Profile, Supabase RLS).
- PWA setup (Service Worker, Manifest, Offline Cache).

## [0.1.0] - 2026-10-01 (Initial)
- Project initialized.
