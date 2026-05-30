# TODO

## Security Concerns

Look more closely at the way HMTL is escaped and handled. I think there may be some injection vulnerabilities here that need to be addressed.

---

## Scanning Modes (Scan to Wishlist vs. Scan to Owned)

Provide an option in the Scanner UI to let users switch between different default scanning modes:
- **Scan to Wishlist (Default):** For perusing at bookstores or library visits. Items are added as `wishlisted`.
- **Scan to Owned:** For scanning a newly purchased book haul. Items are added directly as `owned`.

**Implementation notes:**
- Add a toggle switch or dropdown in the header of `web-client/pages/scanner.js`.
- Store the user's preference in `localStorage` or session state so it persists.
- Pass the selected status (e.g., `"owned"` or `"wishlisted"`) in the `POST /user/books` request payload (which is currently hardcoded to `"wishlisted"`).
- Update the scanner HUD overlay and history list styles to reflect the target status dynamically.

