# Crossroads mobile distribution

Crossroads Books can use the same signed-in web workspace on phones, tablets and Windows. The ERP has its own install manifest starting at `/app/books`. The wedding planning hub keeps its existing per-couple manifest. The ERP install layer does not enable offline storage of private records.

## Native release checkpoints

| Release | Work before distribution |
| --- | --- |
| Android device testing | Set up the Android build toolchain and the organization-owned app ID. Build and test a signed APK on actual phone and tablet devices. Test email sign-in, receipt uploads, packet downloads, sign-out and session expiry. |
| Google Play | Publish the signed Android App Bundle through the organization account. Keep the upload key in controlled release credentials. Complete app access, data safety and test-track review before production. |
| App Store | Make receipt capture and the native document picker/share sheet part of a real mobile bookkeeping workflow. Test sign-in, account deletion or its approved route where applicable, accessibility, privacy and iPad layout. Prepare the reviewer account and submission through the organization’s Apple Developer account and App Store Connect. |
| Shared releases | Use the same ERP permission and tenant boundaries. Keep bank and report data out of device caches by default. Use a separate development environment with demo data, controlled signing keys, and real device checks for session and document handling. |

A browser installation is the first distribution step. Evaluate a shared native shell or client for Android and iOS through a prototype that completes receipt capture and opens an audit packet without dropping the user into an unauthenticated external session. Check the current store rules before deciding where subscription purchase is offered inside a native app.

Sources: [Android app signing](https://developer.android.com/studio/publish/app-signing), [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Web app installation criteria](https://web.dev/articles/install-criteria).
