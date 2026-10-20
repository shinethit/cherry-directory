# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
### Added
- OSM Bulk Import support (Category auto-mapping for Banks, Accommodation, Government).
- Strict duplicate detection on Listing Submit (blocks identical Name + Phone/Location).
- `ConfirmModal` and `Toast` components (replaced native browser alerts).
- `fix-rls-history-and-bulk.sql` for History RLS and Bulk Import permissions.

### Changed
- Refactored `BulkImportPage.jsx` for Batch Inserts (50 per batch) to avoid 503 Timeout errors.
- Updated `SubmitListingPage.jsx` to prioritize Myanmar Name (Required) over English (Optional).

### Fixed
- iOS PWA safe-area layout issues (no more double headers or hidden modals).
- Sentry `Replay` import warning removed.
- App bundle size reduced from 1.35MB to ~230KB via React.lazy & manualChunks.

## [1.0.0] - 2026-10-20 (Sprint 2)
### Added
- Unified Saved Hub (`/saved` - Businesses, News, Places tabs).
- Business Hours display & editor.
- Similar Businesses widget.
- My Submissions & My RSVPs pages.
- Report Spam/Fake system with Admin dashboard.
- Nearby (GPS) sorting for Directory.
- Event Enhancements (Share, Countdown, Weekly view).
- News Edit page & Post Edit Workflow fixes.
- Sprint 1 Critical Fixes (perf, security, code-split).
- Phase 3a-3g (Points/Tiers, Leaderboard, History, Donations, Tours).

## [0.9.0] - 2026-10-13 (Initial Handover)
### Added
- Core Directory, Auth, News, Calendar, Community features.
